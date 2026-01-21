/**
 * Environment configuration for the Next.js dashboard.
 */

export const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
export const RUNS_DIR = process.env.RUNS_DIR || '../runs';
export const METRICS_JSON_PATH = process.env.METRICS_JSON_PATH || '../metrics.json';

// Timeout for checking FastAPI availability (ms)
export const FASTAPI_TIMEOUT = 2000;

// SSE interval (ms)
export const SSE_INTERVAL = 500;

// Snapshot window size (seconds)
export const SNAPSHOT_WINDOW_SIZE = 0.5;
