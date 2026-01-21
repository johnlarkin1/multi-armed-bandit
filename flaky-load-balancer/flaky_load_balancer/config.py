from starlette.config import Config

from flaky_load_balancer.constants import SERVER_CONFIG_TYPE

config = Config()
_LB_STRATEGY_TMP = config("LB_STRATEGY", cast=str)

if _LB_STRATEGY_TMP is None:
    raise AssertionError("LB_STRATEGY is needed as an env variable to determine the load balancing strategy")

LB_STRATEGY = _LB_STRATEGY_TMP

# Config target determines which server tier to use (T1, T2, or T3)
_LB_CONFIG_TARGET_TMP = config("LB_CONFIG_TARGET", cast=str, default="T1")
if _LB_CONFIG_TARGET_TMP not in ("T1", "T2", "T3"):
    raise AssertionError(f"LB_CONFIG_TARGET must be one of T1, T2, T3, got: {_LB_CONFIG_TARGET_TMP}")
LB_CONFIG_TARGET: SERVER_CONFIG_TYPE = _LB_CONFIG_TARGET_TMP  # type: ignore[assignment]
