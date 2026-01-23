"""V8 - Blocking Bandits for fixed-window rate limits."""

import os
import random
import time
from dataclasses import dataclass

from flaky_load_balancer.constants import ServerConfig, SERVER_CONFIG_TYPE
from flaky_load_balancer.strategies.rate_limit_base import RateLimitAwareStrategy

DEFAULT_BLOCK_DURATION = 5.0
MAX_BACKOFF_MULTIPLIER = 4


@dataclass
class BlockingState:
    """Per-server blocking state with exponential backoff."""

    port: int
    blocked_until: float = 0.0
    consecutive_429s: int = 0
    current_multiplier: int = 1


class BlockingBanditStrategy(RateLimitAwareStrategy):
    """V8 - Blocking Bandits with exponential backoff.

    Models fixed-window rate limits explicitly by blocking servers
    after 429 responses with exponential backoff.

    Key features:
    - Blocks server for D seconds after 429
    - Exponential backoff: consecutive 429s double block duration (capped at 4x)
    - Resets backoff on successful request

    Best for: Fixed-window rate limits (N requests/minute) where servers
    have predictable recovery times.
    """

    def __init__(
        self,
        config_target: SERVER_CONFIG_TYPE,
        server_configs: dict[int, ServerConfig],
        cooldown_seconds: float | None = None,
        block_duration: float | None = None,
    ):
        super().__init__(config_target, server_configs, cooldown_seconds)
        self.block_duration = block_duration or float(os.environ.get("LB_BLOCK_DURATION", DEFAULT_BLOCK_DURATION))

        # Initialize blocking state per server
        self.blocking_state: dict[int, BlockingState] = {port: BlockingState(port=port) for port in server_configs}

    def is_blocked(self, port: int) -> bool:
        """Check if a server is currently blocked.

        Args:
            port: The port to check

        Returns:
            True if the server is blocked and hasn't recovered yet
        """
        state = self.blocking_state[port]
        return time.time() < state.blocked_until

    def get_available_servers(self, excluded: set[int] | None = None) -> list[int]:
        """Get servers that are not excluded AND not blocked.

        Overrides parent to use blocking logic instead of cooldown.

        Args:
            excluded: Set of ports to exclude (already tried this request)

        Returns:
            List of available port numbers
        """
        excluded = excluded or set()
        target_ports = self.get_ports(self._config_target)
        return [p for p in target_ports if p not in excluded and not self.is_blocked(p)]

    def get_least_blocked_server(self) -> int:
        """Get the server that will unblock soonest.

        Fallback when all servers are blocked.

        Returns:
            Port number of the server that will unblock first
        """
        target_ports = self.get_ports(self._config_target)
        earliest_port = target_ports[0]
        earliest_time = float("inf")

        for port in target_ports:
            state = self.blocking_state[port]
            if state.blocked_until == 0:
                return port  # Never blocked
            if state.blocked_until < earliest_time:
                earliest_time = state.blocked_until
                earliest_port = port

        return earliest_port

    def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
        """Select server using Thompson Sampling, avoiding blocked servers.

        Args:
            excluded: Set of ports to exclude (already tried this request)
            attempt: Current attempt number (unused)

        Returns:
            Port number of selected server
        """
        excluded = excluded or set()

        # Get servers that are available (not excluded AND not blocked)
        available_ports = self.get_available_servers(excluded)

        if not available_ports:
            # All servers either excluded or blocked
            blocked_ports = [p for p in self.get_ports(self._config_target) if p not in excluded and self.is_blocked(p)]
            if blocked_ports:
                return self.get_least_blocked_server()
            return self.get_best_server()

        # Sample from Beta distribution for each available server
        best_port = available_ports[0]
        best_sample = -1.0

        for port in available_ports:
            stats = self.server_stats[port]
            sample = random.betavariate(stats.alpha, stats.beta)

            if sample > best_sample:
                best_sample = sample
                best_port = port

        return best_port

    def update_rate_limited(self, port: int, latency_ms: float) -> None:
        """Handle 429 rate limit with exponential backoff blocking.

        Overrides parent to implement blocking with backoff.

        Args:
            port: The port of the rate-limited server
            latency_ms: Request latency in milliseconds
        """
        # Call parent to update rate limit stats
        super().update_rate_limited(port, latency_ms)

        # Apply exponential backoff blocking
        state = self.blocking_state[port]
        state.consecutive_429s += 1

        # Double multiplier up to max
        state.current_multiplier = min(state.current_multiplier * 2, MAX_BACKOFF_MULTIPLIER)

        # Block for duration * multiplier
        block_time = self.block_duration * state.current_multiplier
        state.blocked_until = time.time() + block_time

    def update(self, port: int, success: bool, latency_ms: float) -> None:
        """Update server statistics after a successful or failed request.

        On success, resets the exponential backoff for this server.
        Note: For 429 rate limits, use update_rate_limited() instead.

        Args:
            port: The port of the server that was tried
            success: Whether the request succeeded
            latency_ms: Request latency in milliseconds
        """
        stats = self.server_stats[port]

        # Update Beta distribution parameters
        if success:
            stats.alpha += 1
            # Reset backoff state on success
            state = self.blocking_state[port]
            state.consecutive_429s = 0
            state.current_multiplier = 1
        else:
            stats.beta += 1

        self._update_stats(port, success, latency_ms)

    def reset(self) -> None:
        """Reset all statistics including blocking state."""
        super().reset()
        self.blocking_state = {port: BlockingState(port=port) for port in self.server_configs}
