import math
import random

from flaky_load_balancer.constants import ServerConfig, SERVER_CONFIG_TYPE
from flaky_load_balancer.strategies.base import BaseStrategy


class UCBModifiedStrategy(BaseStrategy):
    """V3 - Modified UCB Strategy.

    Extends UCB1 with dynamic exploration constant based on attempt number:
    - c = 3 for attempts 0-2 (aggressive exploration during penalty-free window)
    - c = 1 for attempts 3+ (conservative after penalties begin)

    This takes advantage of the 3 free attempts before penalties are incurred,
    encouraging more exploration when it's "free" to do so.
    """

    def __init__(
        self,
        config_target: SERVER_CONFIG_TYPE,
        server_configs: dict[int, ServerConfig],
    ):
        super().__init__(config_target, server_configs)
        self._total_requests = 0

    def _get_exploration_constant(self, attempt: int) -> float:
        """Get exploration constant based on attempt number.

        Args:
            attempt: Current attempt number (0-indexed)

        Returns:
            Exploration constant (3 for penalty-free, 1 after)
        """
        return 3.0 if attempt < 3 else 1.0

    def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
        """Select server with highest UCB score using dynamic exploration constant.

        Args:
            excluded: Set of ports to exclude (already tried this request)
            attempt: Current attempt number for exploration tuning

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

        # Prioritize untried servers during penalty-free window
        if attempt < 3:
            for port in target_ports:
                if self.server_stats[port].num_requests == 0:
                    return port

        # Get exploration constant based on attempt
        c = self._get_exploration_constant(attempt)

        # Calculate UCB score for each available server
        best_port = target_ports[0]
        best_ucb = -float("inf")

        for port in target_ports:
            stats = self.server_stats[port]
            ucb_score = self._calculate_ucb(stats.success_rate, stats.num_requests, c)

            if ucb_score > best_ucb:
                best_ucb = ucb_score
                best_port = port

        return best_port

    def _calculate_ucb(self, success_rate: float, num_attempts: int, c: float) -> float:
        """Calculate UCB score with given exploration constant.

        Args:
            success_rate: Empirical success rate for the server
            num_attempts: Number of times this server has been tried
            c: Exploration constant

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
