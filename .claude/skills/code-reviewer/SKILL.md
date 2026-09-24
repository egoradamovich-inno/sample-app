---
name: code-reviewer
description: Review code for quality, standards compliance, security issues, and performance problems. Use when reviewing PRs, checking code quality, finding bugs, or ensuring standards compliance. Triggers on "review code", "code review", "check this", "review PR", "find issues", "code quality".
phase: execution
flow-next: test-generator
flow-alternatives: [coder, coder-frontend]
related: [coder, coder-frontend, browser-verify]
---

# Code Reviewer

## Overview

Review code for quality, standards compliance, security issues, and performance problems.

## Generated File Naming Convention (MANDATORY)

**ANY file created by this skill MUST be prefixed with `code-reviewer-`:**
- ✅ `code-reviewer-report.md`, `code-reviewer-findings.md`
- ❌ `REVIEW_REPORT.md`, `FINDINGS.md`

This applies to ALL generated files — review reports, summaries, findings.

## Review Categories

### 1. Architecture Compliance

- [ ] Correct layer placement (controller, service, repository)
- [ ] Dependencies flow in correct direction
- [ ] Proper module organization
- [ ] Single responsibility principle

### 2. Code Quality

- [ ] Clear naming conventions
- [ ] No magic numbers/strings
- [ ] DRY - no duplicate code
- [ ] YAGNI - no unnecessary features
- [ ] Proper error handling
- [ ] Comments only where logic is non-obvious

### 3. TypeScript Best Practices

- [ ] No `any` types
- [ ] Interfaces for object shapes
- [ ] Explicit return types on public methods
- [ ] Proper null/undefined handling
- [ ] Correct use of `readonly`

### 4. Security

- [ ] Input validation present
- [ ] No hardcoded secrets
- [ ] Proper authorization checks
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)

### 5. Performance

- [ ] No N+1 queries
- [ ] Proper indexing considered
- [ ] Efficient algorithms
- [ ] No memory leaks
- [ ] Async operations where appropriate

### 6. Testing

- [ ] Unit tests present
- [ ] Edge cases covered
- [ ] Tests are readable
- [ ] Mocks used appropriately

### 7. Frontend-Specific (when reviewing UI code)

When reviewing React/Vue/Angular components or frontend code:

1. **Fetch Web Interface Guidelines**: Use WebFetch to retrieve the latest rules from:
   ```
   https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
   ```

2. **Apply the fetched guidelines** to check for:
   - Accessibility compliance
   - UX best practices
   - Interaction patterns
   - Visual design consistency

3. **Output format**: Use the terse `file:line` format as specified in the fetched guidelines

### 8. WCAG Accessibility (when reviewing UI code)

When reviewing frontend code, apply WCAG 2.2 Level AA accessibility rules from the `wcag-accessibility` skill. Read the skill's `AGENTS.md` for the full compiled guide, or individual rules from `rules/` by category:

**CRITICAL priority:**
- [ ] Semantic HTML (headings hierarchy, landmarks, button vs link, lists, tables)
- [ ] Keyboard accessibility (focus visible, tab order, interactive elements, focus trap, skip link)

**HIGH priority:**
- [ ] ARIA usage (prefer semantic HTML, accessible names, live regions, aria-hidden misuse, expanded states)
- [ ] Color contrast (text 4.5:1, large text 3:1, UI components 3:1, color not sole indicator)

**MEDIUM-HIGH priority:**
- [ ] Forms (labels, error messages, autocomplete, fieldset/legend)

**MEDIUM priority:**
- [ ] Media (alt text, decorative images, video captions)
- [ ] Motion (prefers-reduced-motion, no autoplay, safe transitions)

**LOW-MEDIUM priority:**
- [ ] Responsive (text resize, reflow at 320px, touch targets 44x44)

Read individual rule files for detailed incorrect/correct code examples:
```
wcag-accessibility/rules/semantic-heading-hierarchy.md
wcag-accessibility/rules/keyboard-focus-visible.md
wcag-accessibility/rules/aria-labels-required.md
```

## Code Smells

| Smell | Issue | Fix |
|-------|-------|-----|
| Long method | Hard to understand | Extract to smaller methods |
| Large class | Too many responsibilities | Split into focused classes |
| Feature envy | Method uses other class data | Move method to that class |
| Data clumps | Same data groups repeated | Create a class for it |
| Primitive obsession | Using primitives for domain concepts | Create value objects |
| Switch statements | Often indicates missing polymorphism | Use strategy pattern |
| Parallel inheritance | Two hierarchies change together | Merge or compose |
| Dead code | Unused code | Delete it |
| Comments | Explaining bad code | Refactor to be self-documenting |

## Review Process

### Step 1: Understand Context

- What is the purpose of this change?
- What requirements does it fulfill?
- What existing code does it interact with?

### Step 2: Check Architecture

- Does it follow project patterns?
- Is it in the correct layer?
- Are dependencies correct?

### Step 3: Review Logic

- Does the code do what it's supposed to?
- Are edge cases handled?
- Are errors handled properly?

### Step 4: Check Tests

- Are there tests?
- Do tests cover the functionality?
- Are tests readable and maintainable?

### Step 5: Pre-Completion Verification

Cross-reference against [DOD.md](../../DOD.md) (Standard tier):
- Verify tests exist and pass (if test tooling present)
- Verify lint passes (if lint tooling present)
- Verify file naming follows skill-prefix convention
- Include verification evidence in review output

### Step 6: Provide Feedback

Format feedback as:

```markdown
## Summary
[Overall assessment]

## Issues Found

### Critical (Must Fix)
- [ ] [Issue description] - [File:Line]

### Major (Should Fix)
- [ ] [Issue description] - [File:Line]

### Minor (Consider)
- [ ] [Issue description] - [File:Line]

### Positive Notes
- [What was done well]
```

## Severity Guidelines

| Severity | Criteria | Examples |
|----------|----------|----------|
| Critical | Security issue, data loss, crash, a11y blocker | SQL injection, missing auth, no keyboard access |
| Major | Bug, poor performance, maintainability, a11y barrier | N+1 query, duplicate code, missing alt text, no focus visible |
| Minor | Style, naming, small improvements, a11y enhancement | Variable naming, comments, missing autocomplete |

---

## Next Steps

After code review is complete, STOP and present these options:

**Next by flow:** [[/test-generator]] `[context]` - Generate tests for the reviewed code. See [[moc-execution]] for phase context.

**Alternatives:**
- [[/coder]] `[context]` - Fix issues identified in the review.
- [[/finishing-branch]] `[context]` - Complete branch if review passes and tests exist.
