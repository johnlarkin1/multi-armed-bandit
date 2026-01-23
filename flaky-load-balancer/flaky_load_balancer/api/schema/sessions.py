from pydantic import BaseModel


class RunSummary(BaseModel):
    """Summary statistics for a run."""

    run_id: str
    strategy: str
    total_requests: int = 0
    total_success: int = 0
    success_rate: float = 0.0
    score: int = 0
    total_retries: int = 0
    total_penalty: int = 0
    latency_p50: float = 0.0
    latency_p99: float = 0.0


class SessionInfo(BaseModel):
    """Brief session information for list view."""

    session_id: str
    started_at: float
    ended_at: float | None = None
    strategies: list[str]
    run_count: int = 0


class SessionListResponse(BaseModel):
    """Response for GET /sessions."""

    sessions: list[SessionInfo]


class SessionDetailResponse(BaseModel):
    """Response for GET /sessions/{session_id}."""

    session_id: str
    started_at: float
    ended_at: float | None = None
    strategies: list[str]
    runs: list[RunSummary]


class SessionNotFoundResponse(BaseModel):
    """Response when session is not found."""

    error: str = "Session not found"
    session_id: str
