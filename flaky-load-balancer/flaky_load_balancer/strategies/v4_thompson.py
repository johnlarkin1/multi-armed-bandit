import random

from flaky_load_balancer.constants import ServerConfig, SERVER_CONFIG_TYPE
from flaky_load_balancer.strategies.base import BaseStrategy


class ThompsonStrategy(BaseStrategy):
    """V4 - Thompson Sampling Strategy.

    Uses Beta distribution sampling for Bayesian server selection:
    - Each server maintains alpha (successes + 1) and beta (failures + 1)
    - Sample from Beta(alpha, beta) for each server
    - Select server with highest sample

    This provides probabilistic exploration - servers with high uncertainty
    have a chance to produce high samples and get selected.
    """

    def __init__(
        self,
        config_target: SERVER_CONFIG_TYPE,
        server_configs: dict[int, ServerConfig],
    ):
        super().__init__(config_target, server_configs)

    def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
        """Select server using Thompson Sampling.

        Args:
            excluded: Set of ports to exclude (already tried this request)
            attempt: Current attempt number (unused in basic Thompson)

        Returns:
            Port number of selected server
        """
        excluded = excluded or set()
        target_ports = [p for p in self.get_ports(self._config_target) if p not in excluded]

        if not target_ports:
            return self.get_best_server()

        # Sample from Beta distribution for each server and pick highest
        best_port = target_ports[0]
        best_sample = -1.0

        for port in target_ports:
            stats = self.server_stats[port]
            sample = random.betavariate(stats.alpha, stats.beta)

            if sample > best_sample:
                best_sample = sample
                best_port = port

        return best_port

    def update(self, port: int, success: bool, latency_ms: float) -> None:
        """Update server statistics after a request.

        Updates both basic stats and Beta distribution parameters.

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
