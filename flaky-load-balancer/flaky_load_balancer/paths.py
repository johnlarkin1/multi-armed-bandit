"""Centralized path constants for the flaky load balancer."""

from pathlib import Path

# Package root directory
PACKAGE_ROOT = Path(__file__).parent.parent

# Metrics file path (relative to working directory)
METRICS_PATH = Path("metrics.json")

# Runs directory for CSV logs (relative to working directory)
RUNS_DIR = Path("runs")

# Path to dashboard directory
DASHBOARD_PATH = PACKAGE_ROOT / "dashboard"

# Path to failingserver binary (in resources directory)
FAILINGSERVER_PATH = PACKAGE_ROOT / "resources" / "failingserver"
