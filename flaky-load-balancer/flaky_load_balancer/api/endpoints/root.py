import time

from fastapi import APIRouter

from flaky_load_balancer.api.schema.root import RootRequest, RootResponse
from flaky_load_balancer.config import LB_STRATEGY
from flaky_load_balancer.constants import (
    MAX_ATTEMPTS,
    PENALTY_FREE_ATTEMPTS,
    ROOT_ENDPOINT,
)
from flaky_load_balancer.csv_logger import AttemptRecord, get_csv_logger
from flaky_load_balancer.http_client import send_request
from flaky_load_balancer.metrics import get_metrics_collector
from flaky_load_balancer.strategies.factory import get_current_strategy

router = APIRouter()


@router.post(
    ROOT_ENDPOINT,
    response_model=RootResponse,
)
async def post_root(request: RootRequest) -> RootResponse:
    strategy = get_current_strategy()
    metrics = get_metrics_collector()
    csv_logger = get_csv_logger()
    tried_servers: set[int] = set()
    attempt = 0

    request_number = csv_logger.new_request()

    # I chose 6 basically arbitrarily, but was also trying to be cognizant if
    # each request is taking 2ms, 6*2ms = 12ms which is a little more than 10ms
    # and then 10RPS so 10*12ms = 120ms so that leaves us a healthy buffer
    # for appropriate processing time
    while attempt < MAX_ATTEMPTS:
        if attempt < PENALTY_FREE_ATTEMPTS:
            # if we're under our penalty free attempts let's try to explore
            port = strategy.select_server(excluded=tried_servers, attempt=attempt)
            tried_servers.add(port)
        else:
            # ok if we're going to get penalized let's just use the best known server
            port = strategy.get_best_server()

        timestamp = time.time()
        success, latency = await send_request(port, request.id)
        strategy.update(port, success, latency)
        metrics.record_request(port, success, latency, attempt)

        is_final_attempt = success or attempt == MAX_ATTEMPTS - 1
        csv_logger.log_attempt(
            AttemptRecord(
                session_id=csv_logger.get_current_session_id(),
                request_number=request_number,
                attempt_number=attempt + 1,
                request_id=request.id,
                strategy=LB_STRATEGY,
                timestamp=timestamp,
                server_port=port,
                success=success,
                latency_ms=latency,
                request_complete=is_final_attempt,
                request_success=success if is_final_attempt else False,
            )
        )

        if success:
            metrics.record_request_complete(success=True)
            await metrics.write_metrics()
            return RootResponse(status="ok")

        attempt += 1

    metrics.record_request_complete(success=False)
    await metrics.write_metrics()
    return RootResponse(status="error")
