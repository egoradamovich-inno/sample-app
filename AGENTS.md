# AGENTS.md — Policy Rules

These are enforceable rules. Wishes are ignored, constraints are enforced.

## Hierarchy of Sources of Truth

1. **Enforcement** (hooks, CI, linters) — automated, highest authority
2. **Policy** (this file) — MUST/MUST NOT rules
3. **Architecture** ([specs/](specs/MANIFEST.md)) — system design decisions
4. **Operations** ([skills/](.claude/skills/)) — how skills execute
5. **Examples** ([examples/](examples/)) — reference implementations
6. **Documentation** ([.claude/README.md](.claude/README.md)) — human reference

## File Naming

- MUST prefix output files with skill name: `{skill-name}-{purpose}.md`
- MUST use zero-padded task dirs: `TASK-001/`, `TASK-002/`
- MUST place task docs in `tasks/TASK-{N}/`, specs in `specs/`
- MUST NOT create unprefixed .md files in tasks/ or specs/ (except README.md, MANIFEST.md)

## Agent Behavior

- MUST execute only its own skill, then STOP
- MUST NOT chain to other skills automatically
- MUST output Context Summary + Next Steps
- MUST NOT make workflow decisions for the user

## Code Quality

- MUST run tests before claiming completion (if test tooling exists)
- MUST run lint before claiming completion (if lint tooling exists)
- MUST NOT proceed with failing tests — fix or escalate to `/debugger`
- MUST NOT skip pre-commit hooks (--no-verify)
- MUST NOT force-push, hard-reset, or DROP TABLE without explicit user consent

## Context & Documentation

- MUST read existing code before modifying it
- MUST read MANIFEST.md before writing specs
- MUST check .task-counter before creating task dirs
- MUST NOT duplicate information across spec files — reference instead

## Security

- MUST NOT read or commit .env files or secrets/
- MUST NOT run rm -rf, sudo, or chmod 777
- MUST NOT introduce OWASP Top 10 vulnerabilities
- MUST validate at system boundaries (user input, external APIs)

## Definition of Done

- See [.claude/DOD.md](.claude/DOD.md) for tiered verification checklist
- MUST reference DOD.md before marking any task complete

## Style Invariants

- See [.claude/GOLDEN-PRINCIPLES.md](.claude/GOLDEN-PRINCIPLES.md) when available
