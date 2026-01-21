# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Note:** This codebase is actively evolving - core code may change significantly.

## Project Overview

Multi-Armed Bandit Load Balancer - an adaptive request routing system that distributes requests across flaky downstream servers using various exploration/exploitation algorithms. The goal is to maximize successful requests while minimizing retry penalties.

## Build & Run Commands

```bash
# Package manager: uv
cd flaky-load-balancer

# Install dependencies
uv sync

# Run the load balancer (strategy required)
LB_STRATEGY=v4_thompson uv run uvicorn flaky_load_balancer.main:app --reload

# CLI tools (after install)
uv run flb                    # Main testing harness (fires 10 RPS)
uv run flb-visualizer         # Real-time metrics visualization
uv run flb-compare            # Side-by-side strategy comparison

# Lint
uv run ruff check .
uv run ruff format .
```

## Architecture

```
flaky-load-balancer/flaky_load_balancer/
├── main.py              # FastAPI app with lifespan management
├── cli.py               # Rich CLI harness
├── config.py            # LB_STRATEGY env var config
├── constants.py         # ServerConfig, ServerStats dataclasses
├── metrics.py           # MetricsCollector (persists to metrics.json)
├── harness.py           # TestHarness (10 RPS request generator)
├── http_client.py       # Async httpx client with connection pooling
├── api/
│   └── endpoints/root.py  # POST / - core load balancer logic
└── strategies/
    ├── base.py          # BaseStrategy abstract class
    ├── factory.py       # get_strategy() factory
    ├── v1_larkin.py     # Explore-then-exploit with Beta variance
    ├── v2_ucb.py        # Upper Confidence Bound (UCB1)
    ├── v3_ucb_modified.py  # UCB with attempt-based exploration
    ├── v4_thompson.py   # Thompson Sampling (Beta distribution)
    └── v5_thompson_modified.py  # Thompson with variance scaling
```

## Core Domain Logic

- **10 RPS throughput** target
- **6 max attempts** per request, first **3 are penalty-free**
- **Downstream servers**: T1 (ports 4000-4009), T2 (5000-5009), T3 (6000-6009)
- **Score formula**: `successful_requests - (penalty_retries * 0.5)`

Request flow: POST / → strategy selects server → forward to downstream → update metrics → retry or return

## Strategy Pattern

All strategies inherit from `BaseStrategy` with:
- `select_server(servers, attempt_number) -> str` - pick server URL
- `update(server_url, success, latency)` - record outcome

Select strategy via `LB_STRATEGY` env var: `v1_larkin`, `v2_ucb`, `v3_ucb_modified`, `v4_thompson`, `v5_thompson_modified`

## Code Conventions

- **Async-first**: All HTTP ops use async/await with httpx
- **Type hints**: Python 3.13+ style annotations throughout
- **Dataclasses**: Domain models (ServerConfig, ServerStats)
- **Global singletons**: Strategy and MetricsCollector via factory
- **Metrics persistence**: JSON file for inter-process communication
- **Ruff config**: 120 char lines, complexity max 20

## External Dependencies

The `failingserver` binary (in `flaky-load-balancer/resources/`) provides the flaky downstream servers for testing.
