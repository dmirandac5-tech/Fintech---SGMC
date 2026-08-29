# Architecture Overview

## 1. Overview

The Microcredit Management System is organized around a domain-centered architecture.

The current implementation focuses on the executable domain core developed during E4. The main objective is to encapsulate the financial rules of the microcredit system in a set of cohesive TypeScript modules, keeping the business logic independent from infrastructure concerns.

The E4 implementation does not include a database, external services, Docker configuration, environment variables, or a web server. The domain core can be executed and tested independently. This scope is intentional and allows the financial rules to be validated before introducing infrastructure components.

---

## 2. Architectural Approach

The project follows a domain-oriented approach in which the most important business rules are concentrated inside the domain layer.

The current structure can be represented as follows:

```text
                    ┌───────────────────────────┐
                    │      External Layer       │
                    │   API / UI / Persistence  │
                    │       Future Scope        │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │    Application Layer      │
                    │       Future Scope       │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────┐
        │                  Domain Layer                    │
        │                                                  │
        │  ┌──────────┐     ┌──────────────────────────┐  │
        │  │  Dinero  │     │       Crédito            │  │
        │  └──────────┘     └────────────┬─────────────┘  │
        │                                │                │
        │       ┌────────────────────────┼───────────┐    │
        │       │                        │           │    │
        │       ▼                        ▼           ▼    │
        │  Amortización              Estados      Movimientos
        │       │                        │                │
        │       ▼                        ▼                │
        │  Estrategias              State Pattern         │
        │                                                  │
        │  Mora ── Prelación ── Cartera ── Política      │
        │                                                  │
        └──────────────────────────────────────────────────┘
