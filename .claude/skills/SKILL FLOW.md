---
title: Accelerator Skill Flow
type: index
description: Master navigation for the command → agent → skill workflow.
---

# Skill Flow Reference

This document defines the recommended order of skills. Each skill stops after completion and suggests the next step - the user decides whether to continue.

## Navigation

The workflow progresses through four phases. [[moc-understanding]] gathers and analyzes requirements. [[moc-planning]] designs architecture and APIs. [[moc-execution]] implements, reviews, and tests code. [[moc-finalization]] handles documentation and releases.

Utility tools ([[moc-utility]]) are available at any time.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│             PHASE 1: UNDERSTANDING (Temporary task docs)            │
│                        Output: tasks/TASK-N/                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   /requirements-analyst ──────────────────► /brainstorm             │
│   (requirements-analyst-requirements.md)   (brainstorming-design.md)│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│             PHASE 2: PLANNING (Updates living specs)                │
│                        Output: specs/ + tasks/                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   /architect ──────► /api-designer ──► /frontend-design ──► /writing│
│   (architect-        (api-designer-    (frontend-design-    -plans  │
│    architecture.md)   spec.md)          spec.md)      (writing-     │
│                                                  plans-plan.md)     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PHASE 3: EXECUTION                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   /git-worktrees (create isolated workspace)                        │
│         │                                                           │
│         ├─────────────────────┬─────────────────────┐               │
│         ▼                     ▼                     │               │
│   ┌───────────────┐    ┌───────────────┐            │               │
│   │ FRONTEND      │    │ BACKEND       │            │               │
│   ├───────────────┤    ├───────────────┤            │               │
│   │ /coder-       │    │ /coder        │            │               │
│   │   frontend    │    │     │         │            │               │
│   │     │         │    │     ▼         │            │               │
│   │     ▼         │    │ /code-reviewer│            │               │
│   │ /browser-     │    │     │         │            │               │
│   │   verify (opt)│    │               │            │               │
│   │     │         │    │               │            │               │
│   │     ▼         │    │               │            │               │
│   │ /code-reviewer│    │     │         │            │               │
│   │     │         │    │     ▼         │            │               │
│   │     ▼         │    │ /test-        │            │               │
│   │ /test-        │    │   generator   │            │               │
│   │   generator   │    │     │         │            │               │
│   │     │         │    │     ▼         │            │               │
│   │     ▼         │    │  ┌──FAIL?──┐  │            │               │
│   │  ┌──FAIL?──┐  │    │  │fix→re-  │  │            │               │
│   │  │fix→re-  │  │    │  │run(3x)  │  │            │               │
│   │  │run(3x)  │  │    │  │else →   │  │            │               │
│   │  │else →   │  │    │  │/debugger│  │            │               │
│   │  │/debugger│  │    │  └─────────┘  │            │               │
│   │  └─────────┘  │    │     │         │            │               │
│   │     │         │    │     ▼         │            │               │
│   │     ▼         │    │ /verify       │            │               │
│   │ /verify       │    │     │         │            │               │
│   │     │         │    │     ▼         │            │               │
│   │     ▼         │    │ /finishing-   │            │               │
│   │ /finishing-   │    │   branch      │            │               │
│   │   branch      │    └───────────────┘            │               │
│   └───────────────┘            │                    │               │
│         │                      │                    │               │
│         └──────────────────────┴────────────────────┘               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│             PHASE 4: FINALIZATION (Updates ongoing docs)            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   /docs-generator ──► /release ──► /finishing-branch                │
│   (README, ADRs, specs)  (CHANGELOG + GitHub Release)  (merge/PR)   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Reference: Next by Flow

| Current Command           | Next by Flow                          | Why                                    |
| ------------------------- | ------------------------------------- | -------------------------------------- |
| [[/requirements-analyst]] | [[/brainstorm]]                       | Turn requirements into design          |
| [[/brainstorm]]           | [[/architect]]                        | Review architecture for the design     |
| [[/architect]]            | [[/api-designer]]                     | Design APIs based on architecture      |
| [[/api-designer]]         | [[/frontend-design]]                  | Design UI based on API design          |
| [[/frontend-design]]      | [[/writing-plans]]                    | Create implementation tasks from specs |
| [[/writing-plans]]        | [[/git-worktrees]]                    | Create isolated workspace              |
| [[/git-worktrees]]        | [[/coder]] or [[/coder-frontend]]     | Start implementation                   |
| [[/coder-frontend]]       | [[/browser-verify]] or [[/code-reviewer]] | Verify UI in browser or review code |
| [[/browser-verify]]       | [[/code-reviewer]]                    | Review the code after visual verify    |
| [[/coder]]                | [[/code-reviewer]]                    | Review the backend code                |
| [[/code-reviewer]]        | [[/test-generator]]                   | Generate tests for reviewed code       |
| [[/test-generator]]       | [[/verify]] or [[/debugger]]          | Verify DoD or debug failures           |
| [[/debugger]]             | [[/test-generator]]                   | Re-run tests after fix                 |
| [[/verify]]               | [[/finishing-branch]]                 | Complete if all checks pass            |
| [[/docs-generator]]       | [[/release]] or [[/finishing-branch]] | Create release or complete the branch  |
| [[/release]]              | [[/finishing-branch]]                 | Complete the branch                    |
| [[/finishing-branch]]     | (end)                                 | Workflow complete                      |

## Entry Points

Choose your starting point based on your situation:

| Situation                     | Start With                         |
| ----------------------------- | ---------------------------------- |
| Have requirements/specs       | [[/requirements-analyst]]          |
| Have an idea to explore       | [[/brainstorm]]                    |
| Have a plan ready             | [[/git-worktrees]] then [[/coder]] |
| Existing project, add feature | [[/git-worktrees]] then [[/coder]] |
| Fix a bug                     | [[/debugger]]                      |

## Utility Commands (Any Time)

| Command                 | When to Use                              |
| ----------------------- | ---------------------------------------- |
| [[/reflect]]            | Turn agent mistakes into permanent rules |
| [[/skill-creator]]      | Create a new skill                       |
| [[/accelerator-update]] | Update accelerator to latest version     |

## How It Works

1. **User runs a command** (e.g., [[/requirements-analyst]] `[prompt]`)
2. **Command spawns an agent** that runs in isolation
3. **Agent executes the skill** following its instructions
4. **Agent stops and outputs:**
   - Context summary (what was done)
   - Next step suggestion by flow
   - Alternative suggestions
5. **User decides** whether to run the next command

## Context Handoff

Each command's output includes a context summary. Pass this to the next command:

```
/brainstorm Based on requirements analysis: [paste context summary]
```

This keeps the main conversation clean while preserving continuity.

## Example Flows

### New Full-Stack Project

```
/brainstorm Design e-commerce app
→ /architect Review architecture decisions
→ /writing-plans Create implementation tasks
→ /git-worktrees Create workspace
→ /coder Implement backend features
→ /coder-frontend Implement frontend
→ /browser-verify Verify UI in browser
→ /code-reviewer Review all code
→ /test-generator Generate tests
→ /docs-generator Update documentation
→ /release Create release with changelog
→ /finishing-branch Complete feature
```

### New Backend Only

```
/brainstorm Design user management API
→ /architect Review architecture decisions
→ /writing-plans Create implementation tasks
→ /git-worktrees Create workspace
→ /coder Implement features
→ /test-generator Generate tests
→ /docs-generator Update documentation
→ /release Create release with changelog
→ /finishing-branch Complete
```

### Adding Feature to Existing Project

```
/requirements-analyst Parse new feature spec
→ /brainstorm Design the feature
→ /architect Review architecture
→ /writing-plans Create implementation tasks
→ /git-worktrees Create workspace
→ /coder Implement feature
→ /code-reviewer Review code
→ /test-generator Generate tests
→ /docs-generator Update documentation
→ /release Create release with changelog
→ /finishing-branch Complete
```
