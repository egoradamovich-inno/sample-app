---
title: Execution Phase
type: moc
phase: 3
description: Implement, review, test, debug, and complete code in isolated workspaces.
---

# Execution Phase

The third phase implements the plans from [[moc-planning]] in isolated git worktrees. It follows a build-review-test loop until the code is ready for [[moc-finalization]].

## Commands

[[/git-worktrees]] creates isolated git workspaces for feature development — unified (backend + frontend together), separate (parallel development), or single-layer.

[[/coder]] implements backend features following layered architecture (Controller/Service/Repository).

[[/coder-frontend]] implements frontend features following component-based architecture and modern best practices.

[[/browser-verify]] visually verifies UI changes in the running app using agent-browser, catches console errors and broken interactions, and iterates fixes autonomously.

[[/code-reviewer]] reviews code for quality, standards compliance, security issues, and performance problems.

[[/test-generator]] generates comprehensive tests (unit, integration, E2E) and runs test suites with failure analysis.

[[/debugger]] investigates bugs, test failures, and unexpected behavior through systematic root cause analysis before proposing fixes.

[[/finishing-branch]] completes development work by presenting structured options for merge, PR, or cleanup.

## Flow

The default path is [[/git-worktrees]] then [[/coder]] or [[/coder-frontend]] then [[/code-reviewer]] then [[/test-generator]] then [[/finishing-branch]]. For frontend work, [[/browser-verify]] can be used after [[/coder-frontend]] to visually verify UI changes before code review. The [[/debugger]] is used when tests fail, creating a loop: [[/debugger]] then [[/test-generator]] until all tests pass. Backend and frontend can run in parallel using separate worktrees.

## Loop Pattern

```
/coder-frontend -> /browser-verify (optional) -> /code-reviewer -> /test-generator
  -> (tests pass?) -> /finishing-branch
  -> (tests fail?) -> /debugger -> /test-generator
```

## Next Phase

Continue to [[moc-finalization]] to update documentation and create releases.
