# Definition of Done (DoD)

Tiered checklist. Every item is verifiable by command. Commands are conditional: run if tooling exists, else report missing.

## Minimum (every task)

- [ ] No uncommitted changes that belong to the task: `git diff --stat`
- [ ] File naming follows skill-prefix convention: check `tasks/` and `specs/` files
- [ ] Context Summary provided with 2-3 sentences + Next Steps

## Standard (implementation tasks)

All Minimum items, plus:

- [ ] Tests pass: `npx nx run-many --target=test --all` or `npm test` (if present)
- [ ] Lint passes: `npx nx run-many --target=lint --all` or `npm run lint` (if present)
- [ ] Build succeeds: `npx nx run-many --target=build --all` or `npm run build` (if present)
- [ ] No TypeScript errors: `npx tsc --noEmit` (if tsconfig.json exists)
- [ ] New code has test coverage (at least happy path): `grep -r "describe\|it(" <test-dir>` to confirm test file exists
- [ ] No OWASP Top 10 vulnerabilities introduced (manual review — check input validation, auth, injection points)
- [ ] Code reviewed or self-reviewed against GOLDEN-PRINCIPLES.md (manual review — if file exists)

## Full (release / merge to main)

All Standard items, plus:

- [ ] All CI checks pass: `gh run list --limit 1`
- [ ] PR description includes summary and test plan
- [ ] CHANGELOG.md updated (if release)
- [ ] Specs updated if architecture/API changed
- [ ] No TODO/FIXME/HACK comments left unresolved: `grep -rn "TODO\|FIXME\|HACK" <src-dirs>`
- [ ] Documentation updated for user-facing changes (manual review)

## How to Use

1. Before marking a task complete, run the applicable tier's checks
2. If a command is not available (no test runner, no linter), note it as "N/A — tooling not configured"
3. If a check fails, fix it or escalate to `/debugger`
4. Include verification evidence in your Context Summary
