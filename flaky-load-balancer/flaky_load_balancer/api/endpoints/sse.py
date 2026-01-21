import asyncio
import statistics
import time
from dataclasses import asdict
from typing import AsyncGenerator, Any

import orjson
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from flaky_load_balancer.config import LB_STRATEGY
from flaky_load_balancer.csv_logger import get_csv_logger
from flaky_load_balancer.metrics import get_metrics_collector
from flaky_load_balancer.constants import SSE_INTERVAL_SECONDS
from flaky_load_balancer.api.schema.sse import SSEData

router = APIRouter()


def format_sse_event(event_type: str, data: SSEData) -> str:
    return f"event: {event_type}\ndata: {orjson.dumps(data).decode()}\n\n"


async def metrics_event_generator() -> AsyncGenerator[str, None]:
    collector = get_metrics_collector()
    csv_logger = get_csv_logger()
    last_update = 0.0

    initial_data: SSEData = {
        "type": "connected",
        "strategy": LB_STRATEGY,
        "run_id": csv_logger.get_current_run_id(),
        "timestamp": time.time(),
    }
    yield format_sse_event("connected", initial_data)

    while True:
        try:
            metrics = collector.metrics
            current_update = metrics.last_update
            if current_update > last_update:
                last_update = current_update

                data: SSEData = {
                    "type": "metrics",
                    "run_id": csv_logger.get_current_run_id(),
                    "timestamp": current_update,
                    "strategy": LB_STRATEGY,
                    **metrics.to_dict(),
                }
                yield format_sse_event("metrics", data)

            await asyncio.sleep(SSE_INTERVAL_SECONDS)

        except asyncio.CancelledError:
            break
        except Exception:
            yield format_sse_event("heartbeat", {})
            await asyncio.sleep(SSE_INTERVAL_SECONDS)


@router.get("/events")
async def stream_metrics():
    return StreamingResponse(
        metrics_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/snapshot")
async def get_snapshot():
    collector = get_metrics_collector()
    csv_logger = get_csv_logger()
    return {
        "strategy": LB_STRATEGY,
        "run_id": csv_logger.get_current_run_id(),
        "timestamp": time.time(),
        **collector.metrics.to_dict(),
    }


@router.get("/runs")
async def list_runs():
    csv_logger = get_csv_logger()
    runs = csv_logger.list_runs()

    return {
        "runs": [asdict(run) for run in runs],
        "current_run_id": csv_logger.get_current_run_id(),
    }


@router.get("/runs/current")
async def get_current_run():
    csv_logger = get_csv_logger()
    run_id = csv_logger.get_current_run_id()

    if not run_id:
        return {
            "run_id": None,
            "strategy": None,
            "active": False,
        }

    return {
        "run_id": run_id,
        "strategy": csv_logger.get_current_strategy(),
        "active": True,
    }


@router.get("/history")
async def get_history(run_id: str | None = Query(default=None)):
    csv_logger = get_csv_logger()

    if run_id:
        records = csv_logger.read_run(run_id)
    else:
        records = csv_logger.read_current_run()

    strategy = records[0]["strategy"] if records else None

    return {
        "records": records,
        "strategy": strategy,
        "run_id": run_id or csv_logger.get_current_run_id(),
    }


@router.get("/history/snapshots")
async def get_history_snapshots(run_id: str | None = Query(default=None)):
    csv_logger = get_csv_logger()

    if run_id:
        records = csv_logger.read_run(run_id)
    else:
        records = csv_logger.read_current_run()

    resolved_run_id = run_id or csv_logger.get_current_run_id()

    if not records:
        return {"snapshots": [], "strategy": None, "run_id": resolved_run_id}

    strategy = records[0]["strategy"]
    start_time = records[0]["timestamp"]

    snapshots = []
    window_size = 0.5

    total_requests = 0
    total_success = 0
    total_failure = 0
    total_retries = 0
    total_penalty = 0
    latencies: list[float] = []
    per_server: dict[int, dict] = {}

    current_window_start = start_time
    pending_records: list[dict] = []

    for record in records:
        # have we moved to a new window?
        while record["timestamp"] >= current_window_start + window_size:
            # emit if we have enough data
            if pending_records:
                snapshot = _build_snapshot(
                    timestamp=current_window_start + window_size,
                    strategy=strategy,
                    run_id=resolved_run_id,
                    total_requests=total_requests,
                    total_success=total_success,
                    total_failure=total_failure,
                    total_retries=total_retries,
                    total_penalty=total_penalty,
                    latencies=latencies.copy(),
                    per_server=per_server.copy(),
                )
                snapshots.append(snapshot)
                pending_records = []

            current_window_start += window_size

        port = record["server_port"]
        if port not in per_server:
            per_server[port] = {
                "port": port,
                "num_requests": 0,
                "num_success": 0,
                "num_failure": 0,
                "total_latency_ms": 0.0,
            }

        per_server[port]["num_requests"] += 1
        per_server[port]["total_latency_ms"] += record["latency_ms"]
        if record["success"]:
            per_server[port]["num_success"] += 1
        else:
            per_server[port]["num_failure"] += 1

        latencies.append(record["latency_ms"])

        if record["attempt_number"] > 1:
            total_retries += 1
        if record["attempt_number"] > 3:
            total_penalty += 1
        if record["request_complete"]:
            total_requests += 1
            if record["request_success"]:
                total_success += 1
            else:
                total_failure += 1

        pending_records.append(record)

    if pending_records:
        snapshot = _build_snapshot(
            timestamp=records[-1]["timestamp"],
            strategy=strategy,
            run_id=resolved_run_id,
            total_requests=total_requests,
            total_success=total_success,
            total_failure=total_failure,
            total_retries=total_retries,
            total_penalty=total_penalty,
            latencies=latencies,
            per_server=per_server,
        )
        snapshots.append(snapshot)

    return {"snapshots": snapshots, "strategy": strategy, "run_id": resolved_run_id}


def _build_snapshot(
    timestamp: float,
    strategy: str,
    run_id: str | None,
    total_requests: int,
    total_success: int,
    total_failure: int,
    total_retries: int,
    total_penalty: int,
    latencies: list[float],
    per_server: dict[int, dict],
) -> dict:
    latency_p50 = 0.0
    latency_p99 = 0.0
    if latencies:
        latency_p50 = statistics.median(latencies)
        if len(latencies) >= 2:
            latency_p99 = statistics.quantiles(latencies, n=100)[98]
        else:
            latency_p99 = latencies[0]

    per_server_out: dict[str, dict[str, Any]] = {}
    for port, stats in per_server.items():
        per_server_out[str(port)] = stats.to_dict()

    return {
        "type": "metrics",
        "timestamp": timestamp,
        "strategy": strategy,
        "run_id": run_id,
        "total_requests": total_requests,
        "total_success": total_success,
        "total_failure": total_failure,
        "total_retries": total_retries,
        "total_penalty": total_penalty,
        "global_regret": total_requests - total_success,
        "best_guess_score": total_success - total_penalty,
        "latency_p50": round(latency_p50, 2),
        "latency_p99": round(latency_p99, 2),
        "latencies": [round(lat, 2) for lat in latencies],
        "per_server": per_server_out,
        "last_update": timestamp,
    }


def _compute_run_summary(records: list[dict]) -> dict:
    if not records:
        return {}

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

    return {
        "strategy": strategy,
        "total_requests": total_requests,
        "total_success": total_success,
        "success_rate": round(success_rate, 4),
        "score": score,
        "total_retries": total_retries,
        "total_penalty": total_penalty,
        "latency_p50": round(latency_p50, 2),
        "latency_p99": round(latency_p99, 2),
    }


@router.get("/sessions")
async def list_sessions():
    csv_logger = get_csv_logger()
    sessions = csv_logger.list_sessions()

    return {
        "sessions": [
            {
                "session_id": s.session_id,
                "started_at": s.started_at,
                "ended_at": s.ended_at,
                "strategies": s.strategies,
                "run_count": len(s.runs),
            }
            for s in sessions
        ]
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    csv_logger = get_csv_logger()
    sessions = csv_logger.list_sessions()

    # Find the requested session
    session = next((s for s in sessions if s.session_id == session_id), None)
    if not session:
        return {"error": "Session not found", "session_id": session_id}

    comparison_data = []
    for run in session.runs:
        records = csv_logger.read_run(run.run_id)
        summary = _compute_run_summary(records)
        comparison_data.append(
            {
                "run_id": run.run_id,
                **summary,
            }
        )

    return {
        "session_id": session_id,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "strategies": session.strategies,
        "runs": comparison_data,
    }
