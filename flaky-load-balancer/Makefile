.PHONY: help favicon harness lb server dashboard dashboard-build dashboard-install servers install lint format

# Default target - show help
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Flaky Load Balancer - Available Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

favicon: ## Copy favicon assets to dashboard public folder
	cp ../favicon/*.png ../favicon/*.svg ../favicon/*.ico dashboard/public/

harness: ## Run the full test harness (servers + LB + dashboard + tests)
	uv run flb start harness

lb: ## Start just the FastAPI load balancer server
	LB_STRATEGY=v4 uv run uvicorn flaky_load_balancer.main:app --reload

server: lb ## Alias for 'lb'

dashboard: ## Start the Next.js dashboard dev server
	uv run flb start dashboard

dashboard-build: ## Build the dashboard for production
	cd dashboard && npm run build

dashboard-install: ## Install dashboard npm dependencies
	cd dashboard && npm install

servers: ## Start the flaky downstream servers
	uv run flb start flaky-servers

install: ## Install all dependencies (Python + Node)
	uv sync
	cd dashboard && npm install

lint: ## Run ruff linter
	uv run ruff check .

format: ## Format code with ruff
	uv run ruff format .
