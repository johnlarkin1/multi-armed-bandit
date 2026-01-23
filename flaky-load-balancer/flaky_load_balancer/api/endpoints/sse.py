import asyncio
import time
from typing import AsyncGenerator

import orjson
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from flaky_load_balancer.config import LB_STRATEGY
from flaky_load_balancer.csv_logger import get_csv_logger
from flaky_load_balancer.metrics import get_metrics_collector
from flaky_load_balancer.constants import SSE_INTERVAL_SECONDS
from flaky_load_balancer.api.schema.sse import (
    SSEConnectedEvent,
    SSEMetricsEvent,
    SnapshotResponse,
)
from flaky_load_balancer.api.schema.history import ServerMetricsResponse

router = APIRouter()


def format_sse_event(event_type: str, data: SSEConnectedEvent | SSEMetricsEvent | dict) -> str:
    if isinstance(data, dict):
        json_data = orjson.dumps(data).decode()
    else:
        json_data = data.model_dump_json()
    return f"event: {event_type}\ndata: {json_data}\n\n"


async def metrics_event_generator() -> AsyncGenerator[str, None]:
    collector = get_metrics_collector()
    csv_logger = get_csv_logger()
    last_update = 0.0

    initial_data = SSEConnectedEvent(
        type="connected",
        strategy=LB_STRATEGY,
        run_id=csv_logger.get_current_run_id(),
        timestamp=time.time(),
    )
    yield format_sse_event("connected", initial_data)

    while True:
        try:
            metrics = collector.metrics
            current_update = metrics.last_update
            if current_update > last_update:
                last_update = current_update

                per_server = {
                    str(port): ServerMetricsResponse(
                        port=server_metrics.port,
                        num_requests=server_metrics.num_requests,
                        num_success=server_metrics.num_success,
                        num_failure=server_metrics.num_failure,
                        num_rate_limited=server_metrics.num_rate_limited,
                        success_rate=round(server_metrics.success_rate, 4),
                        avg_latency_ms=round(server_metrics.avg_latency_ms, 2),
                    )
                    for port, server_metrics in metrics.per_server.items()
                }

                data = SSEMetricsEvent(
                    type="metrics",
                    strategy=LB_STRATEGY,
                    run_id=csv_logger.get_current_run_id(),
                    timestamp=current_update,
                    total_requests=metrics.total_requests,
                    total_success=metrics.total_success,
                    total_failure=metrics.total_failure,
                    total_retries=metrics.total_retries,
                    total_penalty=metrics.total_penalty,
                    total_rate_limited=metrics.total_rate_limited,
                    global_regret=metrics.global_regret,
                    best_guess_score=metrics.best_guess_score,
                    latency_p50=round(metrics.latency_p50, 2),
                    latency_p99=round(metrics.latency_p99, 2),
                    latencies=[round(lat, 2) for lat in metrics.latencies],
                    per_server=per_server,
                    last_update=metrics.last_update,
                )
                yield format_sse_event("metrics", data)

            await asyncio.sleep(SSE_INTERVAL_SECONDS)

        except asyncio.CancelledError:
            break
        except Exception:
            yield format_sse_event("heartbeat", {})
            await asyncio.sleep(SSE_INTERVAL_SECONDS)


@router.get("/events")
async def stream_metrics():
    # note, the `x-accel-buffering` is almost certainly not needed
    # it's really just an extra flag for NGINX to ensure that we're not waiting
    # to buffer and we're processing things immediately (important for the SSE)
    return StreamingResponse(
        metrics_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/snapshot", response_model=SnapshotResponse)
async def get_snapshot() -> SnapshotResponse:
    collector = get_metrics_collector()
    csv_logger = get_csv_logger()
    metrics = collector.metrics

    return SnapshotResponse(
        strategy=LB_STRATEGY,
        run_id=csv_logger.get_current_run_id(),
        timestamp=time.time(),
        total_requests=metrics.total_requests,
        total_success=metrics.total_success,
        total_failure=metrics.total_failure,
        total_retries=metrics.total_retries,
        total_penalty=metrics.total_penalty,
        total_rate_limited=metrics.total_rate_limited,
        global_regret=metrics.global_regret,
        best_guess_score=metrics.best_guess_score,
        latency_p50=round(metrics.latency_p50, 2),
        latency_p99=round(metrics.latency_p99, 2),
        latencies=[round(lat, 2) for lat in metrics.latencies],
        per_server={str(port): m.to_dict() for port, m in metrics.per_server.items()},
        last_update=metrics.last_update,
    )
