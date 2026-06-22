# Architecture: Serverless Business Process Automation

## Overview

This system implements a lightweight, serverless automation engine for running scheduled business processes using managed cloud services instead of traditional backend infrastructure.

It is designed for batch-oriented workflows where simplicity, observability, and operational ownership matter more than strict real-time guarantees or horizontal scalability.

---

## High-Level Architecture
```
GitHub Actions (Scheduler)
│
▼
Automation Engine (Node.js)
│
┌────────────┼──────────────┐
▼            ▼              ▼
Sheets    Calendar        SMTP
(State)   (Events)   (Notifications)
│
▼
Business Rule Evaluation Layer
│
▼
State Update + Notification Dispatch
```
![Architecture Diagram](./diagrams/architecture.png)
---

## Core Components

### 1. Scheduler (GitHub Actions)
Responsible for triggering the workflow at fixed intervals.

- No infrastructure to manage
- Fully version-controlled execution schedule
- Manual trigger support for testing

---

### 2. Automation Engine (Node.js)
Core execution unit that orchestrates the workflow.

Responsibilities:
- Load configuration and secrets
- Fetch operational data
- Execute business rules
- Coordinate external integrations
- Persist results

---

### 3. Operational Data Layer (Google Sheets)

Acts as a lightweight datastore.

Used for:
- Storing account/customer records
- Tracking usage state
- Managing business configuration

Trade-off:
- Easy to edit manually
- Limited schema enforcement

---

### 4. Event Source (Google Calendar)

Represents external activity data.

Used to:
- Derive usage metrics
- Avoid manual tracking of consumption
- Provide time-bounded event history

---

### 5. Notification Layer (SMTP)

Responsible for outbound communication.

- Decoupled from core logic
- Can be replaced with any email provider
- Stateless delivery mechanism

---

## Data Flow

1. Scheduler triggers workflow
2. Engine loads all accounts from Sheets
3. For each account:
   - Fetch events from Calendar within a time window
   - Apply prefix-based matching rules
   - Compute usage count
4. Compare usage against configured quota
5. If threshold exceeded and not already notified:
   - Send notification email
   - Update state in Sheets

---

## Design Principles

### 1. Externalized State
All mutable business data is stored outside the application.

### 2. Stateless Execution
Each run is independent and does not rely on previous runtime memory.

### 3. Deterministic Processing
Same inputs produce same outputs (given unchanged external data).

### 4. Minimal Infrastructure
No backend servers, queues, or databases required.

---

## Trade-offs

### Advantages
- Extremely low operational overhead
- Easy to deploy and maintain
- Accessible to non-technical users
- Fast iteration cycle

### Limitations
- No transactional consistency across services
- Batch processing only
- Dependent on external APIs
- Limited observability without additional tooling

---

## Evolution Path

This architecture can evolve into:

- Event-driven system (webhooks / pub-sub)
- Dedicated backend with API layer
- Structured database replacing Sheets
- Rule engine for configurable business logic
- Multi-tenant automation platform

---

## Summary

This is a pragmatic serverless architecture optimized for operational simplicity. It demonstrates how meaningful business automation can be achieved without introducing traditional backend complexity, while keeping the system transparent and maintainable.
