from typing import TypedDict, Any


class SSEData(TypedDict):
    type: str
    run_id: str
    timestamp: float
    strategy: str
    metrics: dict[str, Any]
