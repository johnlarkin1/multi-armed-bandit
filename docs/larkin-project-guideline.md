> [!NOTE]  
> This is probably stale now that I'm cleaning this up for a Github repo.

Hi Claude, here is what I would like to be implemented.

This project is about implementing a load balancer. You should not be creative at all. You should follow the guidelines and instructions in this markdown file. 

We are only going to concern ourselves with Config 0 for now. 

# Infrastructure

## FastAPI Service

Our load balancer is going to be a FastAPI service. I have already created the project structure that I like:

```
╭─johnlarkin@Larkins-Unit ~/Documents/coding/flaky-load-balancer/flaky-load-balancer ‹main*›
╰─➤  tree -L 3 -I "scripts|target|schema|__pycache__|flaky_load_balancer.egg-info"
.
├── flaky_load_balancer
│   ├── __init__.py
│   ├── api
│   │   ├── __init__.py
│   │   ├── endpoints
│   │   └── routes.py
│   ├── constants.py
│   ├── logger.py
│   ├── main.py
│   └── middleware.py
├── main.py
├── pyproject.toml
├── README.md
├── runner.sh
└── uv.lock
```

We're going to utilize a LB_STRATEGY environment parameter so that we know which strategy we're testing. For simplicity, we're going to run things serially to do our simulation of our load. 

## Middleware / Metrics Collector 

As part of our FastAPI service, we're going to keep track of some core metrics. These should be emitted to a `.json` file so as to keep things SOLID and hopefully not to impact the performance on our load balancer. We'll have to grab a `lock` just to ensure no `asyncio` threading, but that should be fine. FastAPI should be waaaaay more performant than struggling to handle 10RPS with a small JSON dict read. We can use `orjson` / or `ujson` as well. 

Here are some core metrics that we'll want to keep track of. (some of which I'll define below in more detail)
* global regret
  - this is going to be the optimal number of requests - our actual successes. for the sake of our example, i think we should assume that global regret is ~= number of requests. 
* total requests successfully routed
* total requests unsuccessfully routed
* total number of requests
* total retry count
* per server
  * success rate
  * num requests received 
  * num requests success
* best-guess-score
  - this is really as it pertains to the takehome, which we'll grow outside of eventually, but
  - "Your score will be positively affected by how many IDs are accepted by the downstream servers
and negatively affected by every extra attempt over 3 for a single ID (You cannot attempt a
request more than 3 times without being negatively affected)"
  - so here is where we should take into account a penalty if we try 3 and then fail 
* metrics
  * p50 latency / p99 latency

I will get more into the strategy implementation below.

The point is this `metrics_collector` should be a separate process that checks for `mdtime` (mod time of that json file on disk) and then updates in close to realtime our realtime matplotlib. If we're concerned with 10RPS and the rate of updates, or read contention on the actual json file, then we can debounce slightly and maybe just update every half a second. That should be fine. 

## Testing Harness

I would like a `rich` based interactive `cli` that the users can run with `uv run flaky_load_balancer.cli`.

This should prompt the user for:

* testing a specific strategy or `ALL` as the default option (vs running through all of them)
* number of requests to target (note, this will be for each configuration, so if they say 100, we'll have 100 per config 1, 100 per config 2, 100 per config 3, etc). 
  - NOTE: very importantly, we should ensure that regardless of the number of requests we match 10RPS

What should then happen is:

1. We spin up the `failingserver` binary
  a. please ensure that all the ports are open / being utilized before continuing 
2. We spin up our load balancer 
3. We spin up our matplotlib data visualizer
4. We spin up our harness.
  a. The harness will be responsible for firing off the requests to the load balancer in a controller manner. 

So we should - ideally - have 4 separate processes: 1) failingserver downstream binary 2) load balancer 3) metrics collector 4) testing harness.

# Strategies 

This is really the meat of the problem. 

Strategies are going to be controlled through the `LB_STRATEGY` environment variable. 

Again, for the sake of the problem and because I'm trying to learn. Please stick to these, and then we can flag issues with implementation / core math after the faact. 

Note that across all of these, the approach is that we're FINE with incurring a penalty as long as it means we eventually return back a 200 to the requester. The worse case is that we get back 500s. So we should only fail to return a 200 if we are at jeopardy of not being able to service 10 RPS (i.e. we have requests queueing etc).

## V1 - Larkin Intuition

Call me an idiot, but my first idea was to have a `DISCOVER_LIMIT` and basically try to build up the `beta` distribution. I didn't know this, but this is really some variant of the `explore-exploit` pattern that (i think) is the worst case for the multi-armed bandit problems. 

So the pseudcode for that is this:

```python
def handle_request() -> None:
    if IN_DISCOVER_MODE:
        # only can afford 3 mistakes
        for _ in range(3):
            next_server = self.get_least_confidence_distro()
            is_success  = send_request(next_server)
            update_server_stats(next_server)
            
            if is_success :    
                return Response(code=200)
            # otherwise, we want to try the next least confidence one
        # if we get here, we should try to exploit our current knowledge, and use the one we think has the highest success rate so far 
        next_server = self.get_best_so_far_server()
        is_success = send_request(next_server)
        update_server_stats(next_server)
        if is_success:
            return Response(code=200)
        else:
            return Response(code=500)
    # ok but 
```

where (after googling around, the best distribution here for this seems to be a Beta distribution) so that seems like Beta(1,1)

```python
def on_init(self) -> None:
    self.server_stats = {
        port: ServerStat(
            port, 
        )
    }

def get_least_confidence_distro():
    return max(
        server_stats.values(),
        key=lambda s: s.beta_variance,
    ).port

def get_best_so_far_server():
    return max(
        server_stats.values(),
        key=lambda s: s.success_rate,
    ).port

def update_server_stats(port: int, success: bool, latency_ms: float) -> None:
    server_stats = self.server_stats[server.port]
    server_stats.num_requests += 1
    if success:
        server_stats.num_success += 1
    else:
        server_stats.num_failure += 1
    server_stats.total_latency_ms += latency_ms
```


## V2 - Upper Confidence Bound (UCB)

My approach is dumb for several reasons. 

The most noticeable (that even I noticed in planning) is that I don't like statically defining a DISCOVER_LIMIT. 

UCB builds on this dramatically by having the explore/exploitation pattern basically baked into the formula. 

Basically:

$$ \text{UCB\_score (server)} = \textrm{estimated\_success\_rate} + \textrm{exploration\_bonus} $$

For our example:

$$ \text{UCB}(i, t) = \hat{\mu}_i + \sqrt{\frac{2 \cdot \ln{t}}{n_i}} $$ 

Note here:

$t$ is total number of requests, $n_i$ is the number of times server $i$ has been tried, $\mu$ is the "empirical mean reward" but in reality in our case it's the success rate for server $i$. 

Source: https://en.wikipedia.org/wiki/Upper_Confidence_Bound

I guess this is technically UCB1 but that's fine. 

Also note, logarathmic regret is what we should be striving towards. 

So here our pseudocode is going to be pretty much the equivalent of that in our code. 

Claude, you should handle the implementation here given we know this strategy is not going to maximize our score given it's not utilizing our 3 freebies approach.

## V3 - UCB Modification 

Ok so this is great theory and all, but it doesn't relate to the problem whatsoever. We're not taking advance of our 3 free requests before any penalty. 

So one thought is that the $\sqrt{2}$ is really just a tuning factor apparently, and we can have dynamic scaling based on the number of requests. 

We could even have it be almost like an exponential backoff given the first three requests we won't get penalized. That's actually a bad idea though because we should just be equally aggressive with all three of those. 

So our pseudocode becomes:

```python

def handle_request(self, request_id: str) -> Response:
    tried_servers: set[int] = set()
    attempt = 0

    def get_exploration_constant(attempt: int):
        # sqrt(2) = 1.6 but we should drop even lower
        return 3 if attempt < 3 else 1
    
    while True:
        if attempt < 3:
            # be aggressive with first three 
            c = self.get_exploration_constant(attempt)
            port = self.select_server_ucb(tried_servers, c)
            tried_servers.add(port)
        else:
            # we're out of freebies just get our best one
            port = get_best_server()
        
        self.total_requests += 1
        success, latency = send_request(port, request_id)
        self.update_stats(port, success, latency)
        
        if success:
            return Response(status_code=200)
        
        attempt += 1

def select_server_ucb(
    self, 
    excluded: set[int], 
    exploration_constant: float
) -> int:
    available = {
        p: s for p, s in self.server_stats.items() 
        if p not in excluded
    }
    
    best_port = None
    best_ucb = -float('inf')
    
    for port, stats in available.items():
        success_rate = stats.num_successes / stats.num_attempts
        exploration_bonus = exploration_constant * math.sqrt(
            math.log(self.total_requests) / stats.num_attempts
        )
        ucb_score = success_rate + exploration_bonus
        
        if ucb_score > best_ucb:
            best_ucb = ucb_score
            best_port = port
    
    return best_port
```

## V4 - Thompson Sampling

The flow of Thompson Sampling will look pretty similar to UCB the whole idea is just that UCB is frequentist in the core theory and Thompson sampling is more kinda like what I was thinking intuitively about building up a distribution and a confidence interval and things like that. 

So again, we're going to model things as `random.betavariate` distributions, same type of thing:

```python
def handle_request(self, request_id: str) -> Response:
    tried_servers: set[int] = set()
    attempt = 0
    
    while True:
        if attempt < 3:
            port = self.select_server_thompson(tried_servers)
            tried_servers.add(port)
        else:
            port = self.get_best_server()
        
        success, latency = send_request(port, request_id)
        self.update_stats(port, success, latency)
        
        if success:
            return Response(status_code=200)
        
        attempt += 1

def select_server_thompson(self, excluded: set[int]) -> int:
    available = {
        p: s for p, s in self.server_stats.items() 
        if p not in excluded
    }
    
    best_port = None
    best_sample = -1
    
    for port, stats in available.items():
        sample = random.betavariate(stats.alpha, stats.beta)
        
        if sample > best_sample:
            best_sample = sample
            best_port = port
    
    return best_port

# this is important
def update_stats(self, port: int, success: bool, latency: float) -> None:
    # alpha is just num_success + 1, so I probably won't extend that dataclass
    # beta is num_failures + 1 
    stats = self.server_stats[port]
    if success:
        stats.alpha += 1
    else:
        stats.beta += 1
    stats.total_latency_ms += latency
```


## V5 - Modified Thompson Sampling

So again, V4 is not really taking into consideration the 3 freebies. 

The general thought is the same we are going to want to encourage exploration given that it's free and no penalty. 

There is an interesting question about like ideally we would collect data after running our harness and tons of tests to fine-tune this, but it's ultimately moot, because I'm going to try and decompile the underlying Go binary to have a perfect solution eventually. 

I feel like exponential backoff might make sense thinking more deeply about it because we're still burning through requests and we want to be cognizant of that. does make sense here because we're trying to e

```python

def get_variance_scale(self, attempt: int) -> float:
    if attempt >= 3:
        return 0.0
    
    c_initial = 4.0
    decay_rate = 0.5
    return c_initial * (decay_rate ** attempt)


def select_server_thompson(
    self, 
    excluded: set[int], 
    variance_scale: float = 1.0
) -> int:
    available = {
        p: s for p, s in self.server_stats.items() 
        if p not in excluded
    }
    
    best_port = None
    best_sample = -1
    
    for port, stats in available.items():
        if variance_scale != 1.0 and (stats.alpha + stats.beta) > 2:
            # looked this part up
            total = stats.alpha + stats.beta
            scale_factor = max(2, total / variance_scale) / total
            scaled_alpha = max(1, stats.alpha * scale_factor)
            scaled_beta = max(1, stats.beta * scale_factor)
            sample = random.betavariate(scaled_alpha, scaled_beta)
        else:
            sample = random.betavariate(stats.alpha, stats.beta)
        
        if sample > best_sample:
            best_sample = sample
            best_port = port
    
    return best_port
    
def handle_request(self, request_id: str) -> Response:
    tried_servers: set[int] = set()
    attempt = 0
    
    while True:
        if attempt < 3:
            variance_scale = self.get_variance_scale(attempt)
            port = self.select_server_thompson(tried_servers, variance_scale)
            tried_servers.add(port)
        else:
            port = self.get_best_server()
        
        success, latency = send_request(port, request_id)
        self.update_stats(port, success, latency)
        
        if success:
            return Response(status_code=200)
        
        attempt += 1
```


