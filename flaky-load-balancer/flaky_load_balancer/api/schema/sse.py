from pydantic import BaseModel, Field

from flaky_load_balancer.api.schema.history import MetricsSnapshot


class SSEConnectedEvent(BaseModel):
    """SSE connected event payload."""

    type: str = "connected"
    strategy: str
    run_id: str | None = None
    timestamp: float


class SSEMetricsEvent(MetricsSnapshot):
    """SSE metrics event payload."""

    pass


class SnapshotResponse(BaseModel):
    """Response for GET /snapshot."""

    strategy: str
    run_id: str | None = None
    timestamp: float
    total_requests: int = 0
    total_success: int = 0
    total_failure: int = 0
    total_retries: int = 0
    total_penalty: int = 0
    global_regret: int = 0
    best_guess_score: int = 0
    latency_p50: float = 0.0
    latency_p99: float = 0.0
    latencies: list[float] = Field(default_factory=list)
    per_server: dict[str, dict] = Field(default_factory=dict)
    last_update: float = 0.0
