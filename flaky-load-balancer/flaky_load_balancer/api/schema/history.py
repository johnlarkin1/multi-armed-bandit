from pydantic import BaseModel, Field


class ServerMetricsResponse(BaseModel):
    """Per-server metrics in API responses."""

    port: int
    num_requests: int = 0
    num_success: int = 0
    num_failure: int = 0
    num_rate_limited: int = 0
    success_rate: float = 0.0
    avg_latency_ms: float = 0.0


class MetricsSnapshot(BaseModel):
    """Metrics snapshot for SSE events and history."""

    type: str = "metrics"
    timestamp: float
    strategy: str
    run_id: str | None = None
    total_requests: int = 0
    total_success: int = 0
    total_failure: int = 0
    total_retries: int = 0
    total_penalty: int = 0
    total_rate_limited: int = 0
    global_regret: int = 0
    best_guess_score: int = 0
    latency_p50: float = 0.0
    latency_p99: float = 0.0
    latencies: list[float] = Field(default_factory=list)
    per_server: dict[str, ServerMetricsResponse] = Field(default_factory=dict)
    last_update: float = 0.0


class HistoryResponse(BaseModel):
    """Response for GET /history."""

    records: list[dict]
    strategy: str | None = None
    run_id: str | None = None


class HistorySnapshotsResponse(BaseModel):
    """Response for GET /history/snapshots."""

    snapshots: list[MetricsSnapshot]
    strategy: str | None = None
    run_id: str | None = None
