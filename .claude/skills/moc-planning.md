---
title: Planning Phase
type: moc
phase: 2
description: Design architecture, APIs, UI, and create implementation plans.
---

# Planning Phase

The second phase turns requirements and designs from [[moc-understanding]] into actionable specifications. It updates living spec files in `specs/` and produces implementation plans in `docs/plans/`.

## Commands

[[/architect]] makes system architecture decisions — choosing patterns, evaluating scalability and security, and documenting the technical approach in `specs/architect-architecture.md`.

[[/api-designer]] designs REST APIs with proper conventions, DTOs, Swagger documentation, and Bruno collections. Outputs to `specs/api-designer-spec.md`.

[[/frontend-design]] creates distinctive, production-grade UI specifications with high design quality. Outputs to `specs/frontend-design-spec.md`.

[[/writing-plans]] produces detailed implementation plans with bite-sized tasks for engineers with zero codebase context. Outputs to `docs/plans/`.

## Flow

The default path is [[/architect]] then [[/api-designer]] then [[/frontend-design]] then [[/writing-plans]]. Steps can be skipped based on project needs — a backend-only project skips [[/frontend-design]], and a simple feature may go directly from [[/architect]] to [[/writing-plans]].

## Outputs

- `specs/architect-architecture.md` — architecture decisions and patterns
- `specs/api-designer-spec.md` — REST API specification with DTOs
- `specs/frontend-design-spec.md` — UI specification and styling
- `docs/plans/` — implementation plans with task breakdowns

## Next Phase

Continue to [[moc-execution]] to create workspaces and implement the plan.
