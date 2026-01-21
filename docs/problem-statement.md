# Flaky Load Balancer Challenge

## Overview

Design and implement a load-balancing service that distributes incoming requests across **N identical but unreliable downstream servers**. Each downstream server exhibits predefined failure behaviors. The objective is to **maximize successful request processing** while minimizing unnecessary retries.

This challenge is designed to evaluate system design decisions, failure handling strategies, and adaptive request routing.

---

## Incoming Request Specification

- Endpoint: `POST /`
- Request body:
  - An alphanumeric identifier
  - Fixed length: **24 characters**
- Traffic pattern:
  - **10 requests per second (RPS)**

---

## Downstream Server Specification

Each downstream server:

- Exposes a single endpoint: `POST /`
- Requires:
  - Request body length of **24**
  - The same identifier received by the load balancer
- Returns:
  - `200 OK` if processed successfully
  - `5XX` error if the request fails

---

## Scoring Rules

- **Positive impact**:
  - Each identifier successfully accepted by a downstream server
- **Negative impact**:
  - Each retry beyond the **third attempt** for the same identifier
- Constraint:
  - You may not attempt delivery of the same identifier more than **3 times** without incurring a penalty

---

## Downstream Server Configurations

There are **three progressive configurations**, each increasing in difficulty. Solutions should be completed **in order**.

### 1. Constant Error Rate

- Each server has a fixed probability of failure
- Error rates may differ between servers
- Error rates do **not** change over time

### 2. Constant Error Rate + Fixed Rate Limit

- Same as Configuration 1
- Each server additionally enforces a static rate limit

### 3. Constant Error Rate + Dynamic Rate Limit

- Error rate remains constant per server
- Rate limits are **complex and may change over time**

---

## Execution Environment

A provided binary simulates all downstream servers.

Port ranges per configuration:

1. Configuration 1: ports `[4000, 4010)`
2. Configuration 2: ports `[5000, 5010)`
3. Configuration 3: ports `[6000, 6010)`

Each range represents **10 downstream servers**.