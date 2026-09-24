---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace - creates isolated git worktrees for backend, frontend, or both for parallel development
phase: execution
flow-next: coder
flow-alternatives: [coder-frontend]
related: [writing-plans, coder]
---

# Using Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching. Supports parallel backend/frontend development with separate worktrees.

**Core principle:** Systematic directory selection + safety verification = reliable isolation.

**Announce at start:** "I'm using the using-git-worktrees skill to set up isolated workspace(s)."

## Step 1: Determine Worktree Type

**Ask user what worktrees to create. Use AskUserQuestion tool:**

```
How would you like to organize your worktree(s)?

1. Single worktree (unified)
   Best for: small-to-medium features, tightly coupled changes, or when you prefer working in one place. All backend and frontend work happens in one isolated branch.

2. Separate worktrees (backend + frontend)
   Best for: large features, parallel development by different sessions, or when backend and frontend have independent lifecycles. Creates two isolated branches that can be merged separately.

3. Single worktree (backend only)
   Best for: API-only work, backend services, or when the feature has no frontend component.

4. Single worktree (frontend only)
   Best for: UI-only changes, styling updates, or when backend is already complete/unchanged.

Which option?
```

**Branch naming convention:**
- Single unified: `feature/<name>`
- Backend only: `feature/<name>`
- Frontend only: `feature/<name>`
- Separate (both): `feature/<name>-backend` and `feature/<name>-frontend`

## Step 2: Directory Selection

Follow this priority order:

### 2.1. Check Existing Directories

```bash
# Check in priority order
ls -d .worktrees 2>/dev/null     # Preferred (hidden)
ls -d worktrees 2>/dev/null      # Alternative
```

**If found:** Use that directory. If both exist, `.worktrees` wins.

### 2.2. Check CLAUDE.md

```bash
grep -i "worktree.*director" CLAUDE.md 2>/dev/null
```

**If preference specified:** Use it without asking.

### 2.3. Ask User

If no directory exists and no CLAUDE.md preference. **Use AskUserQuestion tool.**

```
No worktree directory found. Where should I create worktrees?

1. .worktrees/ (project-local, hidden)
2. ~/worktrees/<project-name>/ (global location)

Which would you prefer?
```

## Step 3: Safety Verification

### For Project-Local Directories

**MUST verify directory is ignored before creating worktree:**

```bash
git check-ignore -q .worktrees 2>/dev/null
```

**If NOT ignored:**
1. Add to .gitignore
2. Commit the change
3. Proceed with worktree creation

## Step 4: Create Worktree(s)

### Single Worktree (Unified, Backend-only, or Frontend-only)

```bash
# Create worktree with new branch
git worktree add <worktree-dir>/<feature-name> -b feature/<feature-name>
cd <worktree-dir>/<feature-name>
```

### Separate Worktrees (Backend + Frontend)

```bash
# Create backend worktree
git worktree add <worktree-dir>/<feature-name>-backend -b feature/<feature-name>-backend

# Create frontend worktree
git worktree add <worktree-dir>/<feature-name>-frontend -b feature/<feature-name>-frontend
```

## Step 5: Verify Project Structure

**CRITICAL:** Ensure the worktree has proper `backend/` and `frontend/` directories.

```
worktree-root/
├── backend/           ← All backend code here
│   ├── src/
│   ├── package.json
│   └── ...
└── frontend/          ← All frontend code here
    ├── src/
    ├── package.json
    └── ...
```

**Why:** This prevents merge conflicts when branches are merged. Backend and frontend files MUST NOT be created in the project root (no `src/`, `package.json` at root level).

**Do NOT create a root `package.json`, `node_modules`, or `package-lock.json`.** Backend and frontend are independent projects.

```bash
# Verify or create structure
mkdir -p backend frontend
```

## Step 6: Run Project Setup (each worktree)

Auto-detect and run appropriate setup in each worktree:

```bash
# Node.js - backend
if [ -f backend/package.json ]; then cd backend && npm install && cd ..; fi

# Node.js - frontend
if [ -f frontend/package.json ]; then cd frontend && npm install && cd ..; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

## Step 7: Verify Clean Baseline (each worktree)

Run tests to ensure worktree starts clean:

```bash
# For unified worktree (both backend and frontend)
npx nx test backend && npx nx test frontend

# For backend-only worktree
npx nx test backend

# For frontend-only worktree
npx nx test frontend
```

**If tests fail:** Report failures, ask whether to proceed or investigate. **Use AskUserQuestion tool.**

**If tests pass:** Report ready.

## Step 8: Report Location(s)

### Single Worktree (Unified)

```
Worktree ready at <full-path>
Branch: feature/<feature-name>
Type: Unified (backend + frontend in one branch)
Tests passing (backend: <N>, frontend: <M>)
Ready to implement <feature-name>
```

### Single Worktree (Backend-only or Frontend-only)

```
Worktree ready at <full-path>
Branch: feature/<feature-name>
Type: <Backend-only | Frontend-only>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

### Separate Worktrees

```
Worktrees ready for parallel development:

Backend:
  Path: <full-path-backend>
  Branch: feature/<feature-name>-backend
  Tests: passing (<N> tests)

Frontend:
  Path: <full-path-frontend>
  Branch: feature/<feature-name>-frontend
  Tests: passing (<N> tests)

Ready for parallel implementation of <feature-name>
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| `.worktrees/` exists | Use it (verify ignored) |
| `worktrees/` exists | Use it (verify ignored) |
| Both exist | Use `.worktrees/` |
| Neither exists | Check CLAUDE.md → Ask user (Use AskUserQuestion tool) |
| Directory not ignored | Add to .gitignore + commit |
| Tests fail during baseline | Report failures + ask (Use AskUserQuestion tool) |
| Small/medium feature, tightly coupled | Single unified worktree |
| Large feature, independent lifecycles | Separate backend/frontend worktrees |
| Backend-only or frontend-only work | Single worktree for that layer |
| **New project/worktree** | Create `backend/` and `frontend/` directories first |

## Common Mistakes

- **Creating files in project root** - Backend/frontend code MUST go in `backend/` and `frontend/` directories to avoid merge conflicts
- **Skipping ignore verification** - Worktree contents get tracked
- **Assuming directory location** - Creates inconsistency
- **Proceeding with failing tests** - Can't distinguish new bugs from pre-existing
- **Not asking user preference** - Different features benefit from different setups
- **Using separate worktrees for tightly coupled work** - Creates merge coordination overhead
- **Creating root `package.json`** — No monorepo; backend and frontend install dependencies independently via `cd backend && npm install` / `cd frontend && npm install`

---

## Next Steps

After worktree(s) created and verified, STOP and present these options:

### For Single Worktree (Unified)

**Next by flow:** Start with whichever layer makes sense for the feature: See [[moc-execution]] for phase context.
- [[/coder]] `[context]` - Start with backend implementation
- [[/frontend-design]] `[context]` - Start with UI design
- [[/coder-frontend]] `[context]` - Start with frontend implementation

**Note:** All changes stay in one branch, making it easy to coordinate tightly-coupled backend and frontend work.

### For Single Worktree (Backend-only)

**Next by flow:** [[/coder]] `[context]` - Start backend implementation in the worktree. See [[moc-execution]] for phase context.

**Alternatives:**
- [[/code-reviewer]] `[context]` - Review existing code before implementing.

### For Single Worktree (Frontend-only)

**Next by flow:** [[/frontend-design]] `[context]` - Design UI before frontend implementation. See [[moc-execution]] for phase context.

**Alternatives:**
- [[/coder-frontend]] `[context]` - Start frontend implementation directly.

### For Separate Worktrees (Backend + Frontend)

**Next by flow:** Start implementation in both worktrees: See [[moc-execution]] for phase context.
- Backend: [[/coder]] `[context]` in the backend worktree
- Frontend: [[/frontend-design]] `[context]` or [[/coder-frontend]] `[context]` in the frontend worktree

**Note:** With separate worktrees, you can work on backend and frontend independently and merge when both are complete. Ideal for parallel sessions or when changes have different review cycles.
