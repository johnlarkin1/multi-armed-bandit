from fastapi import APIRouter

from flaky_load_balancer.csv_logger import get_csv_logger
from flaky_load_balancer.api.schema.runs import (
    RunInfo,
    RunListResponse,
    CurrentRunResponse,
)

router = APIRouter()


@router.get("/runs", response_model=RunListResponse)
async def list_runs() -> RunListResponse:
    csv_logger = get_csv_logger()
    runs = csv_logger.list_runs()

    return RunListResponse(
        runs=[
            RunInfo(
                run_id=run.run_id,
                session_id=run.session_id,
                config_target=run.config_target,
                strategy=run.strategy,
                started_at=run.started_at,
                ended_at=run.ended_at,
                total_requests=run.total_requests,
                total_attempts=run.total_attempts,
                is_current=run.is_current,
            )
            for run in runs
        ],
        current_run_id=csv_logger.get_current_run_id(),
    )


@router.get("/runs/current", response_model=CurrentRunResponse)
async def get_current_run() -> CurrentRunResponse:
    csv_logger = get_csv_logger()
    run_id = csv_logger.get_current_run_id()

    if not run_id:
        return CurrentRunResponse(
            run_id=None,
            strategy=None,
            active=False,
        )

    return CurrentRunResponse(
        run_id=run_id,
        strategy=csv_logger.get_current_strategy(),
        active=True,
    )
