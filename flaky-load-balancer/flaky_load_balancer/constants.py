from typing import Literal
from dataclasses import dataclass

ROOT_ENDPOINT = "/"

SERVER_CONFIG_TYPE = Literal["T1", "T2", "T3"]

MAX_ATTEMPTS = 10
PENALTY_FREE_ATTEMPTS = 3
SSE_INTERVAL_SECONDS = 0.5


@dataclass
class ServerConfig:
    server_type: SERVER_CONFIG_TYPE
    port: int


@dataclass
class ServerStats:
    port: int
    num_success: int = 0
    num_failure: int = 0
    num_requests: int = 0
    total_latency_ms: float = 0.0
    # Alpha and beta for Thompson sampling (Beta distribution)
    # Initialized to 1 for uniform prior Beta(1,1)
    alpha: float = 1.0
    beta: float = 1.0

    @property
    def beta_variance(self) -> float:
        """Calculate variance of Beta distribution with uniform prior Beta(1,1).

        Uses α = num_success + 1, β = num_failure + 1 to ensure:
        - Variance is never 0 (always some uncertainty)
        - Untried servers have maximum variance (0.25 for Beta(1,1))
        - More samples → lower variance (more confidence)

        Formula: Var = αβ / ((α+β)² * (α+β+1))
        See: https://en.wikipedia.org/wiki/Beta_distribution#Variance
        """
        alpha = self.num_success + 1
        beta = self.num_failure + 1
        total = alpha + beta
        return (alpha * beta) / (total * total * (total + 1))

    @property
    def success_rate(self) -> float:
        if self.num_requests == 0:
            return 0.0
        return self.num_success / self.num_requests

    @property
    def failure_rate(self) -> float:
        if self.num_requests == 0:
            return 0.0
        return self.num_failure / self.num_requests

    @property
    def avg_latency_ms(self) -> float:
        if self.num_requests == 0:
            return 0.0
        return self.total_latency_ms / self.num_requests


# Ports for each server config tier
CONFIG_PORTS: dict[SERVER_CONFIG_TYPE, list[int]] = {
    "T1": list(range(4000, 4010)),
    "T2": list(range(5000, 5010)),
    "T3": list(range(6000, 6010)),
}

DOWNSTREAM_SERVER_CONFIGS: dict[int, ServerConfig] = {
    **{4000 + i: ServerConfig(server_type="T1", port=4000 + i) for i in range(10)},
    **{5000 + i: ServerConfig(server_type="T2", port=5000 + i) for i in range(10)},
    **{6000 + i: ServerConfig(server_type="T3", port=6000 + i) for i in range(10)},
}
