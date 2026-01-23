import asyncio
import statistics
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import orjson

from flaky_load_balancer.paths import METRICS_PATH as DEFAULT_METRICS_PATH


@dataclass
class ServerMetrics:
    """Per-server metrics."""

    port: int
    num_requests: int = 0
    num_success: int = 0
    num_failure: int = 0
    num_rate_limited: int = 0
    total_latency_ms: float = 0.0

    @property
    def success_rate(self) -> float:
        if self.num_requests == 0:
            return 0.0
        return self.num_success / self.num_requests

    @property
    def avg_latency_ms(self) -> float:
        if self.num_requests == 0:
            return 0.0
        return self.total_latency_ms / self.num_requests

    def to_dict(self) -> dict[str, Any]:
        return {
            "port": self.port,
            "num_requests": self.num_requests,
            "num_success": self.num_success,
            "num_failure": self.num_failure,
            "num_rate_limited": self.num_rate_limited,
            "success_rate": round(self.success_rate, 4),
            "avg_latency_ms": round(self.avg_latency_ms, 2),
        }


@dataclass
class Metrics:
    """Global metrics for the load balancer."""

    # Request counts
    total_requests: int = 0
    total_success: int = 0
    total_failure: int = 0
    total_retries: int = 0
    total_rate_limited: int = 0

    # Penalty tracking (attempts > 3 per request)
    total_penalty: int = 0

    # Latency tracking
    latencies: list[float] = field(default_factory=list)

    # Per-server metrics
    per_server: dict[int, ServerMetrics] = field(default_factory=dict)

    # Timestamp of last update
    last_update: float = 0.0

    @property
    def global_regret(self) -> int:
        """Regret = optimal - actual successes. Assuming optimal = total_requests."""
        return self.total_requests - self.total_success

    @property
    def best_guess_score(self) -> int:
        """Score = successes - penalty for retries > 3."""
        return self.total_success - self.total_penalty

    @property
    def latency_p50(self) -> float:
        if not self.latencies:
            return 0.0
        return statistics.median(self.latencies)

    @property
    def latency_p99(self) -> float:
        if not self.latencies:
            return 0.0
        # quantiles needs at least 2 data points
        if len(self.latencies) < 2:
            return self.latencies[0]
        return statistics.quantiles(self.latencies, n=100)[98]

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_requests": self.total_requests,
            "total_success": self.total_success,
            "total_failure": self.total_failure,
            "total_retries": self.total_retries,
            "total_rate_limited": self.total_rate_limited,
            "total_penalty": self.total_penalty,
            "global_regret": self.global_regret,
            "best_guess_score": self.best_guess_score,
            "latency_p50": round(self.latency_p50, 2),
            "latency_p99": round(self.latency_p99, 2),
            # Raw latencies for histogram visualization
            "latencies": [round(lat, 2) for lat in self.latencies],
            # orjson requires string keys, so convert port ints to strings
            "per_server": {str(port): metrics.to_dict() for port, metrics in self.per_server.items()},
            "last_update": self.last_update,
        }


class MetricsCollector:
    """Collects and persists metrics for the load balancer."""

    def __init__(self, metrics_path: Path = DEFAULT_METRICS_PATH):
        self.metrics_path = metrics_path
        self.metrics = Metrics()
        self._lock = asyncio.Lock()

    def record_request(
        self,
        port: int,
        success: bool,
        latency_ms: float,
        attempt: int,
        rate_limited: bool = False,
    ) -> None:
        """Record metrics for a single request attempt.

        Args:
            port: The downstream server port
            success: Whether the request succeeded
            latency_ms: Request latency in milliseconds
            attempt: Which attempt this was (0-indexed)
            rate_limited: Whether the request was rate-limited (429)
        """
        # Update per-server metrics
        if port not in self.metrics.per_server:
            self.metrics.per_server[port] = ServerMetrics(port=port)

        server_metrics = self.metrics.per_server[port]
        server_metrics.num_requests += 1
        server_metrics.total_latency_ms += latency_ms
        if rate_limited:
            server_metrics.num_rate_limited += 1
            self.metrics.total_rate_limited += 1
        elif success:
            server_metrics.num_success += 1
        else:
            server_metrics.num_failure += 1

        # Update global retry count (if this isn't the first attempt)
        if attempt > 0:
            self.metrics.total_retries += 1

        # Track penalty (attempts beyond 3)
        if attempt >= 3:
            self.metrics.total_penalty += 1

        # Track latency
        self.metrics.latencies.append(latency_ms)

    def record_request_complete(self, success: bool) -> None:
        """Record the final outcome of a request (after all retries).

        Args:
            success: Whether the request ultimately succeeded
        """
        self.metrics.total_requests += 1
        if success:
            self.metrics.total_success += 1
        else:
            self.metrics.total_failure += 1
        self.metrics.last_update = time.time()

    async def write_metrics(self) -> None:
        """Write current metrics to the JSON file."""
        async with self._lock:
            data = self.metrics.to_dict()
            json_bytes = orjson.dumps(data, option=orjson.OPT_INDENT_2)
            self.metrics_path.write_bytes(json_bytes)

    def write_metrics_sync(self) -> None:
        """Synchronous version of write_metrics for non-async contexts."""
        data = self.metrics.to_dict()
        json_bytes = orjson.dumps(data, option=orjson.OPT_INDENT_2)
        self.metrics_path.write_bytes(json_bytes)

    def reset(self) -> None:
        """Reset all metrics."""
        self.metrics = Metrics()


# Global metrics collector instance
_collector: MetricsCollector | None = None


def get_metrics_collector() -> MetricsCollector:
    """Get or create the global metrics collector."""
    global _collector
    if _collector is None:
        _collector = MetricsCollector()
    return _collector


def init_metrics_collector(metrics_path: Path = DEFAULT_METRICS_PATH) -> MetricsCollector:
    """Initialize the global metrics collector with a custom path."""
    global _collector
    _collector = MetricsCollector(metrics_path)
    return _collector
