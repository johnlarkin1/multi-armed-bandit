#!/usr/bin/env python3
"""Rich CLI for the Flaky Load Balancer testing harness."""

import argparse
import asyncio
import os
import socket
import subprocess
import sys
import time
from datetime import datetime

import orjson
from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TaskProgressColumn, TextColumn, TimeRemainingColumn
from rich.prompt import IntPrompt, Prompt
from rich.table import Table

from flaky_load_balancer.constants import CONFIG_PORTS
from flaky_load_balancer.paths import DASHBOARD_PATH, FAILINGSERVER_PATH, METRICS_PATH, PACKAGE_ROOT
from flaky_load_balancer.strategies.enum import LoadBalancerStrategy

console = Console()


def collect_metrics_snapshot() -> dict | None:
    """Collect a single snapshot of the current metrics."""
    if not METRICS_PATH.exists():
        return None

    try:
        return orjson.loads(METRICS_PATH.read_bytes())
    except Exception:
        return None


def enrich_results_from_metrics(results: dict) -> dict:
    """Enrich harness results with data from metrics.json.

    The harness doesn't track internal retries - those happen inside the
    load balancer. This function reads the actual metrics to get accurate
    retry counts and scores.
    """
    if not METRICS_PATH.exists():
        return results

    try:
        metrics = orjson.loads(METRICS_PATH.read_bytes())

        # Override with actual metrics data
        results["total_retries"] = metrics.get("total_retries", 0)
        results["score"] = metrics.get("best_guess_score", results.get("score", 0))
        results["total_penalty"] = metrics.get("total_penalty", 0)
        results["regret"] = metrics.get("global_regret", 0)

        return results
    except Exception:
        return results


def check_port_open(port: int, host: str = "localhost", timeout: float = 0.5) -> bool:
    """Check if a port is accepting connections."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (OSError, ConnectionRefusedError):
        return False


def wait_for_ports(ports: list[int], timeout: float = 30.0) -> bool:
    """Wait for all ports to be available."""
    start = time.time()
    while time.time() - start < timeout:
        all_open = all(check_port_open(p) for p in ports)
        if all_open:
            return True
        time.sleep(0.5)
    return False


def get_strategy_choices() -> list[str]:
    """Get list of available strategies."""
    return ["ALL"] + [s.value for s in LoadBalancerStrategy]


def prompt_strategy() -> str | list[str]:
    """Prompt user to select a strategy."""
    choices = get_strategy_choices()

    table = Table(title="Available Strategies")
    table.add_column("Option", style="cyan")
    table.add_column("Description", style="green")

    table.add_row("ALL", "Run all strategies sequentially")
    table.add_row("v1", "Larkin Intuition (explore-then-exploit)")
    table.add_row("v2", "UCB (Upper Confidence Bound)")
    table.add_row("v3", "Modified UCB (aggressive exploration)")
    table.add_row("v4", "Thompson Sampling")
    table.add_row("v5", "Modified Thompson Sampling")

    console.print(table)
    console.print()

    choice = Prompt.ask(
        "Select strategy",
        choices=choices,
        default="v1",
    )

    if choice == "ALL":
        return [s.value for s in LoadBalancerStrategy]
    return choice


def get_config_choices() -> list[str]:
    """Get list of available config targets."""
    return ["ALL", "T1", "T2", "T3"]


def prompt_config() -> str | list[str]:
    """Prompt user to select a config target."""
    choices = get_config_choices()

    table = Table(title="Server Configurations")
    table.add_column("Option", style="cyan")
    table.add_column("Ports", style="yellow")
    table.add_column("Description", style="green")

    table.add_row("ALL", "-", "Run tests on all configurations sequentially")
    table.add_row("T1", "4000-4009", "Constant error rate only")
    table.add_row("T2", "5000-5009", "Constant error rate + fixed rate limit")
    table.add_row("T3", "6000-6009", "Constant error rate + dynamic rate limit")

    console.print(table)
    console.print()

    choice = Prompt.ask(
        "Select config target",
        choices=choices,
        default="T1",
    )

    if choice == "ALL":
        return ["T1", "T2", "T3"]
    return choice


def prompt_num_requests() -> int:
    """Prompt user for number of requests."""
    return IntPrompt.ask(
        "Number of requests to send",
        default=100,
    )


def start_failingserver() -> subprocess.Popen | None:
    """Start the failingserver binary (sandboxed on macOS)."""
    if not FAILINGSERVER_PATH.exists():
        console.print(f"[red]Error: failingserver binary not found at {FAILINGSERVER_PATH}[/red]")
        return None

    # On macOS, use sandbox-exec to restrict network access to localhost only
    if sys.platform == "darwin":
        cmd = [
            "sandbox-exec",
            "-p",
            "(version 1)(allow default)(deny network-outbound)(allow network-outbound (local ip))",
            str(FAILINGSERVER_PATH),
        ]
    else:
        cmd = [str(FAILINGSERVER_PATH)]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return proc
    except Exception as e:
        console.print(f"[red]Error starting failingserver: {e}[/red]")
        return None


def start_load_balancer(
    strategy: str, verbose: bool = False, session_id: str | None = None, config_target: str = "T1"
) -> subprocess.Popen | None:
    """Start the FastAPI load balancer server."""
    env = os.environ.copy()
    env["LB_STRATEGY"] = strategy
    env["LB_CONFIG_TARGET"] = config_target
    if session_id:
        env["LB_SESSION_ID"] = session_id

    try:
        proc = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "flaky_load_balancer.main:app",
                "--host",
                "0.0.0.0",
                "--port",
                "8000",
            ],
            env=env,
            stdout=None if verbose else subprocess.DEVNULL,
            stderr=None if verbose else subprocess.DEVNULL,
            cwd=PACKAGE_ROOT,
        )
        return proc
    except Exception as e:
        console.print(f"[red]Error starting load balancer: {e}[/red]")
        return None


def start_dashboard() -> subprocess.Popen | None:
    """Start the Next.js dashboard dev server.

    Returns:
        subprocess.Popen process handle or None on error.
    """
    if not DASHBOARD_PATH.exists():
        console.print(f"[yellow]Dashboard not found at {DASHBOARD_PATH}[/yellow]")
        return None

    # Check if node_modules exists
    node_modules = DASHBOARD_PATH / "node_modules"
    if not node_modules.exists():
        console.print("[yellow]Installing dashboard dependencies...[/yellow]")
        try:
            subprocess.run(
                ["npm", "install"],
                cwd=DASHBOARD_PATH,
                check=True,
                capture_output=True,
            )
        except subprocess.CalledProcessError as e:
            console.print(f"[red]Failed to install dependencies: {e}[/red]")
            return None
        except FileNotFoundError:
            console.print("[red]npm not found. Please install Node.js to use the dashboard.[/red]")
            return None

    try:
        proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=DASHBOARD_PATH,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return proc
    except Exception as e:
        console.print(f"[yellow]Warning: Could not start dashboard: {e}[/yellow]")
        return None


async def run_harness(num_requests: int, progress_callback=None) -> dict:
    """Run the test harness and return results."""
    from flaky_load_balancer.harness import TestHarness

    harness = TestHarness(
        num_requests=num_requests,
        rps=10,
        lb_url="http://localhost:8000/",
    )
    return await harness.run(progress_callback=progress_callback)


def cleanup_processes(*procs: subprocess.Popen | None) -> None:
    """Terminate all running processes."""
    for proc in procs:
        if proc is not None:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            except Exception:
                pass


def run_test(
    strategy: str, num_requests: int, verbose: bool = False, session_id: str | None = None, config_target: str = "T1"
) -> dict | None:
    """Run a single test with the given strategy.

    Args:
        strategy: The load balancer strategy to test.
        num_requests: Number of requests to send.
        verbose: Whether to show server logs.
        session_id: Optional session ID to group this run with others.
        config_target: Which server configuration to target (T1, T2, or T3).

    Returns:
        Results dict or None on failure.
    """
    console.print(
        Panel(f"Testing Strategy: [bold cyan]{strategy}[/bold cyan] on [bold yellow]{config_target}[/bold yellow]")
    )

    procs = []
    target_ports = CONFIG_PORTS[config_target]
    port_range = f"{target_ports[0]}-{target_ports[-1]}"

    try:
        # Start failingserver
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Starting failingserver...", total=None)

            failing_proc = start_failingserver()
            if failing_proc is None:
                return None
            procs.append(failing_proc)

            progress.update(task, description=f"Waiting for {config_target} ports ({port_range})...")
            if not wait_for_ports(target_ports, timeout=30):
                console.print(f"[red]Timeout waiting for {config_target} ports[/red]")
                return None

            progress.update(task, description="Starting load balancer...")
            lb_proc = start_load_balancer(strategy, verbose=verbose, session_id=session_id, config_target=config_target)
            if lb_proc is None:
                return None
            procs.append(lb_proc)

            # Wait for LB to be ready
            if not wait_for_ports([8000], timeout=10):
                console.print("[red]Timeout waiting for load balancer[/red]")
                return None

            progress.update(task, description="Starting dashboard...")
            dashboard_proc = start_dashboard()
            if dashboard_proc:
                procs.append(dashboard_proc)
                # Wait for dashboard to be ready
                if wait_for_ports([3000], timeout=15):
                    console.print("[dim]Dashboard ready at http://localhost:3000[/dim]")
                else:
                    console.print("[yellow]Dashboard may not be ready, continuing...[/yellow]")

            progress.update(task, description="Running test harness...")

        # Run the harness with progress display
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeRemainingColumn(),
            console=console,
        ) as progress:
            harness_task = progress.add_task(
                f"Sending {num_requests} requests at 10 RPS",
                total=num_requests,
            )

            def update_progress(current, total, success_rate):
                progress.update(
                    harness_task,
                    completed=current,
                    description=f"Requests: {current}/{total} | Success: {success_rate:.1%}",
                )

            results = asyncio.run(run_harness(num_requests, progress_callback=update_progress))

        # Enrich results with actual metrics (retries, score, etc.)
        results = enrich_results_from_metrics(results)

        return results

    except KeyboardInterrupt:
        console.print("\n[yellow]Test interrupted[/yellow]")
        return None

    finally:
        cleanup_processes(*procs)


def display_results(results: dict, strategy: str, config: str = "T1") -> None:
    """Display test results in a nice table."""
    table = Table(title=f"Results for {strategy} on {config}")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")

    table.add_row("Total Requests", str(results.get("total_requests", 0)))
    table.add_row("Successful", str(results.get("successful", 0)))
    table.add_row("Failed", str(results.get("failed", 0)))
    table.add_row("Success Rate", f"{results.get('success_rate', 0):.2%}")
    table.add_row("Total Retries", str(results.get("total_retries", 0)))
    table.add_row("Score", str(results.get("score", 0)))
    table.add_row("Avg Latency (ms)", f"{results.get('avg_latency_ms', 0):.2f}")

    console.print(table)


def cmd_start_harness(args) -> None:
    """Run the full test harness (flaky-servers + load balancer + dashboard + tests)."""
    console.print(
        Panel.fit(
            "[bold blue]Flaky Load Balancer Test Harness[/bold blue]\n"
            "Test multi-armed bandit strategies for routing to flaky servers",
            border_style="blue",
        )
    )
    console.print()

    # Get user input
    strategy_choice = prompt_strategy()
    config_choice = prompt_config()
    num_requests = prompt_num_requests()

    # Handle "ALL" vs single strategy/config
    strategies = strategy_choice if isinstance(strategy_choice, list) else [strategy_choice]
    configs = config_choice if isinstance(config_choice, list) else [config_choice]

    # Generate session_id when running multiple strategies or configs
    session_id = None
    if len(strategies) > 1 or len(configs) > 1:
        session_id = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        console.print(f"[dim]Session ID: {session_id}[/dim]")

    console.print()
    console.print(f"[bold]Running tests with {num_requests} requests per strategy/config[/bold]")
    console.print()

    # all_results keyed by (strategy, config) tuple
    all_results: dict[tuple[str, str], dict] = {}

    for config in configs:
        for strategy in strategies:
            results = run_test(
                strategy, num_requests, verbose=args.verbose, session_id=session_id, config_target=config
            )
            if results:
                all_results[(strategy, config)] = results
                display_results(results, strategy, config)
                console.print()

    # Summary if multiple runs
    if len(all_results) > 1:
        console.print(Panel("[bold]Summary Comparison[/bold]"))
        summary_table = Table()
        summary_table.add_column("Strategy", style="cyan")
        summary_table.add_column("Config", style="yellow")
        summary_table.add_column("Success Rate", style="green")
        summary_table.add_column("Score", style="magenta")
        summary_table.add_column("Retries", style="red")
        summary_table.add_column("Avg Latency", style="blue")

        for (strategy, config), results in all_results.items():
            summary_table.add_row(
                strategy,
                config,
                f"{results.get('success_rate', 0):.2%}",
                str(results.get("score", 0)),
                str(results.get("total_retries", 0)),
                f"{results.get('avg_latency_ms', 0):.2f}ms",
            )

        console.print(summary_table)


def cmd_start_dashboard(args) -> None:
    """Start just the dashboard dev server."""
    console.print(
        Panel.fit(
            "[bold blue]Flaky Load Balancer Dashboard[/bold blue]\nStarting Next.js dashboard at http://localhost:3000",
            border_style="blue",
        )
    )

    if not DASHBOARD_PATH.exists():
        console.print(f"[red]Error: Dashboard not found at {DASHBOARD_PATH}[/red]")
        sys.exit(1)

    # Check if node_modules exists
    node_modules = DASHBOARD_PATH / "node_modules"
    if not node_modules.exists():
        console.print("[yellow]Installing dashboard dependencies...[/yellow]")
        try:
            subprocess.run(
                ["npm", "install"],
                cwd=DASHBOARD_PATH,
                check=True,
            )
        except subprocess.CalledProcessError as e:
            console.print(f"[red]Failed to install dependencies: {e}[/red]")
            sys.exit(1)
        except FileNotFoundError:
            console.print("[red]npm not found. Please install Node.js to use the dashboard.[/red]")
            sys.exit(1)

    console.print("[green]Starting dashboard...[/green]")
    console.print("[dim]Press Ctrl+C to stop[/dim]")
    console.print()

    try:
        # Run npm dev in foreground so user can see output and Ctrl+C works
        subprocess.run(
            ["npm", "run", "dev"],
            cwd=DASHBOARD_PATH,
            check=True,
        )
    except KeyboardInterrupt:
        console.print("\n[yellow]Dashboard stopped[/yellow]")
    except subprocess.CalledProcessError as e:
        console.print(f"[red]Dashboard exited with error: {e}[/red]")
        sys.exit(1)


def cmd_start_flaky_servers(args) -> None:
    """Start the flaky downstream servers (sandboxed on macOS)."""
    console.print(
        Panel.fit(
            "[bold blue]Flaky Downstream Servers[/bold blue]\n"
            "Starting T1 (4000-4009), T2 (5000-5009), T3 (6000-6009) servers",
            border_style="blue",
        )
    )

    if not FAILINGSERVER_PATH.exists():
        console.print(f"[red]Error: failingserver binary not found at {FAILINGSERVER_PATH}[/red]")
        sys.exit(1)

    # On macOS, use sandbox-exec to restrict network access to localhost only
    if sys.platform == "darwin":
        console.print("[dim]Running in macOS sandbox mode (localhost only)[/dim]")
        cmd = [
            "sandbox-exec",
            "-p",
            "(version 1)(allow default)(deny network-outbound)(allow network-outbound (local ip))",
            str(FAILINGSERVER_PATH),
        ]
    else:
        cmd = [str(FAILINGSERVER_PATH)]

    console.print("[green]Starting flaky servers...[/green]")
    console.print("[dim]Press Ctrl+C to stop[/dim]")
    console.print()

    try:
        # Run in foreground so user can Ctrl+C
        proc = subprocess.Popen(cmd)

        # Wait for all port ranges to be ready
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Waiting for servers to start...", total=None)

            # Wait for T1 ports
            progress.update(task, description="Waiting for T1 servers (4000-4009)...")
            if wait_for_ports(CONFIG_PORTS["T1"], timeout=30):
                console.print("[green]T1 servers ready (4000-4009)[/green]")
            else:
                console.print("[red]Timeout waiting for T1 ports[/red]")

            # Wait for T2 ports
            progress.update(task, description="Waiting for T2 servers (5000-5009)...")
            if wait_for_ports(CONFIG_PORTS["T2"], timeout=30):
                console.print("[green]T2 servers ready (5000-5009)[/green]")
            else:
                console.print("[red]Timeout waiting for T2 ports[/red]")

            # Wait for T3 ports
            progress.update(task, description="Waiting for T3 servers (6000-6009)...")
            if wait_for_ports(CONFIG_PORTS["T3"], timeout=30):
                console.print("[green]T3 servers ready (6000-6009)[/green]")
            else:
                console.print("[red]Timeout waiting for T3 ports[/red]")

            progress.update(task, description="[green]All servers ready![/green]")

        console.print("[green]Flaky servers running. Press Ctrl+C to stop.[/green]")
        proc.wait()

    except KeyboardInterrupt:
        console.print("\n[yellow]Stopping flaky servers...[/yellow]")
        if proc:
            proc.terminate()
            proc.wait(timeout=5)
        console.print("[green]Servers stopped[/green]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        sys.exit(1)


def main() -> None:
    """Main CLI entry point with subcommands."""
    parser = argparse.ArgumentParser(
        description="Flaky Load Balancer CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  flb start harness       Run the full test harness
  flb start dashboard     Start just the Next.js dashboard
  flb start flaky-servers Start the downstream flaky servers
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # 'start' command with sub-subcommands
    start_parser = subparsers.add_parser("start", help="Start various components")
    start_subparsers = start_parser.add_subparsers(dest="component", help="Component to start")

    # flb start harness
    harness_parser = start_subparsers.add_parser(
        "harness",
        help="Run the full test harness (servers + LB + dashboard + tests)",
    )
    harness_parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Show FastAPI server logs",
    )
    harness_parser.set_defaults(func=cmd_start_harness)

    # flb start dashboard
    dashboard_parser = start_subparsers.add_parser(
        "dashboard",
        help="Start just the Next.js dashboard dev server",
    )
    dashboard_parser.set_defaults(func=cmd_start_dashboard)

    # flb start flaky-servers
    servers_parser = start_subparsers.add_parser(
        "flaky-servers",
        help="Start the flaky downstream servers (sandboxed)",
    )
    servers_parser.set_defaults(func=cmd_start_flaky_servers)

    args = parser.parse_args()

    # Handle no command or incomplete command
    if args.command is None:
        parser.print_help()
        sys.exit(0)

    if args.command == "start" and getattr(args, "component", None) is None:
        start_parser.print_help()
        sys.exit(0)

    # Run the appropriate command
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
