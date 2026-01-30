from enum import StrEnum


class LoadBalancerStrategy(StrEnum):
    """Available load balancing strategies."""

    LARKIN_INTUITION = "v1"
    UCB = "v2"
    UCB_MODIFIED = "v3"
    THOMPSON = "v4"
    THOMPSON_MODIFIED = "v5"
    # Rate-limit-aware strategies
    THOMPSON_MASKED = "v6"
    SLIDING_WINDOW = "v7"
    BLOCKING_BANDIT = "v8"
