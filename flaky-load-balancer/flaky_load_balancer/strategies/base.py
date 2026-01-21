from abc import ABC, abstractmethod

from flaky_load_balancer.constants import ServerConfig, ServerStats, SERVER_CONFIG_TYPE


class BaseStrategy(ABC):
    def __init__(self, config_target: SERVER_CONFIG_TYPE, server_configs: dict[int, ServerConfig]):
        self._config_target = config_target
        self.server_configs = server_configs
        # pointing from port to server stats
        # these will be updated
        self.server_stats: dict[int, ServerStats] = {port: ServerStats(port=port) for port in server_configs.keys()}

    @property
    def config_target(self) -> SERVER_CONFIG_TYPE:
        return self._config_target

    @abstractmethod
    def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
        """Select a server port based on strategy logic.

        Args:
            excluded: Set of ports to exclude from selection (already tried)
            attempt: Current attempt number (0-indexed) for exploration tuning

        Returns:
            Port number of selected server
        """
        pass

    @abstractmethod
    def update(self, port: int, success: bool, latency_ms: float) -> None:
        pass

    def get_best_server(self) -> int:
        """Get the server with the highest observed success rate.

        Returns:
            Port number of the best performing server
        """
        target_ports = self.get_ports(self._config_target)
        best_port = target_ports[0]
        best_rate = -1.0

        for port in target_ports:
            stats = self.server_stats[port]
            if stats.num_requests > 0 and stats.success_rate > best_rate:
                best_rate = stats.success_rate
                best_port = port

        return best_port

    def reset(self) -> None:
        self.server_stats = {port: ServerStats(port=port) for port in self.server_configs.keys()}

    def get_stats(self) -> dict[int, ServerStats]:
        return self.server_stats.copy()

    def get_ports(self, config_type: SERVER_CONFIG_TYPE) -> list[int]:
        return [port for port, config in self.server_configs.items() if config.server_type == config_type]

    def _update_stats(self, port: int, success: bool, latency_ms: float) -> None:
        stats = self.server_stats[port]
        stats.num_requests += 1
        stats.total_latency_ms += latency_ms
        if success:
            stats.num_success += 1
        else:
            stats.num_failure += 1
