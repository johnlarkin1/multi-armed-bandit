# Multi-Armed Bandit Load Balancer: Strategy Documentation

This document provides comprehensive documentation for all bandit strategies implemented in the load balancer, covering theory, mathematical foundations, and implementation details.

## Table of Contents

1. [Introduction](#introduction)
2. [Strategy Interface](#strategy-interface)
3. [Classical Bandit Strategies (v1-v5)](#classical-bandit-strategies-v1-v5)
4. [Rate-Limit-Aware Strategies (v6-v8)](#rate-limit-aware-strategies-v6-v8)
5. [Comparison Tables](#comparison-tables)
6. [Appendix](#appendix)

---

## Introduction

### The Multi-Armed Bandit Problem

The **multi-armed bandit (MAB)** problem is a classic reinforcement learning problem that models the exploration-exploitation trade-off. Imagine a gambler facing multiple slot machines ("one-armed bandits"), each with an unknown probability of payout. The gambler must decide which machine to play to maximize total reward over time.

The challenge: **exploration** (trying different machines to learn their payouts) vs **exploitation** (playing the best-known machine to maximize immediate reward).

### Domain Context: Flaky Load Balancer

In our load balancer, each downstream server is an "arm":

- **Arms**: 30 servers across 3 tiers (T1: ports 4000-4009, T2: 5000-5009, T3: 6000-6009)
- **Reward**: Successful request (1) vs failure (0)
- **Constraint**: Maximum 10 attempts per request, first 3 are penalty-free

**Scoring Formula:**
```
Score = successful_requests - (penalty_retries × 0.5)
```

Where `penalty_retries` = attempts beyond the first 3.

### Exploration vs Exploitation Trade-off

| Phase | Goal | Risk |
|-------|------|------|
| **Exploration** | Try less-known servers to gather data | May waste attempts on bad servers |
| **Exploitation** | Use best-known server | May miss better options |

The strategies below represent different approaches to balancing this trade-off.

---

## Strategy Interface

### BaseStrategy

All strategies inherit from `BaseStrategy`, which defines the core interface:

```python
class BaseStrategy(ABC):
    def __init__(self, config_target: SERVER_CONFIG_TYPE, server_configs: dict[int, ServerConfig]):
        self._config_target = config_target
        self.server_configs = server_configs
        self.server_stats: dict[int, ServerStats] = {
            port: ServerStats(port=port) for port in server_configs.keys()
        }

    @abstractmethod
    def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
        """Select a server port based on strategy logic.

        Args:
            excluded: Set of ports to exclude from selection (already tried)
            attempt: Current attempt number (0-indexed) for exploration tuning

        Returns:
            Port number of selected server
        """
        pass

    @abstractmethod
    def update(self, port: int, success: bool, latency_ms: float) -> None:
        """Update server statistics after a request."""
        pass
```

### ServerStats

Each server maintains statistics tracked via `ServerStats`:

```python
@dataclass
class ServerStats:
    port: int
    num_success: int = 0
    num_failure: int = 0
    num_requests: int = 0
    total_latency_ms: float = 0.0
    # Beta distribution parameters (initialized to uniform prior)
    alpha: float = 1.0
    beta: float = 1.0
    # Rate limit tracking
    num_rate_limited: int = 0
    last_rate_limited_at: float | None = None
```

Key computed properties:

| Property | Formula |
|----------|---------|
| `success_rate` | `num_success / num_requests` |
| `beta_variance` | `αβ / ((α+β)² × (α+β+1))` |

---

## Classical Bandit Strategies (v1-v5)

### V1: Larkin Intuition (Explore-then-Exploit)

**Environment Variable:** `LB_STRATEGY=v1`

**Core Concept:** A simple two-phase strategy that explicitly separates exploration from exploitation.

#### Theory

The simplest approach to the exploration-exploitation dilemma is to dedicate a fixed number of initial requests to exploration, then switch entirely to exploitation. During exploration, we prioritize servers with the highest uncertainty (variance) in our estimates.

#### Algorithm

```
if total_requests < DISCOVER_LIMIT (50):
    # Exploration phase: pick server with highest beta variance
    select server with max(beta_variance)
else:
    # Exploitation phase: pick best known server
    select server with max(success_rate)
```

#### Key Implementation

**Beta Variance Calculation** (`constants.py:35-49`):

```python
@property
def beta_variance(self) -> float:
    """Calculate variance of Beta distribution with uniform prior Beta(1,1).

    Uses α = num_success + 1, β = num_failure + 1 to ensure:
    - Variance is never 0 (always some uncertainty)
    - Untried servers have maximum variance (0.25 for Beta(1,1))
    - More samples → lower variance (more confidence)

    Formula: Var = αβ / ((α+β)² * (α+β+1))
    """
    alpha = self.num_success + 1
    beta = self.num_failure + 1
    total = alpha + beta
    return (alpha * beta) / (total * total * (total + 1))
```

#### Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `DISCOVER_LIMIT` | 50 | Number of requests before switching to exploitation |

#### Pros/Cons

| Pros | Cons |
|------|------|
| Simple to understand | Fixed exploration window may be too long or short |
| Guaranteed exploration | No exploration after discovery phase |
| Deterministic behavior | Doesn't adapt to changing conditions |

---

### V2: UCB (Upper Confidence Bound)

**Environment Variable:** `LB_STRATEGY=v2`

**Core Concept:** Balance exploration and exploitation mathematically using confidence bounds.

#### Theory

UCB1 (Upper Confidence Bound) is a principled approach that naturally balances exploration and exploitation. It selects the server that maximizes an "optimistic" estimate of success rate, adding a bonus for uncertainty.

The key insight: servers with few samples have high uncertainty, so their confidence bound is wide, giving them a chance to be selected.

#### Mathematical Foundation

**UCB1 Formula:**

$$UCB_i(t) = \bar{x}_i + c \cdot \sqrt{\frac{\ln(t)}{n_i}}$$

Where:
- $\bar{x}_i$ = empirical success rate of server $i$
- $t$ = total number of requests across all servers
- $n_i$ = number of times server $i$ has been tried
- $c$ = exploration constant (default: $\sqrt{2}$)

**Regret Bound:** UCB1 achieves logarithmic regret: $O(\ln(n))$

#### Key Implementation

**UCB Calculation** (`v2_ucb.py:70-85`):

```python
def _calculate_ucb(self, success_rate: float, num_attempts: int, c: float = math.sqrt(2)) -> float:
    """Calculate UCB1 score.

    Args:
        success_rate: Empirical success rate for the server
        num_attempts: Number of times this server has been tried
        c: Exploration constant (default sqrt(2) for UCB1)

    Returns:
        UCB score
    """
    if num_attempts == 0:
        return float("inf")

    exploration_bonus = c * math.sqrt(math.log(self._total_requests) / num_attempts)
    return success_rate + exploration_bonus
```

#### Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `c` | √2 ≈ 1.414 | Exploration constant (theoretical optimum for UCB1) |

#### Pros/Cons

| Pros | Cons |
|------|------|
| Theoretical regret guarantees | Fixed exploration constant |
| Automatic exploration scheduling | Doesn't account for retry penalties |
| No hyperparameter tuning needed | Deterministic (no randomness) |

---

### V3: UCB Modified (Attempt-Aware)

**Environment Variable:** `LB_STRATEGY=v3`

**Core Concept:** Adapt UCB exploration based on whether the current attempt incurs a penalty.

#### Theory

Standard UCB doesn't account for our domain's penalty structure (first 3 attempts are free). V3 modifies the exploration constant dynamically:

- **Attempts 0-2** (penalty-free): Use aggressive exploration (`c = 3.0`)
- **Attempts 3+** (penalties apply): Use conservative exploration (`c = 1.0`)

This exploits the "free" exploration window while being cautious when penalties kick in.

#### Key Implementation

**Dynamic Exploration Constant** (`v3_ucb_modified.py:27-36`):

```python
def _get_exploration_constant(self, attempt: int) -> float:
    """Get exploration constant based on attempt number.

    Args:
        attempt: Current attempt number (0-indexed)

    Returns:
        Exploration constant (3 for penalty-free, 1 after)
    """
    return 3.0 if attempt < 3 else 1.0
```

#### Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `c` (attempts 0-2) | 3.0 | Aggressive exploration during penalty-free window |
| `c` (attempts 3+) | 1.0 | Conservative exploration after penalties begin |

#### Pros/Cons

| Pros | Cons |
|------|------|
| Exploits penalty structure | Requires domain knowledge |
| More exploration when "free" | Still deterministic |
| Retains UCB guarantees | Fixed threshold at attempt 3 |

---

### V4: Thompson Sampling

**Environment Variable:** `LB_STRATEGY=v4`

**Core Concept:** Use Bayesian inference with random sampling for probabilistic exploration.

#### Theory

Thompson Sampling is a Bayesian approach that maintains a probability distribution over each server's true success rate. Instead of computing a deterministic score, it:

1. Samples a random value from each server's posterior distribution
2. Selects the server with the highest sample

Servers with high uncertainty can produce high samples and get selected, enabling natural exploration.

#### Mathematical Foundation

**Beta-Bernoulli Model:**

For a server with $s$ successes and $f$ failures:
- Prior: $Beta(1, 1)$ (uniform)
- Posterior: $Beta(\alpha, \beta)$ where $\alpha = s + 1$, $\beta = f + 1$

**Selection:**
$$\theta_i \sim Beta(\alpha_i, \beta_i)$$
$$\text{select} = \arg\max_i(\theta_i)$$

#### Key Implementation

**Thompson Sampling Selection** (`v4_thompson.py:42-54`):

```python
def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
    excluded = excluded or set()
    target_ports = [p for p in self.get_ports(self._config_target) if p not in excluded]

    if not target_ports:
        return self.get_best_server()

    # Sample from Beta distribution for each server and pick highest
    best_port = target_ports[0]
    best_sample = -1.0

    for port in target_ports:
        stats = self.server_stats[port]
        sample = random.betavariate(stats.alpha, stats.beta)

        if sample > best_sample:
            best_sample = sample
            best_port = port

    return best_port
```

#### Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Initial α | 1.0 | Prior successes (uniform prior) |
| Initial β | 1.0 | Prior failures (uniform prior) |

#### Pros/Cons

| Pros | Cons |
|------|------|
| Probabilistic exploration | Non-deterministic |
| Near-optimal regret bounds | Doesn't exploit penalty structure |
| Naturally handles uncertainty | Can be "unlucky" with samples |

---

### V5: Thompson Modified (Variance-Scaled)

**Environment Variable:** `LB_STRATEGY=v5`

**Core Concept:** Increase sampling variance during penalty-free window for more exploration.

#### Theory

V5 extends Thompson Sampling by artificially increasing the variance of the Beta distribution during penalty-free attempts. This is achieved by scaling down the concentration parameters (α + β), making samples more spread out and exploratory.

**Variance Scale:**
$$\text{variance\_scale} = c_{\text{initial}} \times (\text{decay\_rate})^{\text{attempt}}$$

Where:
- $c_{\text{initial}} = 4.0$
- $\text{decay\_rate} = 0.5$

| Attempt | Variance Scale |
|---------|---------------|
| 0 | 4.0 |
| 1 | 2.0 |
| 2 | 1.0 |
| 3+ | 0 (no scaling) |

#### Key Implementation

**Variance-Scaled Sampling** (`v5_thompson_modified.py:75-99`):

```python
def _sample_with_variance_scale(self, alpha: float, beta: float, variance_scale: float) -> float:
    """Sample from Beta distribution with optional variance scaling.

    When variance_scale > 0 and we have enough data, we scale down the
    concentration parameters to increase variance (more exploration).

    Args:
        alpha: Alpha parameter of Beta distribution
        beta: Beta parameter of Beta distribution
        variance_scale: Scale factor (0 = no scaling, higher = more variance)

    Returns:
        Sample from the (potentially scaled) Beta distribution
    """
    total = alpha + beta

    # Only apply scaling if we have enough data and scale is non-zero
    if variance_scale > 0 and total > 2:
        # Scale down the concentration to increase variance
        scale_factor = max(2, total / variance_scale) / total
        scaled_alpha = max(1.0, alpha * scale_factor)
        scaled_beta = max(1.0, beta * scale_factor)
        return random.betavariate(scaled_alpha, scaled_beta)

    return random.betavariate(alpha, beta)
```

#### Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `C_INITIAL` | 4.0 | Initial variance scale factor |
| `DECAY_RATE` | 0.5 | Exponential decay per attempt |

#### Pros/Cons

| Pros | Cons |
|------|------|
| Exploits penalty structure | More complex than V4 |
| Probabilistic exploration | Hyperparameters to tune |
| Adapts exploration by attempt | May over-explore early |

---

## Rate-Limit-Aware Strategies (v6-v8)

These strategies extend the classical approaches to handle HTTP 429 (rate limit) responses intelligently.

### Rate Limit Philosophy

**Key Insight:** A 429 response indicates a capacity constraint, not server quality. A server hitting rate limits was performing well until capacity was exhausted. Penalizing it biases toward underutilized (potentially worse) servers.

### RateLimitAwareStrategy Base Class

All rate-limit-aware strategies inherit from `RateLimitAwareStrategy`:

```python
class RateLimitAwareStrategy(BaseStrategy):
    """Base class for strategies that handle rate limits specially."""

    def __init__(self, config_target, server_configs, cooldown_seconds=None):
        super().__init__(config_target, server_configs)
        self.cooldown_seconds = cooldown_seconds or float(
            os.environ.get("LB_RATE_LIMIT_COOLDOWN", DEFAULT_COOLDOWN_SECONDS)
        )

    def update_rate_limited(self, port: int, latency_ms: float) -> None:
        """Record a rate limit (429) response without updating bandit beliefs."""
        stats = self.server_stats[port]
        stats.num_rate_limited += 1
        stats.last_rate_limited_at = time.time()
        # Update latency tracking but NOT success/failure counts
        stats.num_requests += 1
        stats.total_latency_ms += latency_ms

    def is_rate_limited(self, port: int) -> bool:
        """Check if a server is currently in rate limit cooldown."""
        stats = self.server_stats[port]
        if stats.last_rate_limited_at is None:
            return False
        elapsed = time.time() - stats.last_rate_limited_at
        return elapsed < self.cooldown_seconds
```

---

### V6: Thompson Masked (Arm Masking)

**Environment Variable:** `LB_STRATEGY=v6`

**Core Concept:** Exclude rate-limited servers from Thompson sampling selection entirely.

#### Theory

The simplest rate-limit-aware approach: when a server returns 429, temporarily remove it from the selection pool ("mask" the arm). This prevents wasting attempts on servers known to be at capacity.

#### Algorithm

```
1. Get available servers (not excluded AND not rate-limited)
2. If none available:
   a. Pick least recently rate-limited server
   b. Or fall back to best server
3. Perform Thompson sampling on available servers only
```

#### Key Implementation

**Masked Selection** (`v6_thompson_masked.py:31-71`):

```python
def select_server(self, excluded: set[int] | None = None, attempt: int = 0) -> int:
    excluded = excluded or set()

    # Get servers that are available (not excluded AND not rate-limited)
    available_ports = self.get_available_servers(excluded)

    if not available_ports:
        # All servers either excluded or rate-limited
        rate_limited_ports = [
            p for p in self.get_ports(self._config_target)
            if p not in excluded and self.is_rate_limited(p)
        ]
        if rate_limited_ports:
            return self.get_least_recently_rate_limited()
        return self.get_best_server()

    # Sample from Beta distribution for each available server
    best_port = available_ports[0]
    best_sample = -1.0

    for port in available_ports:
        stats = self.server_stats[port]
        sample = random.betavariate(stats.alpha, stats.beta)
        if sample > best_sample:
            best_sample = sample
            best_port = port

    return best_port
```

#### Parameters

| Parameter | Default | Environment Variable |
|-----------|---------|---------------------|
| `cooldown_seconds` | 1.0 | `LB_RATE_LIMIT_COOLDOWN` |

#### Use Case

Best for **fixed rate limits** (e.g., 100 requests/minute) where servers have predictable, static capacity.

---

### V7: Sliding Window

**Environment Variable:** `LB_STRATEGY=v7`

**Core Concept:** Compute Beta parameters from recent observations only, enabling quick adaptation.

#### Theory

Standard Thompson Sampling accumulates all historical observations, making it slow to adapt when server behavior changes. V7 maintains a sliding window of the most recent N observations per server, computing Beta parameters from this window only.

This enables rapid adaptation to:
- Changing rate limits
- Server degradation
- Recovery after downtime

#### Mathematical Foundation

Instead of:
$$\alpha = \text{total\_successes} + 1$$
$$\beta = \text{total\_failures} + 1$$

We use:
$$\alpha = \text{windowed\_successes} + 1$$
$$\beta = \text{windowed\_failures} + 1$$

Where the window contains only the last N observations.

#### Key Implementation

**WindowedStats Dataclass** (`v7_sliding_window.py:14-29`):

```python
@dataclass
class WindowedStats:
    """Per-server statistics with sliding window history."""

    port: int
    history: deque = field(default_factory=lambda: deque(maxlen=DEFAULT_WINDOW_SIZE))

    @property
    def alpha(self) -> float:
        """Compute alpha from windowed history (successes + 1 for prior)."""
        return sum(1 for success in self.history if success) + 1

    @property
    def beta(self) -> float:
        """Compute beta from windowed history (failures + 1 for prior)."""
        return sum(1 for success in self.history if not success) + 1
```

#### Parameters

| Parameter | Default | Environment Variable |
|-----------|---------|---------------------|
| `window_size` | 30 | `LB_SLIDING_WINDOW_SIZE` |
| `cooldown_seconds` | 1.0 | `LB_RATE_LIMIT_COOLDOWN` |

#### Use Case

Best for **dynamic/changing rate limits** (e.g., Config 3) where server capacity varies over time.

---

### V8: Blocking Bandit

**Environment Variable:** `LB_STRATEGY=v8`

**Core Concept:** Model fixed-window rate limits with exponential backoff blocking.

#### Theory

V8 explicitly models rate limits as temporary blocking periods. When a server returns 429:

1. Block the server for a duration D
2. If the server returns 429 again when unblocked, double the block duration
3. Cap the backoff multiplier at 4×
4. Reset backoff on successful request

This models fixed-window rate limits (e.g., "N requests per minute") where the optimal strategy is to wait for the window to reset.

#### Algorithm

```
On 429:
    consecutive_429s += 1
    multiplier = min(multiplier * 2, MAX_MULTIPLIER)
    blocked_until = now + (base_duration * multiplier)

On success:
    consecutive_429s = 0
    multiplier = 1
```

#### Key Implementation

**Exponential Backoff** (`v8_blocking_bandit.py:138-159`):

```python
def update_rate_limited(self, port: int, latency_ms: float) -> None:
    """Handle 429 rate limit with exponential backoff blocking."""
    # Call parent to update rate limit stats
    super().update_rate_limited(port, latency_ms)

    # Apply exponential backoff blocking
    state = self.blocking_state[port]
    state.consecutive_429s += 1

    # Double multiplier up to max
    state.current_multiplier = min(state.current_multiplier * 2, MAX_BACKOFF_MULTIPLIER)

    # Block for duration * multiplier
    block_time = self.block_duration * state.current_multiplier
    state.blocked_until = time.time() + block_time
```

**BlockingState Dataclass** (`v8_blocking_bandit.py:15-22`):

```python
@dataclass
class BlockingState:
    """Per-server blocking state with exponential backoff."""

    port: int
    blocked_until: float = 0.0
    consecutive_429s: int = 0
    current_multiplier: int = 1
```

#### Parameters

| Parameter | Default | Environment Variable |
|-----------|---------|---------------------|
| `block_duration` | 5.0s | `LB_BLOCK_DURATION` |
| `MAX_BACKOFF_MULTIPLIER` | 4 | (hardcoded) |

#### Backoff Schedule

| Consecutive 429s | Multiplier | Block Duration (with default 5s) |
|------------------|------------|----------------------------------|
| 1 | 2× | 10s |
| 2 | 4× | 20s |
| 3+ | 4× (capped) | 20s |

#### Use Case

Best for **fixed-window rate limits** (e.g., "100 requests per minute") where servers have predictable recovery times.

---

## Comparison Tables

### Strategy Classification

| Strategy | Version | Family | Rate-Limit Aware | Adaptive |
|----------|---------|--------|------------------|----------|
| Larkin Intuition | v1 | Explore-then-Exploit | No | No |
| UCB | v2 | UCB | No | No |
| UCB Modified | v3 | UCB | No | Yes (attempt-aware) |
| Thompson | v4 | Thompson Sampling | No | No |
| Thompson Modified | v5 | Thompson Sampling | No | Yes (attempt-aware) |
| Thompson Masked | v6 | Thompson Sampling | Yes | No |
| Sliding Window | v7 | Thompson Sampling | Yes | Yes (windowed) |
| Blocking Bandit | v8 | Thompson Sampling | Yes | Yes (backoff) |

### Key Parameters

| Strategy | Key Parameters | Defaults |
|----------|---------------|----------|
| v1 | `DISCOVER_LIMIT` | 50 |
| v2 | `c` (exploration constant) | √2 |
| v3 | `c` (dynamic) | 3.0 / 1.0 |
| v4 | Prior α, β | 1.0, 1.0 |
| v5 | `C_INITIAL`, `DECAY_RATE` | 4.0, 0.5 |
| v6 | `cooldown_seconds` | 1.0 |
| v7 | `window_size`, `cooldown_seconds` | 30, 1.0 |
| v8 | `block_duration`, `MAX_BACKOFF` | 5.0, 4 |

### Use Case Recommendations

| Scenario | Recommended Strategy | Reason |
|----------|---------------------|--------|
| Simple, stable servers | v4 (Thompson) | Clean Bayesian approach |
| Penalty optimization needed | v3 or v5 | Attempt-aware exploration |
| Fixed rate limits | v6 or v8 | Arm masking / explicit blocking |
| Dynamic rate limits | v7 | Quick adaptation via windowing |
| Debugging/interpretability | v1 or v2 | Deterministic behavior |

---

## Appendix

### A. Mathematical Background

#### Beta Distribution

The Beta distribution is the conjugate prior for the Bernoulli likelihood, making it ideal for modeling success rates.

**PDF:**
$$f(x; \alpha, \beta) = \frac{x^{\alpha-1}(1-x)^{\beta-1}}{B(\alpha, \beta)}$$

**Properties:**
| Property | Formula |
|----------|---------|
| Mean | $\frac{\alpha}{\alpha + \beta}$ |
| Variance | $\frac{\alpha\beta}{(\alpha+\beta)^2(\alpha+\beta+1)}$ |
| Mode | $\frac{\alpha-1}{\alpha+\beta-2}$ (for α, β > 1) |

**Conjugate Update:**
- Prior: $Beta(\alpha_0, \beta_0)$
- After observing $s$ successes and $f$ failures: $Beta(\alpha_0 + s, \beta_0 + f)$

#### UCB Regret Bounds

UCB1 achieves logarithmic regret:

$$R(n) \leq O\left(\sum_{i: \mu_i < \mu^*} \frac{\ln n}{\Delta_i}\right)$$

Where:
- $\mu_i$ = true success rate of server $i$
- $\mu^*$ = best server's success rate
- $\Delta_i = \mu^* - \mu_i$ = gap between best and server $i$

### B. Configuration Reference

#### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LB_STRATEGY` | Strategy to use (v1-v8) | Required |
| `LB_CONFIG_TARGET` | Server tier (T1, T2, T3) | T1 |
| `LB_RATE_LIMIT_COOLDOWN` | Cooldown after 429 (seconds) | 1.0 |
| `LB_SLIDING_WINDOW_SIZE` | Window size for v7 | 30 |
| `LB_BLOCK_DURATION` | Base block duration for v8 (seconds) | 5.0 |

#### Running the Load Balancer

```bash
# Using v4 Thompson Sampling
LB_STRATEGY=v4 uv run uvicorn flaky_load_balancer.main:app --reload

# Using v8 Blocking Bandit with custom parameters
LB_STRATEGY=v8 LB_BLOCK_DURATION=10.0 uv run uvicorn flaky_load_balancer.main:app --reload
```

### C. Glossary

| Term | Definition |
|------|------------|
| **Arm** | A single option (server) in the bandit problem |
| **Regret** | Cumulative difference between optimal and actual rewards |
| **Exploration** | Trying uncertain options to learn about them |
| **Exploitation** | Using the currently best-known option |
| **Prior** | Initial belief before observing data |
| **Posterior** | Updated belief after observing data |
| **Conjugate Prior** | Prior that yields same distribution family as posterior |
| **UCB** | Upper Confidence Bound - optimistic estimate |
| **Thompson Sampling** | Bayesian approach using random samples from posteriors |
| **Rate Limit (429)** | HTTP status indicating capacity exhaustion |
| **Cooldown** | Waiting period after rate limit before retrying |
| **Backoff** | Increasing wait time after repeated failures |

---

*Generated for the Multi-Armed Bandit Load Balancer project. For questions or contributions, see the repository's README.*
