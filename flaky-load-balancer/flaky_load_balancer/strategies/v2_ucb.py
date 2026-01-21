import math
import random

from flaky_load_balancer.constants import ServerConfig, SERVER_CONFIG_TYPE
from flaky_load_balancer.strategies.base import BaseStrategy


class UCBStrategy(BaseStrategy):
    """V2 - Upper Confidence Bound (UCB1) Strategy.

    Uses the UCB1 formula to balance exploration and exploitation:
    UCB(i, t) = success_rate(i) + sqrt(2 * ln(t) / n_i)

    Where:
    - t is total number of requests across all servers
    - n_i is the number of times server i has been tried
    - success_rate(i) is the empirical success rate for server i

    This strategy automatically balances exploration/exploitation without
    needing a static discovery limit.
    """

    def __init__(
        self,
        config_target: SERVER_CONFIG_TYPE,
        server_configs: dict[int, ServerConfig],
    ):
        super().__init__(config_target, server_configs)
        self._total_requests = 0

    def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
        """Select server with highest UCB score.

        Args:
            excluded: Set of ports to exclude (already tried this request)
            attempt: Current attempt number (unused in basic UCB)

        Returns:
            Port number of selected server
        """
        excluded = excluded or set()
        target_ports = [p for p in self.get_ports(self._config_target) if p not in excluded]

        if not target_ports:
            return self.get_best_server()

        # If no requests yet, pick randomly
        if self._total_requests == 0:
            return random.choice(target_ports)

        # Prioritize untried servers (infinite UCB score effectively)
        for port in target_ports:
            if self.server_stats[port].num_requests == 0:
                return port

        # Calculate UCB score for each available server
        best_port = target_ports[0]
        best_ucb = -float("inf")

        for port in target_ports:
            stats = self.server_stats[port]
            ucb_score = self._calculate_ucb(stats.success_rate, stats.num_requests)

            if ucb_score > best_ucb:
                best_ucb = ucb_score
                best_port = port

        return best_port

    def _calculate_ucb(self, success_rate: float, num_attempts: int, c: float = math.sqrt(2)) -> float:
        """Calculate UCB1 score.

        Args:
            success_rate: Empirical success rate for the server
            num_attempts: Number of times this server has been tried
            c: Exploration constant (default sqrt(2) for UCB1)

        Returns:
            UCB score
        """
        if num_attempts == 0:
            return float("inf")

        exploration_bonus = c * math.sqrt(math.log(self._total_requests) / num_attempts)
        return success_rate + exploration_bonus

    def update(self, port: int, success: bool, latency_ms: float) -> None:
        """Update server statistics after a request.

        Args:
            port: The port of the server that was tried
            success: Whether the request succeeded
            latency_ms: Request latency in milliseconds
        """
        self._total_requests += 1
        self._update_stats(port, success, latency_ms)
