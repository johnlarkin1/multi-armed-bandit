import time

import httpx

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


async def send_request(port: int, request_id: str) -> tuple[bool, float]:
    """Send a request to a downstream server.

    Args:
        port: The port of the downstream server
        request_id: The 24-character alphanumeric request ID

    Returns:
        Tuple of (success: bool, latency_ms: float)
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

        # 2xx is success, anything else (especially 5xx) is failure
        success = 200 <= response.status_code < 300
        return success, latency_ms

    except httpx.TimeoutException:
        latency_ms = (time.perf_counter() - start_time) * 1000
        return False, latency_ms

    except httpx.RequestError:
        latency_ms = (time.perf_counter() - start_time) * 1000
        return False, latency_ms
