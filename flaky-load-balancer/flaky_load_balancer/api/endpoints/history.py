import statistics

from fastapi import APIRouter, Query

from flaky_load_balancer.csv_logger import get_csv_logger
from flaky_load_balancer.api.schema.history import (
    ServerMetricsResponse,
    MetricsSnapshot,
    HistoryResponse,
    HistorySnapshotsResponse,
)

router = APIRouter()


@router.get("/history", response_model=HistoryResponse)
async def get_history(run_id: str | None = Query(default=None)) -> HistoryResponse:
    csv_logger = get_csv_logger()

    if run_id:
        records = csv_logger.read_run(run_id)
    else:
        records = csv_logger.read_current_run()

    strategy = records[0]["strategy"] if records else None

    return HistoryResponse(
        records=records,
        strategy=strategy,
        run_id=run_id or csv_logger.get_current_run_id(),
    )


@router.get("/history/snapshots", response_model=HistorySnapshotsResponse)
async def get_history_snapshots(
    run_id: str | None = Query(default=None),
) -> HistorySnapshotsResponse:
    csv_logger = get_csv_logger()

    if run_id:
        records = csv_logger.read_run(run_id)
    else:
        records = csv_logger.read_current_run()

    resolved_run_id = run_id or csv_logger.get_current_run_id()

    if not records:
        return HistorySnapshotsResponse(snapshots=[], strategy=None, run_id=resolved_run_id)

    strategy = records[0]["strategy"]
    start_time = records[0]["timestamp"]

    snapshots: list[MetricsSnapshot] = []
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
        while record["timestamp"] >= current_window_start + window_size:
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

    return HistorySnapshotsResponse(snapshots=snapshots, strategy=strategy, run_id=resolved_run_id)


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
) -> MetricsSnapshot:
    latency_p50 = 0.0
    latency_p99 = 0.0
    if latencies:
        latency_p50 = statistics.median(latencies)
        if len(latencies) >= 2:
            latency_p99 = statistics.quantiles(latencies, n=100)[98]
        else:
            latency_p99 = latencies[0]

    per_server_out: dict[str, ServerMetricsResponse] = {}
    for port, stats in per_server.items():
        num_requests = stats["num_requests"]
        success_rate = stats["num_success"] / num_requests if num_requests > 0 else 0.0
        avg_latency = stats["total_latency_ms"] / num_requests if num_requests > 0 else 0.0
        per_server_out[str(port)] = ServerMetricsResponse(
            port=stats["port"],
            num_requests=num_requests,
            num_success=stats["num_success"],
            num_failure=stats["num_failure"],
            success_rate=round(success_rate, 4),
            avg_latency_ms=round(avg_latency, 2),
        )

    return MetricsSnapshot(
        type="metrics",
        timestamp=timestamp,
        strategy=strategy,
        run_id=run_id,
        total_requests=total_requests,
        total_success=total_success,
        total_failure=total_failure,
        total_retries=total_retries,
        total_penalty=total_penalty,
        global_regret=total_requests - total_success,
        best_guess_score=total_success - total_penalty,
        latency_p50=round(latency_p50, 2),
        latency_p99=round(latency_p99, 2),
        latencies=[round(lat, 2) for lat in latencies],
        per_server=per_server_out,
        last_update=timestamp,
    )
