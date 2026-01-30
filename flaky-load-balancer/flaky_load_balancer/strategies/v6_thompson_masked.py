"""V6 - Thompson Sampling with Arm Masking for rate limits."""

import random

from flaky_load_balancer.constants import ServerConfig, SERVER_CONFIG_TYPE
from flaky_load_balancer.strategies.rate_limit_base import RateLimitAwareStrategy


class ThompsonMaskedStrategy(RateLimitAwareStrategy):
    """V6 - Thompson Sampling with Arm Masking.

    Key insight: 429 rate limits are availability constraints, not quality signals.
    Servers hitting rate limits were performing well until capacity was exhausted.

    This strategy:
    - Excludes rate-limited servers from Thompson sampling selection
    - Does NOT update alpha/beta on 429 (not a quality signal)
    - Falls back to least recently limited server when all are rate-limited

    Best for: Fixed rate limits (Config 2) where servers have predictable capacity.
    """

    def __init__(
        self,
        config_target: SERVER_CONFIG_TYPE,
        server_configs: dict[int, ServerConfig],
        cooldown_seconds: float | None = None,
    ):
        super().__init__(config_target, server_configs, cooldown_seconds)

    def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
        """Select server using Thompson Sampling, masking rate-limited servers.

        Args:
            excluded: Set of ports to exclude (already tried this request)
            attempt: Current attempt number (unused in basic Thompson)

        Returns:
            Port number of selected server
        """
        excluded = excluded or set()

        # Get servers that are available (not excluded AND not rate-limited)
        available_ports = self.get_available_servers(excluded)

        if not available_ports:
            # All servers either excluded or rate-limited
            # First try: servers that are rate-limited but not excluded
            rate_limited_ports = [
                p for p in self.get_ports(self._config_target) if p not in excluded and self.is_rate_limited(p)
            ]
            if rate_limited_ports:
                # Pick least recently rate-limited
                return self.get_least_recently_rate_limited()

            # Last resort: use best server overall
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

    def update(self, port: int, success: bool, latency_ms: float) -> None:
        """Update server statistics after a successful or failed request.

        Updates both basic stats and Beta distribution parameters.
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
        else:
            stats.beta += 1

        # Update basic stats
        self._update_stats(port, success, latency_ms)
