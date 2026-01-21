from fastapi import APIRouter

from flaky_load_balancer.api.endpoints import root, sse


router = APIRouter()

router.include_router(root.router, tags=["root"])
router.include_router(sse.router, prefix="/api", tags=["sse"])
