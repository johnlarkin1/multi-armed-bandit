import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from flaky_load_balancer.api.routes import router
from flaky_load_balancer.config import LB_STRATEGY
from flaky_load_balancer.csv_logger import get_csv_logger
from flaky_load_balancer.http_client import close_client
from flaky_load_balancer.metrics import get_metrics_collector
from flaky_load_balancer.middleware import LoggingMiddleware
from flaky_load_balancer.strategies.factory import init_strategy

# Session ID for grouping multiple strategy runs together
LB_SESSION_ID = os.environ.get("LB_SESSION_ID")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown."""
    # Startup: initialize strategy and start a new run
    init_strategy(LB_STRATEGY, config_target="T1")
    run_id = get_csv_logger().start_new_run(LB_STRATEGY, session_id=LB_SESSION_ID)
    get_metrics_collector().reset()  # Reset metrics
    print(f"Started new run: {run_id}" + (f" (session: {LB_SESSION_ID})" if LB_SESSION_ID else ""))
    yield
    # Shutdown: close HTTP client
    await close_client()


app = FastAPI(title="Flaky Load Balancer", lifespan=lifespan)

# CORS middleware for React dashboard on port 3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(LoggingMiddleware)
app.include_router(router)


@app.get("/health")
def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
