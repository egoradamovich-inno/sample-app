---
name: verify
description: Run full Definition of Done checklist and report pass/fail status. Use before merging, creating PRs, or claiming task completion. Triggers on "verify", "check DoD", "pre-merge check", "readiness check".
phase: execution
flow-next: finishing-branch
flow-alternatives: [coder, debugger]
related: [code-reviewer, test-generator, browser-verify]
---

# Verify

## Overview

Run the full Definition of Done checklist from `.claude/DOD.md` and produce a structured pass/fail report. This is the final gate before merge or PR creation.

## Generated File Naming Convention (MANDATORY)

**ANY file created by this skill MUST be prefixed with `verify-`:**
- `verify-report.md`, `verify-checklist.md`

## Verification Workflow

### Step 1: Determine Tier

- If this is a release/merge to main: **Full** tier
- If this is an implementation task: **Standard** tier
- Otherwise: **Minimum** tier

### Step 2: Run Checks

For each applicable check in the tier, run the command and record result:

#### Minimum Checks
1. `git diff --stat` — any uncommitted changes?
2. Check file naming in `tasks/` and `specs/` — all files use skill prefix?
3. Context Summary present?

#### Standard Checks (adds to Minimum)
4. `npx nx run-many --target=test --all` OR `npm test` — tests pass?
5. `npx nx run-many --target=lint --all` OR `npm run lint` — lint clean?
6. `npx nx run-many --target=build --all` OR `npm run build` — build succeeds?
7. `npx tsc --noEmit` — TypeScript errors? (if tsconfig.json exists)
8. New code has test coverage?
9. No OWASP Top 10 vulnerabilities?

#### Full Checks (adds to Standard)
10. `gh run list --limit 1` — CI passing?
11. PR description has summary + test plan?
12. CHANGELOG.md updated? (if release)
13. Specs updated if architecture/API changed?
14. No unresolved TODO/FIXME/HACK?
15. Documentation updated for user-facing changes?

### Step 3: Handle Missing Tooling

If a command is not available (no test runner, no linter, no build script):
- Record as `N/A — tooling not configured`
- Do NOT fail the check
- Do NOT try to install missing tooling

### Step 4: Generate Report

```markdown
## Verification Report

**Tier:** Standard
**Date:** YYYY-MM-DD
**Branch:** feature/xyz

| # | Check | Status | Details |
|---|-------|--------|---------|
| 1 | Uncommitted changes | PASS | Clean working tree |
| 2 | File naming | PASS | All files prefixed |
| 3 | Tests | FAIL | 2 failing in user.spec.ts |
| 4 | Lint | PASS | No issues |
| ... | ... | ... | ... |

**Result:** FAIL (1 blocking issue)

### Blocking Issues
- Tests: 2 failures in user.spec.ts — run `/debugger` to investigate

### Recommendations
- Fix test failures before merging
```

### Step 5: Actionable Output

- If all checks PASS: Recommend proceeding to `/finishing-branch`
- If any checks FAIL: List specific fix actions with commands

---

## Next Steps

After verification is complete, STOP and present these options:

**If PASS — Next by flow:** [[/finishing-branch]] `[context]` - Complete branch work, create PR or merge.

**If FAIL — Alternatives:**
- [[/coder]] `[context]` - Fix implementation issues found during verification.
- [[/debugger]] `[context]` - Debug failing tests or build issues.
- [[/test-generator]] `[context]` - Add missing test coverage.
