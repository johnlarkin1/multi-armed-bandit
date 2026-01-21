import time
import traceback
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from flaky_load_balancer.logger import get_logger


logger = get_logger()


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip logging for health endpoint
        if request.url.path == "/health":
            return await call_next(request)

        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            process_time = time.perf_counter() - start_time

            log_data: dict[str, Any] = {
                "method": request.method,
                "url": str(request.url.path),
                "client_ip": request.client.host if request.client else "unknown",
                "status_code": response.status_code,
                "process_time": round(process_time, 4),
            }

            if response.status_code >= 400:
                logger.warning("request failure", extra=log_data)
            else:
                logger.info("request success", extra=log_data)

            return response

        except Exception as e:
            process_time = time.perf_counter() - start_time

            log_data: dict[str, Any] = {
                "method": request.method,
                "url": str(request.url.path),
                "client_ip": request.client.host if request.client else "unknown",
                "process_time": round(process_time, 4),
                "error": str(e),
                "traceback": traceback.format_exc(),
            }

            logger.error("unhandled exception", extra=log_data)
            raise
