import random

from flaky_load_balancer.constants import ServerConfig, SERVER_CONFIG_TYPE
from flaky_load_balancer.strategies.base import BaseStrategy

# Variance scaling parameters
C_INITIAL = 4.0
DECAY_RATE = 0.5


class ThompsonModifiedStrategy(BaseStrategy):
    """V5 - Modified Thompson Sampling Strategy.

    Extends Thompson Sampling with variance scaling during penalty-free window:
    - For attempts 0-2: scale variance using exponential decay
    - variance_scale = c_initial * (decay_rate ** attempt)
    - This encourages exploration during free attempts

    The variance scaling works by effectively reducing the concentration of
    the Beta distribution, making samples more spread out and exploratory.
    """

    def __init__(
        self,
        config_target: SERVER_CONFIG_TYPE,
        server_configs: dict[int, ServerConfig],
    ):
        super().__init__(config_target, server_configs)

    def _get_variance_scale(self, attempt: int) -> float:
        """Get variance scale factor based on attempt number.

        Args:
            attempt: Current attempt number (0-indexed)

        Returns:
            Variance scale factor (higher = more exploration)
        """
        if attempt >= 3:
            return 0.0  # No scaling after penalty-free window
        return C_INITIAL * (DECAY_RATE**attempt)

    def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
        """Select server using Modified Thompson Sampling.

        Args:
            excluded: Set of ports to exclude (already tried this request)
            attempt: Current attempt number for variance scaling

        Returns:
            Port number of selected server
        """
        excluded = excluded or set()
        target_ports = [p for p in self.get_ports(self._config_target) if p not in excluded]

        if not target_ports:
            return self.get_best_server()

        variance_scale = self._get_variance_scale(attempt)

        # Sample from (potentially scaled) Beta distribution for each server
        best_port = target_ports[0]
        best_sample = -1.0

        for port in target_ports:
            stats = self.server_stats[port]
            sample = self._sample_with_variance_scale(stats.alpha, stats.beta, variance_scale)

            if sample > best_sample:
                best_sample = sample
                best_port = port

        return best_port

    def _sample_with_variance_scale(self, alpha: float, beta: float, variance_scale: float) -> float:
        """Sample from Beta distribution with optional variance scaling.

        When variance_scale > 0 and we have enough data, we scale down the
        concentration parameters to increase variance (more exploration).

        Args:
            alpha: Alpha parameter of Beta distribution
            beta: Beta parameter of Beta distribution
            variance_scale: Scale factor (0 = no scaling, higher = more variance)

        Returns:
            Sample from the (potentially scaled) Beta distribution
        """
        total = alpha + beta

        # Only apply scaling if we have enough data and scale is non-zero
        if variance_scale > 0 and total > 2:
            # Scale down the concentration to increase variance
            scale_factor = max(2, total / variance_scale) / total
            scaled_alpha = max(1.0, alpha * scale_factor)
            scaled_beta = max(1.0, beta * scale_factor)
            return random.betavariate(scaled_alpha, scaled_beta)

        return random.betavariate(alpha, beta)

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
