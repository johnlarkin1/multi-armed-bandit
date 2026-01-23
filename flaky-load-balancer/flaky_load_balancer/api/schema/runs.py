from pydantic import BaseModel


class RunInfo(BaseModel):
    """Information about a single run."""

    run_id: str
    session_id: str | None = None
    config_target: str = ""
    strategy: str
    started_at: float
    ended_at: float = 0.0
    total_requests: int = 0
    total_attempts: int = 0
    is_current: bool = False


class RunListResponse(BaseModel):
    """Response for GET /runs."""

    runs: list[RunInfo]
    current_run_id: str | None = None


class CurrentRunResponse(BaseModel):
    """Response for GET /runs/current."""

    run_id: str | None = None
    strategy: str | None = None
    active: bool = False
