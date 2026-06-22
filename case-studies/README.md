# Case Studies

This directory contains architecture case studies derived from individual systems.

Each case study documents a single system: its structure, behavior, and the design decisions behind it.
The focus is on how the system is composed, how it runs in practice and the trade-offs involved in its design.

---

## Structure

Each folder under this directory follows a consistent pattern:

- `README.md` → Case study overview and context
- `architecture.md` → System design and data flow
- `ADR.md` → Key architectural decisions and trade-offs
- `src/` → Reference implementation
- `diagrams/` → Visual representation of system structure
- `.github/` → CI/CD or automation configuration (if applicable)

Not all case studies will include every element. Simpler systems may only contain a subset.

---


## Design Philosophy

These case studies are intentionally built around a few core principles:

- Prefer managed services over self-hosted infrastructure
- Encode business logic in transparent, readable workflows
- Minimize operational overhead
- Optimize for clarity over abstraction
- Keep systems explainable in a single diagram

---

## Purpose

This directory exists to document architectural thinking through working systems.

Each case study is designed to answer three questions:

- What problem does this system solve?
- Why was this architecture chosen?
- What trade-offs were accepted?

---

## Navigation

Start with any case study folder and follow:

`README → architecture → ADR → implementation`

This mirrors the progression from intent → design → decision → execution.
