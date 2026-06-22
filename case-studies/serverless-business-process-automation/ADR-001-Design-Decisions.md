# ADR-001: Use of Serverless External Services for Business Process Automation

## Status
Accepted

---

## Context

This system automates a recurring business process that involves:

- Tracking usage of a service over time
- Evaluating whether a predefined quota has been reached
- Triggering a notification when thresholds are exceeded
- Persisting state updates after execution

Traditional implementations would typically rely on:

- A backend service
- A database
- A scheduler
- A notification service layer

However, the operational requirements for this system prioritize simplicity and low maintenance over infrastructure control.

---

## Decision

We adopt a serverless, externally-managed architecture composed of:

- GitHub Actions for scheduled execution
- Google Sheets as the operational datastore
- Google Calendar as the event source
- SMTP for notification delivery

No dedicated backend service or database layer is introduced.

---

## Rationale

This design was chosen to optimize for:

### 1. Operational Simplicity
No servers, no deployment pipelines, no runtime infrastructure to maintain.

### 2. Business User Accessibility
Google Sheets allows non-technical modification of operational data.

### 3. Low Cost and Low Maintenance
Managed services eliminate infrastructure overhead.

### 4. Sufficient Scale for Use Case
The workload is batch-oriented and does not require real-time processing or high throughput systems.

---

## Trade-offs

### Advantages
- Minimal infrastructure complexity
- Fast initial implementation
- Easy to modify business rules via spreadsheet
- Fully serverless execution model

### Limitations
- Weak schema enforcement in Sheets
- No transactional guarantees across services
- Batch execution only (not real-time)
- Dependency on external service availability

---

## Consequences

The system favors simplicity over scalability.

Future evolution may require:

- Migration from Sheets to a structured database
- Introduction of queue-based processing
- Event-driven architecture for real-time processing
- Centralized rule engine for complex logic

---

## Summary

This architecture intentionally prioritizes maintainability and operational efficiency over system complexity. It is suitable for lightweight business automation workflows where flexibility and speed of iteration are more important than strict data consistency or high-scale processing.
