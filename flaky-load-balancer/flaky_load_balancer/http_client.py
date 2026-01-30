import time
from enum import StrEnum
from typing import NamedTuple

import httpx


class RequestOutcome(StrEnum):
    """Outcome of a request to a downstream server."""

    SUCCESS = "success"
    RATE_LIMITED = "rate_limited"
    FAILURE = "failure"


class RequestResult(NamedTuple):
    """Result of a request to a downstream server."""

    outcome: RequestOutcome
    latency_ms: float
    status_code: int | None = None


# Shared async client for connection pooling
_client: httpx.AsyncClient | None = None

# Default timeout for downstream requests (in seconds)
DEFAULT_TIMEOUT = 5.0


async def get_client() -> httpx.AsyncClient:
    """Get or create the shared async HTTP client."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=DEFAULT_TIMEOUT)
    return _client


async def close_client() -> None:
    """Close the shared HTTP client."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def send_request(port: int, request_id: str) -> RequestResult:
    """Send a request to a downstream server.

    Args:
        port: The port of the downstream server
        request_id: The 24-character alphanumeric request ID

    Returns:
        RequestResult with outcome, latency, and status code
    """
    client = await get_client()
    url = f"http://localhost:{port}/"

    start_time = time.perf_counter()
    try:
        # Downstream servers expect plain text body with the ID
        response = await client.post(
            url,
            content=request_id,
            headers={"Content-Type": "text/plain"},
        )
        latency_ms = (time.perf_counter() - start_time) * 1000

        # Check for rate limiting (429)
        if response.status_code == 429:
            return RequestResult(
                outcome=RequestOutcome.RATE_LIMITED,
                latency_ms=latency_ms,
                status_code=429,
            )

        # 2xx is success, anything else is failure
        if 200 <= response.status_code < 300:
            return RequestResult(
                outcome=RequestOutcome.SUCCESS,
                latency_ms=latency_ms,
                status_code=response.status_code,
            )

        return RequestResult(
            outcome=RequestOutcome.FAILURE,
            latency_ms=latency_ms,
            status_code=response.status_code,
        )

    except httpx.TimeoutException:
        latency_ms = (time.perf_counter() - start_time) * 1000
        return RequestResult(
            outcome=RequestOutcome.FAILURE,
            latency_ms=latency_ms,
            status_code=None,
        )

    except httpx.RequestError:
        latency_ms = (time.perf_counter() - start_time) * 1000
        return RequestResult(
            outcome=RequestOutcome.FAILURE,
            latency_ms=latency_ms,
            status_code=None,
        )
