from starlette.config import Config

config = Config()
_LB_STRATEGY_TMP = config("LB_STRATEGY", cast=str)

if _LB_STRATEGY_TMP is None:
    raise AssertionError("LB_STRATEGY is needed as an env variable to determine the load balancing strategy")

LB_STRATEGY = _LB_STRATEGY_TMP
