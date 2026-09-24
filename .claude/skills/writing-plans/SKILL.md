---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code. Creates detailed implementation plans with bite-sized tasks for engineers with zero codebase context.
phase: planning
flow-next: using-git-worktrees
flow-alternatives: [coder, coder-frontend]
related: [brainstorming, architect]
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

## Generated File Naming Convention (MANDATORY)

**ANY file created by this skill MUST be prefixed with `writing-plans-`.**
Predefined output (`writing-plans-plan.md`) already follows this convention.
Any additional ad-hoc files (summaries, notes) MUST also follow this rule:
- ✅ `writing-plans-task-breakdown.md`
- ❌ `TASK_BREAKDOWN.md`

## Task Numbering

**Before creating the plan:**

1. **Check if task number provided:**
   - If coming from `/requirements-analyst` or `/brainstorm`, use the task number from context (e.g., "TASK-001")
   - If no task number: run task counter logic

2. **Task counter logic (if no task number provided):**
   - If `tasks/.task-counter` exists: read the number, use it, increment and write back
   - If missing: scan `tasks/` for existing `TASK-*` directories, use max(N) + 1, create counter file

3. **Create task directory:** `tasks/TASK-{N}/` (if not already created)

4. **Save plan to:** `tasks/TASK-{N}/writing-plans-plan.md`

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

**Task:** TASK-{N}

> **For Claude:** Use `using-git-worktrees` to create isolated workspace, then implement with `coder` skill.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Task Structure

```markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts:123-145`
- Test: `exact/path/__tests__/file.spec.ts`

**Step 1: Write the failing test**

\`\`\`typescript
describe('ComponentName', () => {
  it('should do specific thing', () => {
    const result = doThing(input);
    expect(result).toBe(expected);
  });
});
\`\`\`

**Step 2: Run test to verify it fails**

Run: `npx nx test project -- --testPathPattern=file.spec.ts`
Expected: FAIL with "function not defined"

**Step 3: Write minimal implementation**

\`\`\`typescript
export function doThing(input: InputType): OutputType {
  return expected;
}
\`\`\`

**Step 4: Run test to verify it passes**

Run: `npx nx test project -- --testPathPattern=file.spec.ts`
Expected: PASS

**Step 5: Commit**

\`\`\`bash
git add path/to/files
git commit -m "feat(domain): add specific feature"
\`\`\`
```

## Project Structure Reference

When creating plans for new projects, use these standard structures:

### Backend (NestJS)

```
apps/backend/src/
├── main.ts
├── app.module.ts
├── shared/
│   ├── config/           # Environment configuration
│   ├── logger/           # Structured logging
│   ├── database/         # TypeORM/Prisma connection
│   ├── errors/           # Global error handling
│   └── health/           # Health check endpoints
└── modules/
    └── <name>/
        ├── <name>.module.ts
        ├── <name>.controller.ts
        ├── <name>.service.ts
        ├── <name>.repository.ts
        ├── dto/
        │   ├── create-<name>.dto.ts
        │   └── update-<name>.dto.ts
        └── entities/
            └── <name>.entity.ts
```

### Frontend (React)

```
apps/frontend/src/
├── main.tsx
├── App.tsx
├── api/
│   ├── client.ts              # Axios/fetch wrapper
│   └── endpoints/             # API functions per feature
├── components/
│   ├── ui/                    # Reusable UI components
│   └── layout/                # Layout components
├── features/
│   └── <feature>/
│       ├── components/        # Feature-specific components
│       ├── hooks/             # Feature-specific hooks
│       └── types/             # Feature types
├── hooks/                     # Shared hooks
├── pages/                     # Page components
├── providers/                 # Context providers
├── routes/                    # Route definitions
├── styles/                    # Global styles
├── types/                     # Shared types
└── utils/                     # Utility functions
```

### Full-Stack

```
project-root/
├── apps/
│   ├── backend/     # NestJS structure above
│   └── frontend/    # React structure above
├── libs/            # Shared libraries (types, utils)
└── package.json     # Workspaces config
```

## Remember

- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- Reference relevant skills with backticks
- DRY, YAGNI, TDD, frequent commits

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `tasks/TASK-{N}/writing-plans-plan.md`. Execution options:**

**1. Execute Now** - Use `/coder` to implement in current workspace

**2. Isolated Workspace** - Use `/git-worktrees` to create isolated workspace, then `/coder`

**Which approach?"**

---

## Next Steps

After the plan is complete and saved, STOP and present these options:

**Next by flow:** [[/architect]] `[TASK-{N} context]` - Review architecture decisions before implementation. See [[moc-planning]] for phase context.

**Pass to next skill:** Include the task number in your context summary (e.g., "TASK-001: User authentication plan created")

**Alternatives:**
- [[/git-worktrees]] `[TASK-{N} context]` - Create isolated workspace for development.
- [[/coder]] `[TASK-{N} context]` - Start implementing directly in current workspace.
