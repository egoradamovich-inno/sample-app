---
title: Understanding Phase
type: moc
phase: 1
description: Gather requirements and explore ideas through brainstorming.
---

# Understanding Phase

The first phase gathers and clarifies what needs to be built. It produces a task directory (`tasks/TASK-N/`) with requirements and design documents that feed into [[moc-planning]].

## Commands

[[/requirements-analyst]] parses requirements from Confluence pages, specifications, or user stories. It decomposes them into functional requirements, business rules, and a task breakdown, outputting `requirements-analyst-requirements.md`. Use this when you have existing specs or documentation to analyze.

[[/brainstorm]] turns ideas into fully formed designs through collaborative dialogue. It explores intent, constraints, and success criteria before documenting the design in `brainstorming-design.md`. Use this when starting from an idea rather than a formal spec.

## Flow

The default path is [[/requirements-analyst]] then [[/brainstorm]] — analyze first, then refine into a design. However, if requirements are already clear, [[/brainstorm]] can be the entry point. Both commands feed into [[moc-planning]], typically starting with [[/architect]].

## Outputs

All outputs are written to `tasks/TASK-N/`:
- `requirements-analyst-requirements.md` — structured requirements with gap analysis
- `brainstorming-design.md` — design document with architecture decisions

## Next Phase

Continue to [[moc-planning]] to design architecture, APIs, and implementation plans.
