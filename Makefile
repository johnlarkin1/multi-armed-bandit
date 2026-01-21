.PHONY: help install install-python install-dashboard \
        lint lint-python lint-typescript \
        format fmt format-python \
        typecheck typecheck-python typecheck-typescript \
        harness dashboard dashboard-build servers \
        clean favicon

# Default target - show help
.DEFAULT_GOAL := help

# Directories
FLB_DIR := flaky-load-balancer
DASHBOARD_DIR := $(FLB_DIR)/dashboard

help: ## Show this help message
	@echo "Multi-Armed Bandit Load Balancer - Available Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
# Installation
# =============================================================================

install: install-python install-dashboard ## Install all dependencies (Python + Node)

install-python: ## Install Python dependencies with uv
	cd $(FLB_DIR) && uv sync

install-dashboard: ## Install dashboard npm dependencies
	cd $(DASHBOARD_DIR) && npm install

# =============================================================================
# Linting
# =============================================================================

lint: lint-python lint-typescript ## Run all linters

lint-python: ## Run ruff linter on Python code
	cd $(FLB_DIR) && uv run ruff check .

lint-typescript: ## Run eslint on TypeScript code
	cd $(DASHBOARD_DIR) && npm run lint

# =============================================================================
# Type Checking
# =============================================================================

typecheck: typecheck-python typecheck-typescript ## Run all type checkers

typecheck-python: ## Run mypy on Python code
	cd $(FLB_DIR) && uv run --with mypy mypy flaky_load_balancer --ignore-missing-imports

typecheck-typescript: ## Run TypeScript compiler for type checking
	cd $(DASHBOARD_DIR) && npx tsc --noEmit

# =============================================================================
# Formatting
# =============================================================================

format: format-python ## Format all code

fmt: format ## Alias for format

format-python: ## Format Python code with ruff
	cd $(FLB_DIR) && uv run ruff format .

# =============================================================================
# Running Services
# =============================================================================

harness: ## Run the full test harness (servers + LB + dashboard + tests)
	cd $(FLB_DIR) && uv run flb start harness

dashboard: ## Start the Next.js dashboard dev server
	cd $(FLB_DIR) && uv run flb start dashboard

dashboard-build: ## Build the dashboard for production
	cd $(DASHBOARD_DIR) && npm run build

servers: ## Start the flaky downstream servers
	cd $(FLB_DIR) && uv run flb start flaky-servers

# =============================================================================
# Utilities
# =============================================================================

favicon: ## Copy favicon assets to dashboard public folder
	cp favicon/*.png favicon/*.svg favicon/*.ico $(DASHBOARD_DIR)/public/

clean: ## Clean build artifacts and caches
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
