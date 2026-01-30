from flaky_load_balancer.constants import (
    DOWNSTREAM_SERVER_CONFIGS,
    SERVER_CONFIG_TYPE,
    ServerConfig,
)
from flaky_load_balancer.strategies.base import BaseStrategy
from flaky_load_balancer.strategies.enum import LoadBalancerStrategy


def get_strategy(
    strategy_name: str,
    config_target: SERVER_CONFIG_TYPE = "T1",
) -> BaseStrategy:
    """Create a strategy instance based on the strategy name.

    Args:
        strategy_name: The strategy identifier (e.g., "v1", "v2", etc.)
        config_target: Which server configuration to target (T1, T2, or T3)

    Returns:
        An instance of the appropriate strategy

    Raises:
        ValueError: If the strategy name is not recognized
    """
    # Filter server configs to only include the target type
    filtered_configs: dict[int, ServerConfig] = {
        port: config for port, config in DOWNSTREAM_SERVER_CONFIGS.items() if config.server_type == config_target
    }

    strategy_enum = LoadBalancerStrategy(strategy_name)

    if strategy_enum == LoadBalancerStrategy.LARKIN_INTUITION:
        from flaky_load_balancer.strategies.v1_larkin import LarkinIntuitionStrategy

        return LarkinIntuitionStrategy(config_target, filtered_configs)

    elif strategy_enum == LoadBalancerStrategy.UCB:
        from flaky_load_balancer.strategies.v2_ucb import UCBStrategy

        return UCBStrategy(config_target, filtered_configs)

    elif strategy_enum == LoadBalancerStrategy.UCB_MODIFIED:
        from flaky_load_balancer.strategies.v3_ucb_modified import UCBModifiedStrategy

        return UCBModifiedStrategy(config_target, filtered_configs)

    elif strategy_enum == LoadBalancerStrategy.THOMPSON:
        from flaky_load_balancer.strategies.v4_thompson import ThompsonStrategy

        return ThompsonStrategy(config_target, filtered_configs)

    elif strategy_enum == LoadBalancerStrategy.THOMPSON_MODIFIED:
        from flaky_load_balancer.strategies.v5_thompson_modified import ThompsonModifiedStrategy

        return ThompsonModifiedStrategy(config_target, filtered_configs)

    elif strategy_enum == LoadBalancerStrategy.THOMPSON_MASKED:
        from flaky_load_balancer.strategies.v6_thompson_masked import ThompsonMaskedStrategy

        return ThompsonMaskedStrategy(config_target, filtered_configs)

    elif strategy_enum == LoadBalancerStrategy.SLIDING_WINDOW:
        from flaky_load_balancer.strategies.v7_sliding_window import SlidingWindowStrategy

        return SlidingWindowStrategy(config_target, filtered_configs)

    elif strategy_enum == LoadBalancerStrategy.BLOCKING_BANDIT:
        from flaky_load_balancer.strategies.v8_blocking_bandit import BlockingBanditStrategy

        return BlockingBanditStrategy(config_target, filtered_configs)

    else:
        raise ValueError(f"Unknown strategy: {strategy_name}")


# Global strategy instance (set at startup)
_current_strategy: BaseStrategy | None = None


def init_strategy(strategy_name: str, config_target: SERVER_CONFIG_TYPE = "T1") -> BaseStrategy:
    """Initialize the global strategy instance."""
    global _current_strategy
    _current_strategy = get_strategy(strategy_name, config_target)
    return _current_strategy


def get_current_strategy() -> BaseStrategy:
    """Get the current global strategy instance."""
    if _current_strategy is None:
        raise RuntimeError("Strategy not initialized. Call init_strategy() first.")
    return _current_strategy
