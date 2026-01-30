"""V7 - Sliding-Window Thompson Sampling for dynamic rate limits."""

import os
import random
from collections import deque
from dataclasses import dataclass, field

from flaky_load_balancer.constants import ServerConfig, SERVER_CONFIG_TYPE
from flaky_load_balancer.strategies.rate_limit_base import RateLimitAwareStrategy

DEFAULT_WINDOW_SIZE = 30


@dataclass
class WindowedStats:
    """Per-server statistics with sliding window history."""

    port: int
    history: deque = field(default_factory=lambda: deque(maxlen=DEFAULT_WINDOW_SIZE))

    @property
    def alpha(self) -> float:
        """Compute alpha from windowed history (successes + 1 for prior)."""
        return sum(1 for success in self.history if success) + 1

    @property
    def beta(self) -> float:
        """Compute beta from windowed history (failures + 1 for prior)."""
        return sum(1 for success in self.history if not success) + 1


class SlidingWindowStrategy(RateLimitAwareStrategy):
    """V7 - Sliding-Window Thompson Sampling.

    Uses a sliding window of recent observations to compute Beta parameters.
    This allows the strategy to adapt quickly when rate limits change.

    Key features:
    - Maintains deque(maxlen=window_size) per server
    - Beta params computed from windowed history only (forgets old data)
    - Quickly adapts to changing server behavior

    Best for: Dynamic/changing rate limits (Config 3) where server capacity varies.
    """

    def __init__(
        self,
        config_target: SERVER_CONFIG_TYPE,
        server_configs: dict[int, ServerConfig],
        cooldown_seconds: float | None = None,
        window_size: int | None = None,
    ):
        super().__init__(config_target, server_configs, cooldown_seconds)
        self.window_size = window_size or int(os.environ.get("LB_SLIDING_WINDOW_SIZE", DEFAULT_WINDOW_SIZE))

        # Initialize windowed stats per server
        self.windowed_stats: dict[int, WindowedStats] = {}
        for port in server_configs.keys():
            self.windowed_stats[port] = WindowedStats(port=port, history=deque(maxlen=self.window_size))

    def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
        """Select server using Thompson Sampling with windowed statistics.

        Args:
            excluded: Set of ports to exclude (already tried this request)
            attempt: Current attempt number (unused)

        Returns:
            Port number of selected server
        """
        excluded = excluded or set()

        # Get servers that are available (not excluded AND not rate-limited)
        available_ports = self.get_available_servers(excluded)

        if not available_ports:
            # All servers either excluded or rate-limited
            rate_limited_ports = [
                p for p in self.get_ports(self._config_target) if p not in excluded and self.is_rate_limited(p)
            ]
            if rate_limited_ports:
                return self.get_least_recently_rate_limited()
            return self.get_best_server()

        # Sample from Beta distribution using windowed stats
        best_port = available_ports[0]
        best_sample = -1.0

        for port in available_ports:
            windowed = self.windowed_stats[port]
            sample = random.betavariate(windowed.alpha, windowed.beta)

            if sample > best_sample:
                best_sample = sample
                best_port = port

        return best_port

    def update(self, port: int, success: bool, latency_ms: float) -> None:
        """Update server statistics after a successful or failed request.

        Updates both windowed history and base stats.
        Note: For 429 rate limits, use update_rate_limited() instead.

        Args:
            port: The port of the server that was tried
            success: Whether the request succeeded
            latency_ms: Request latency in milliseconds
        """
        # Update windowed history
        windowed = self.windowed_stats[port]
        windowed.history.append(success)

        # Also update base stats for compatibility
        stats = self.server_stats[port]
        if success:
            stats.alpha += 1
        else:
            stats.beta += 1

        self._update_stats(port, success, latency_ms)

    def reset(self) -> None:
        """Reset all statistics including windowed history."""
        super().reset()
        for port in self.server_configs.keys():
            self.windowed_stats[port] = WindowedStats(port=port, history=deque(maxlen=self.window_size))
