import logging
import sys

from pythonjsonlogger import jsonlogger


def get_logger(name: str = "load-balancer") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s %(filename)s %(lineno)d")
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger
