"""Base class for rate-limit-aware strategies."""

import os
import time
from abc import abstractmethod

from flaky_load_balancer.constants import ServerConfig, SERVER_CONFIG_TYPE
from flaky_load_balancer.strategies.base import BaseStrategy

# Configurable cooldown period after a 429 response
DEFAULT_COOLDOWN_SECONDS = 1.0


class RateLimitAwareStrategy(BaseStrategy):
    """Base class for strategies that handle rate limits specially.

    Key insight: 429 responses indicate capacity limits, not server quality.
    A server hitting rate limits was performing well until capacity was exhausted.
    Penalizing it biases toward underutilized (potentially worse) servers.

    This base class provides:
    - update_rate_limited(): Records 429 without updating bandit beliefs
    - is_rate_limited(): Checks if server is in cooldown
    - get_available_servers(): Returns servers not excluded AND not rate-limited
    """

    def __init__(
        self,
        config_target: SERVER_CONFIG_TYPE,
        server_configs: dict[int, ServerConfig],
        cooldown_seconds: float | None = None,
    ):
        super().__init__(config_target, server_configs)
        self.cooldown_seconds = cooldown_seconds or float(
            os.environ.get("LB_RATE_LIMIT_COOLDOWN", DEFAULT_COOLDOWN_SECONDS)
        )

    def update_rate_limited(self, port: int, latency_ms: float) -> None:
        """Record a rate limit (429) response without updating bandit beliefs.

        This is the key insight: 429s indicate capacity limits, not quality.
        We track the rate limit event but don't penalize alpha/beta.

        Args:
            port: The port of the rate-limited server
            latency_ms: Request latency in milliseconds
        """
        stats = self.server_stats[port]
        stats.num_rate_limited += 1
        stats.last_rate_limited_at = time.time()
        # Update latency tracking but NOT success/failure counts
        stats.num_requests += 1
        stats.total_latency_ms += latency_ms

    def is_rate_limited(self, port: int) -> bool:
        """Check if a server is currently in rate limit cooldown.

        Args:
            port: The port to check

        Returns:
            True if the server was rate-limited recently and is in cooldown
        """
        stats = self.server_stats[port]
        if stats.last_rate_limited_at is None:
            return False
        elapsed = time.time() - stats.last_rate_limited_at
        return elapsed < self.cooldown_seconds

    def get_available_servers(self, excluded: set[int] | None = None) -> list[int]:
        """Get servers that are not excluded AND not rate-limited.

        Args:
            excluded: Set of ports to exclude (already tried this request)

        Returns:
            List of available port numbers
        """
        excluded = excluded or set()
        target_ports = self.get_ports(self._config_target)
        return [p for p in target_ports if p not in excluded and not self.is_rate_limited(p)]

    def get_least_recently_rate_limited(self) -> int:
        """Get the server that was rate-limited longest ago.

        Fallback when all servers are rate-limited - pick the one
        most likely to have recovered.

        Returns:
            Port number of the least recently rate-limited server
        """
        target_ports = self.get_ports(self._config_target)
        oldest_port = target_ports[0]
        oldest_time = float("inf")

        for port in target_ports:
            stats = self.server_stats[port]
            if stats.last_rate_limited_at is None:
                return port  # Never rate-limited, use it
            if stats.last_rate_limited_at < oldest_time:
                oldest_time = stats.last_rate_limited_at
                oldest_port = port

        return oldest_port

    @abstractmethod
    def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
        """Select a server port based on strategy logic.

        Subclasses should implement this with rate-limit awareness.
        """
        pass

    @abstractmethod
    def update(self, port: int, success: bool, latency_ms: float) -> None:
        """Update server statistics after a successful or failed request.

        Note: This should NOT be called for rate-limited requests.
        Use update_rate_limited() instead.
        """
        pass
