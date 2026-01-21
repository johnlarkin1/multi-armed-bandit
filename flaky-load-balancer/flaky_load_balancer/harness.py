"""Test harness for firing requests to the load balancer at a controlled rate."""

import asyncio
import random
import string
import time
from dataclasses import dataclass, field

import httpx


def generate_request_id() -> str:
    """Generate a random 24-character alphanumeric request ID."""
    return "".join(random.choices(string.ascii_letters + string.digits, k=24))


@dataclass
class RequestResult:
    """Result of a single request."""

    request_id: str
    success: bool
    latency_ms: float
    status_code: int | None = None


@dataclass
class HarnessResults:
    """Aggregated results from the test harness."""

    total_requests: int = 0
    successful: int = 0
    failed: int = 0
    total_retries: int = 0
    latencies: list[float] = field(default_factory=list)
    results: list[RequestResult] = field(default_factory=list)

    @property
    def success_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.successful / self.total_requests

    @property
    def avg_latency_ms(self) -> float:
        if not self.latencies:
            return 0.0
        return sum(self.latencies) / len(self.latencies)

    @property
    def score(self) -> int:
        """Calculate score: successes - penalties."""
        # Penalty is counted by metrics collector, so we just report successes here
        return self.successful

    def to_dict(self) -> dict:
        return {
            "total_requests": self.total_requests,
            "successful": self.successful,
            "failed": self.failed,
            "success_rate": self.success_rate,
            "total_retries": self.total_retries,
            "score": self.score,
            "avg_latency_ms": self.avg_latency_ms,
        }


class TestHarness:
    """Test harness for sending requests to the load balancer at a controlled rate."""

    def __init__(
        self,
        num_requests: int,
        rps: float = 10.0,
        lb_url: str = "http://localhost:8000/",
        timeout: float = 30.0,
    ):
        """Initialize the test harness.

        Args:
            num_requests: Total number of requests to send
            rps: Requests per second (default 10)
            lb_url: URL of the load balancer
            timeout: Request timeout in seconds
        """
        self.num_requests = num_requests
        self.rps = rps
        self.lb_url = lb_url
        self.timeout = timeout
        self.interval = 1.0 / rps  # Time between requests

    async def send_request(
        self,
        client: httpx.AsyncClient,
        request_id: str,
    ) -> RequestResult:
        """Send a single request to the load balancer."""
        start_time = time.perf_counter()
        try:
            response = await client.post(
                self.lb_url,
                json={"id": request_id},
            )
            latency_ms = (time.perf_counter() - start_time) * 1000
            success = response.status_code == 200 and response.json().get("status") == "ok"
            return RequestResult(
                request_id=request_id,
                success=success,
                latency_ms=latency_ms,
                status_code=response.status_code,
            )
        except Exception:
            latency_ms = (time.perf_counter() - start_time) * 1000
            return RequestResult(
                request_id=request_id,
                success=False,
                latency_ms=latency_ms,
                status_code=None,
            )

    async def run(self, progress_callback=None) -> dict:
        """Run the test harness and return results.

        Sends requests at the configured RPS, collecting results.

        Args:
            progress_callback: Optional callable(current, total, success_rate) for progress updates
        """
        results = HarnessResults()

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for i in range(self.num_requests):
                start_time = time.perf_counter()

                # Generate unique request ID
                request_id = generate_request_id()

                # Send request
                result = await self.send_request(client, request_id)
                results.results.append(result)
                results.total_requests += 1
                results.latencies.append(result.latency_ms)

                if result.success:
                    results.successful += 1
                else:
                    results.failed += 1

                # Report progress
                if progress_callback:
                    progress_callback(i + 1, self.num_requests, results.success_rate)

                # Rate limiting: sleep to maintain RPS
                elapsed = time.perf_counter() - start_time
                sleep_time = max(0, self.interval - elapsed)
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)

        return results.to_dict()


async def main():
    """Run harness directly for testing."""
    harness = TestHarness(
        num_requests=100,
        rps=10,
        lb_url="http://localhost:8000/",
    )

    print("Running test harness...")
    results = await harness.run()
    print(f"Results: {results}")


if __name__ == "__main__":
    asyncio.run(main())
