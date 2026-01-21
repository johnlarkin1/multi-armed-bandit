import random

from flaky_load_balancer.constants import ServerConfig, SERVER_CONFIG_TYPE
from flaky_load_balancer.strategies.base import BaseStrategy

# Number of requests to use for discovery/exploration phase
DISCOVER_LIMIT = 50


class LarkinIntuitionStrategy(BaseStrategy):
    """V1 - Larkin Intuition Strategy.

    A simple explore-then-exploit strategy:
    - During discovery phase (first DISCOVER_LIMIT requests): select server with
      highest beta variance (least confidence in our estimate)
    - After discovery: select server with best observed success rate

    The idea is to gather enough data during discovery to make informed decisions
    during exploitation.
    """

    def __init__(
        self,
        config_target: SERVER_CONFIG_TYPE,
        server_configs: dict[int, ServerConfig],
    ):
        super().__init__(config_target, server_configs)
        self._total_requests = 0

    @property
    def in_discover_mode(self) -> bool:
        """Check if we're still in the discovery phase."""
        return self._total_requests < DISCOVER_LIMIT

    def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
        """Select a server based on discovery mode.

        During discovery: pick server with highest beta variance (least confident).
        After discovery: pick server with best observed success rate.

        Args:
            excluded: Set of ports to exclude (already tried this request)
            attempt: Current attempt number (0 = new request, >0 = retry)

        Returns:
            Port number of selected server
        """
        # Only count new requests toward discovery, not retries
        if attempt == 0:
            self._total_requests += 1

        excluded = excluded or set()
        target_ports = [p for p in self.get_ports(self._config_target) if p not in excluded]

        if not target_ports:
            # All servers excluded, fall back to best server overall
            return self.get_best_server()

        if self.in_discover_mode:
            return self._select_least_confident(target_ports)
        else:
            return self._select_best_success_rate(target_ports)

    def _select_least_confident(self, available_ports: list[int]) -> int:
        """Select the server with highest beta variance (least confidence).

        If no requests have been made yet, pick randomly.
        """
        # Check if any server has been sampled
        has_data = any(self.server_stats[p].num_requests > 0 for p in available_ports)

        if not has_data:
            # No data yet, pick randomly
            return random.choice(available_ports)

        best_port = available_ports[0]
        best_variance = -1.0

        for port in available_ports:
            stats = self.server_stats[port]
            if stats.num_requests == 0:
                # Untried servers get priority (infinite variance effectively)
                return port

            variance = stats.beta_variance
            if variance > best_variance:
                best_variance = variance
                best_port = port

        return best_port

    def _select_best_success_rate(self, available_ports: list[int]) -> int:
        """Select the server with highest observed success rate."""
        best_port = available_ports[0]
        best_rate = -1.0

        for port in available_ports:
            stats = self.server_stats[port]
            if stats.num_requests > 0 and stats.success_rate > best_rate:
                best_rate = stats.success_rate
                best_port = port

        return best_port

    def update(self, port: int, success: bool, latency_ms: float) -> None:
        """Update server statistics after a request.

        Args:
            port: The port of the server that was tried
            success: Whether the request succeeded
            latency_ms: Request latency in milliseconds
        """
        self._update_stats(port, success, latency_ms)
