from fastapi import APIRouter

from flaky_load_balancer.api.endpoints import root, sse, runs, history, sessions


router = APIRouter()

router.include_router(root.router, tags=["root"])
router.include_router(sse.router, prefix="/api", tags=["sse"])
router.include_router(runs.router, prefix="/api", tags=["runs"])
router.include_router(history.router, prefix="/api", tags=["history"])
router.include_router(sessions.router, prefix="/api", tags=["sessions"])
