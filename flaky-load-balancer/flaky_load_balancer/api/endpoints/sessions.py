import statistics

from fastapi import APIRouter

from flaky_load_balancer.csv_logger import get_csv_logger
from flaky_load_balancer.api.schema.sessions import (
    RunSummary,
    SessionInfo,
    SessionListResponse,
    SessionDetailResponse,
    SessionNotFoundResponse,
)

router = APIRouter()


def _compute_run_summary(run_id: str, records: list[dict]) -> RunSummary | None:
    if not records:
        return None

    strategy = records[0]["strategy"]
    total_requests = max(r["request_number"] for r in records)
    total_success = sum(1 for r in records if r["request_complete"] and r["request_success"])
    total_attempts = len(records)
    total_retries = total_attempts - total_requests
    total_penalty = sum(1 for r in records if r["attempt_number"] > 3)

    latencies = [r["latency_ms"] for r in records]
    latency_p50 = statistics.median(latencies) if latencies else 0
    latency_p99 = 0.0
    if len(latencies) >= 2:
        latency_p99 = statistics.quantiles(latencies, n=100)[98]
    elif latencies:
        latency_p99 = latencies[0]

    success_rate = total_success / total_requests if total_requests > 0 else 0
    score = total_success - total_penalty

    return RunSummary(
        run_id=run_id,
        strategy=strategy,
        total_requests=total_requests,
        total_success=total_success,
        success_rate=round(success_rate, 4),
        score=score,
        total_retries=total_retries,
        total_penalty=total_penalty,
        latency_p50=round(latency_p50, 2),
        latency_p99=round(latency_p99, 2),
    )


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions() -> SessionListResponse:
    csv_logger = get_csv_logger()
    sessions = csv_logger.list_sessions()

    return SessionListResponse(
        sessions=[
            SessionInfo(
                session_id=s.session_id,
                started_at=s.started_at,
                ended_at=s.ended_at,
                strategies=s.strategies,
                run_count=len(s.runs),
            )
            for s in sessions
        ]
    )


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: str,
) -> SessionDetailResponse | SessionNotFoundResponse:
    csv_logger = get_csv_logger()
    sessions = csv_logger.list_sessions()

    session = next((s for s in sessions if s.session_id == session_id), None)
    if not session:
        return SessionNotFoundResponse(session_id=session_id)

    comparison_data: list[RunSummary] = []
    for run in session.runs:
        records = csv_logger.read_run(run.run_id)
        summary = _compute_run_summary(run.run_id, records)
        if summary:
            comparison_data.append(summary)

    return SessionDetailResponse(
        session_id=session_id,
        started_at=session.started_at,
        ended_at=session.ended_at,
        strategies=session.strategies,
        runs=comparison_data,
    )
