"""CSV logging for per-attempt request tracking with multi-run support."""

import csv
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from flaky_load_balancer.paths import RUNS_DIR

CSV_HEADERS = [
    "session_id",
    "config_target",
    "request_number",
    "attempt_number",
    "request_id",
    "strategy",
    "timestamp",
    "server_port",
    "success",
    "latency_ms",
    "request_complete",
    "request_success",
    "rate_limited",
]


@dataclass
class AttemptRecord:
    """Record of a single request attempt."""

    session_id: str | None
    config_target: str
    request_number: int
    attempt_number: int
    request_id: str
    strategy: str
    timestamp: float
    server_port: int
    success: bool
    latency_ms: float
    request_complete: bool
    request_success: bool
    rate_limited: bool = False


@dataclass
class RunInfo:
    """Metadata about a simulation run."""

    run_id: str
    session_id: str | None
    config_target: str
    strategy: str
    started_at: float
    ended_at: float
    total_requests: int
    total_attempts: int
    is_current: bool


@dataclass
class SessionInfo:
    """Metadata about a session (group of related runs)."""

    session_id: str
    runs: list[RunInfo]
    started_at: float
    ended_at: float
    strategies: list[str]


class CSVLogger:
    """Thread-safe CSV logger for request attempts with multi-run support."""

    def __init__(self):
        self._lock = threading.Lock()
        self._request_counter = 0
        self._current_run_id: str | None = None
        self._current_session_id: str | None = None
        self._current_config_target: str | None = None
        self._current_path: Path | None = None
        self._current_strategy: str | None = None
        RUNS_DIR.mkdir(exist_ok=True)

    def start_new_run(self, strategy: str, session_id: str | None = None, config_target: str = "T1") -> str:
        """Start a new run with a unique ID. Returns the run_id."""
        with self._lock:
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            self._current_run_id = f"{timestamp}_{strategy}_{config_target}"
            self._current_session_id = session_id
            self._current_config_target = config_target
            self._current_path = RUNS_DIR / f"{self._current_run_id}.csv"
            self._current_strategy = strategy
            self._request_counter = 0
            self._init_file()
            return self._current_run_id

    def get_current_session_id(self) -> str | None:
        """Get the current session ID."""
        return self._current_session_id

    def get_current_config_target(self) -> str | None:
        """Get the current config target."""
        return self._current_config_target

    def _init_file(self) -> None:
        """Initialize CSV file with headers."""
        if self._current_path:
            with open(self._current_path, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(CSV_HEADERS)

    def get_current_run_id(self) -> str | None:
        """Get the current run ID."""
        return self._current_run_id

    def get_current_strategy(self) -> str | None:
        """Get the current run's strategy."""
        return self._current_strategy

    def new_request(self) -> int:
        """Increment and return the next request number."""
        with self._lock:
            self._request_counter += 1
            return self._request_counter

    def log_attempt(self, record: AttemptRecord) -> None:
        """Log a single attempt record to the current run's CSV file."""
        with self._lock:
            if not self._current_path:
                return
            with open(self._current_path, "a", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(
                    [
                        record.session_id or self._current_session_id or "",
                        record.config_target or self._current_config_target or "T1",
                        record.request_number,
                        record.attempt_number,
                        record.request_id,
                        record.strategy,
                        record.timestamp,
                        record.server_port,
                        record.success,
                        record.latency_ms,
                        record.request_complete,
                        record.request_success,
                        record.rate_limited,
                    ]
                )

    def list_runs(self) -> list[RunInfo]:
        """List all available runs with metadata."""
        runs = []
        for csv_file in sorted(RUNS_DIR.glob("*.csv"), reverse=True):
            run_id = csv_file.stem
            records = self._read_run_file(csv_file)
            if records:
                # Extract metadata from records
                session_id = records[0].get("session_id") or None
                config_target = records[0].get("config_target") or "T1"
                strategy = records[0]["strategy"]
                started_at = records[0]["timestamp"]
                ended_at = records[-1]["timestamp"]
                total_requests = max(r["request_number"] for r in records)
                total_attempts = len(records)
                runs.append(
                    RunInfo(
                        run_id=run_id,
                        config_target=config_target,
                        session_id=session_id,
                        strategy=strategy,
                        started_at=started_at,
                        ended_at=ended_at,
                        total_requests=total_requests,
                        total_attempts=total_attempts,
                        is_current=(run_id == self._current_run_id),
                    )
                )
        return runs

    def list_sessions(self) -> list[SessionInfo]:
        """List all sessions with their grouped runs."""
        runs = self.list_runs()

        # Group runs by session_id
        sessions_map: dict[str, list[RunInfo]] = {}
        for run in runs:
            if run.session_id:
                if run.session_id not in sessions_map:
                    sessions_map[run.session_id] = []
                sessions_map[run.session_id].append(run)

        # Build SessionInfo objects
        sessions = []
        for session_id, session_runs in sessions_map.items():
            # Sort runs by start time
            session_runs.sort(key=lambda r: r.started_at)
            strategies = [r.strategy for r in session_runs]
            sessions.append(
                SessionInfo(
                    session_id=session_id,
                    runs=session_runs,
                    started_at=session_runs[0].started_at,
                    ended_at=session_runs[-1].ended_at,
                    strategies=strategies,
                )
            )

        # Sort sessions by start time (most recent first)
        sessions.sort(key=lambda s: s.started_at, reverse=True)
        return sessions

    def read_run(self, run_id: str) -> list[dict]:
        """Read all records from a specific run."""
        path = RUNS_DIR / f"{run_id}.csv"
        return self._read_run_file(path)

    def read_current_run(self) -> list[dict]:
        """Read all records from the current run."""
        if not self._current_path:
            return []
        return self._read_run_file(self._current_path)

    def _read_run_file(self, path: Path) -> list[dict]:
        """Read all records from a CSV file."""
        with self._lock:
            if not path.exists():
                return []

            records = []
            with open(path, "r", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Handle both old files (without session_id/config_target/rate_limited) and new files
                    session_id = row.get("session_id", "") or None
                    config_target = row.get("config_target", "") or "T1"
                    rate_limited = row.get("rate_limited", "False") == "True"
                    records.append(
                        {
                            "session_id": session_id,
                            "config_target": config_target,
                            "request_number": int(row["request_number"]),
                            "attempt_number": int(row["attempt_number"]),
                            "request_id": row["request_id"],
                            "strategy": row["strategy"],
                            "timestamp": float(row["timestamp"]),
                            "server_port": int(row["server_port"]),
                            "success": row["success"] == "True",
                            "latency_ms": float(row["latency_ms"]),
                            "request_complete": row["request_complete"] == "True",
                            "request_success": row["request_success"] == "True",
                            "rate_limited": rate_limited,
                        }
                    )
            return records

    def reset(self) -> None:
        """Reset the logger state (does not delete existing runs)."""
        with self._lock:
            self._request_counter = 0
            self._current_run_id = None
            self._current_session_id = None
            self._current_config_target = None
            self._current_path = None
            self._current_strategy = None


# Global singleton
_logger: CSVLogger | None = None


def get_csv_logger() -> CSVLogger:
    global _logger
    if _logger is None:
        _logger = CSVLogger()
    return _logger
