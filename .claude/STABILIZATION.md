# Stabilization Process — Error-to-Rule Cycle

When an agent makes a mistake that should never happen again, convert it into a permanent rule.

## 5-Step Cycle

```
1. ERROR occurs → 2. Identify ROOT CAUSE → 3. Create RULE → 4. Add EXAMPLE → 5. ENFORCE
```

### Step 1: Error Occurs
An agent produces incorrect output, violates a convention, or makes a mistake.

### Step 2: Identify Root Cause
Ask: "Why did the agent do this?" Common causes:
- Ambiguous instruction (soft wish instead of hard constraint)
- Missing context (agent didn't know about the convention)
- Wrong model level (task needed more reasoning than assigned model provides)

### Step 3: Create Rule
Write a MUST/MUST NOT rule in the appropriate file:
- **Global policy** → `AGENTS.md`
- **Style convention** → `GOLDEN-PRINCIPLES.md`
- **Skill-specific** → relevant `SKILL.md`

### Step 4: Add Example
Add a concrete correct/incorrect example near the rule:
```
MUST NOT: `tasks/TASK-001/requirements.md`
MUST:     `tasks/TASK-001/requirements-analyst-requirements.md`
```

### Step 5: Enforce
Choose enforcement level:
- **Hook** (automated) — for rules that can be checked programmatically
- **Skill instruction** (semi-automated) — agent follows during execution
- **Review checklist** (manual) — verified during code review

## Template for New Rules

```markdown
### Rule: {Short Name}

**Trigger:** What error was observed?
**Root cause:** Why did it happen?
**Rule:** MUST/MUST NOT statement
**Example:**
- Incorrect: {bad example}
- Correct: {good example}
**Enforcement:** Hook / Skill instruction / Review checklist
**Added:** YYYY-MM-DD
```

## Example Stabilization Cycles

### Cycle 1: File Naming Convention

**Trigger:** Agent created `tasks/TASK-001/requirements.md` instead of prefixed name.
**Root cause:** Skill said "output requirements" but didn't enforce prefix naming.
**Rule:** MUST prefix output files with skill name: `{skill-name}-{purpose}.md`
**Example:**
- Incorrect: `requirements.md`, `design.md`, `plan.md`
- Correct: `requirements-analyst-requirements.md`, `brainstorming-design.md`
**Enforcement:** `file-naming-validator.sh` hook (PreToolUse:Write|Edit)
**Added:** 2026-03-05

### Cycle 2: Task Directory Format

**Trigger:** Agent created `TASK-1/` but skills reference `TASK-001/` format.
**Root cause:** No single authority on naming format. README said one thing, skills said another.
**Rule:** MUST use zero-padded 3-digit format: `TASK-001`, `TASK-002`
**Example:**
- Incorrect: `TASK-1/`, `TASK-12/`
- Correct: `TASK-001/`, `TASK-012/`
**Enforcement:** Skill instructions + tasks/README.md
**Added:** 2026-03-05

### Cycle 3: Proceeding with Failing Tests

**Trigger:** Coder agent claimed completion while tests were still failing.
**Root cause:** Skill had linear flow (test -> review) with no loop-back on failure.
**Rule:** MUST NOT proceed to completion with failing tests. Max 3 fix attempts, then escalate.
**Example:**
- Incorrect: Tests fail -> Mark complete -> Suggest /code-reviewer
- Correct: Tests fail -> Read error -> Fix -> Re-run -> (repeat up to 3x) -> Escalate to /debugger
**Enforcement:** Verify-fix loop in coder/coder-frontend SKILL.md + /verify command
**Added:** 2026-03-05
