# Quickstart: Validating the CI/CD Deployment Pipeline

Runnable scenarios proving this feature works end-to-end, mapped to spec.md's Independent Tests
and Success Criteria. Full manifest/contract details are in [contracts/manifests.md](./contracts/manifests.md)
and [data-model.md](./data-model.md) — not repeated here.

## Prerequisites (one-time, manual, per spec.md Assumptions — not automated by the pipeline)

1. Self-hosted GitHub Actions runner registered on this WSL2 host, with Docker, `kubectl`, and
   `kn` CLI installed (Principle V).
2. Isolated kubeconfig at a dedicated path (e.g. `~/.kube/sample-app-config`), copied from
   `k3s-control-plane`'s `/etc/rancher/k3s/k3s.yaml` with `server:` rewritten to
   `https://10.10.10.11:6443`, referenced via `KUBECONFIG` in the runner process's environment —
   **never** merged into this host's default `~/.kube/config` (confirmed during planning to
   already hold unrelated EKS contexts).
3. GitHub repository secrets set: `GHCR_PULL_PAT` (GHCR PAT, `read:packages` scope),
   `SAMPLE_APP_DB_PASSWORD` (stable DB password), and whatever isolated-kubeconfig-access secret
   the runner setup requires.
4. Local `/etc/hosts` line on the runner's own host (this WSL2 machine, since FR-014's
   reachability check runs from wherever the runner executes): `10.10.10.10 sample-app.cert.local`.

## Scenario 1 — User Story 1: push → verified private build (Independent Test)

```bash
git commit --allow-empty -m "test: trigger pipeline"
git push origin main
```

**Expected**: GitHub Actions run starts automatically. Steps execute in order: lint (backend +
frontend) → Semgrep → Docker build → Trivy scan → GHCR push. In the run's own log/summary
(SC-004), confirm:
- Lint step shows pass/fail for both `npm run lint:backend` and `npm run lint:frontend`.
- Semgrep step's output (or attached `semgrep-results.json`) lists all findings by severity; job
  fails only if any are `ERROR`.
- Trivy step's full-severity report is visible; job fails only if any finding is `CRITICAL` or
  `HIGH`.
- A new image tag matching this commit's SHA appears in the repo's GHCR packages, marked private.

**Failure-path check** (Acceptance Scenario 2): introduce a lint error, push, confirm the run
stops at the lint step — no Docker build step even starts, no image published.

## Scenario 2 — User Story 2: build → live, reachable application (Independent Test)

Starting from a target environment with nothing pre-deployed (first-ever run):

```bash
# On the runner host, after the CD job completes:
curl -k -sS -o /dev/stderr -w '\nHTTP %{http_code}\n' https://sample-app.cert.local
```

**Expected**:
- `kubectl get ns sample-app`, `kubectl get deploy,svc,pvc -n sample-app` show the Postgres
  Deployment/Service/PVC created.
- `kubectl get secret -n sample-app` shows `sample-app-ghcr-pull` and `sample-app-db-credentials`.
- `kubectl get jobs -n sample-app` shows the migration Job `Completed`.
- `kubectl get ksvc sample-app -n sample-app` shows `READY: True`.
- The `curl -k` above returns a successful HTTP status and a body that is the frontend's HTML
  (not an error page) — verified with real output, per Principle VI, not by reading logs.

**Failure-path check** (Acceptance Scenario 2 — migration failure): temporarily point
`DATABASE_URL` at an unreachable host in a throwaway branch/run, confirm the migration Job fails,
the workflow reports failure, `kn service apply` never runs, and (if an application was previously
deployed) the previous Revision keeps serving `curl -k` traffic unaffected.

## Scenario 3 — User Story 3: repeat runs never break what's running (Independent Test)

```bash
# Re-run the same workflow (no code changes), e.g. via GitHub's "Re-run all jobs",
# or an empty commit as in Scenario 1.
```

**Expected**:
- Second run succeeds cleanly; every `kubectl apply`/`kubectl create secret ... --dry-run=client`
  step is a no-op reconciliation (`unchanged` / no error), not an `AlreadyExists` failure.
- `kubectl get pvc -n sample-app` shows the same PVC (same `uid`) — not a new one.
- `kubectl get secret sample-app-db-credentials -n sample-app -o jsonpath='{.data.POSTGRES_PASSWORD}'`
  is byte-identical across both runs (FR-010/FR-015 — never regenerated).
- Application data created between the two runs (e.g. a test user registered via the app's UI
  after Scenario 2) is still present after the second run.

**Concurrency check** (Acceptance Scenario 2 / FR-016): trigger two runs in quick succession (two
pushes seconds apart); confirm in the Actions UI that the second deploy job shows "Waiting" /
queued behind the first (`concurrency: {group: deploy-sample-app}`), not running in parallel, and
that neither run is silently cancelled mid-deploy (`cancel-in-progress: false`).

## Success Criteria mapping

| Success Criterion | Validated by |
|---|---|
| SC-001 | Scenario 1 + Scenario 2, single push to observable live change |
| SC-002 | Scenario 2's `curl -k` step, required in every deploy-stage run |
| SC-003 | Scenario 3, repeated |
| SC-004 | Scenario 1's per-step visible output check |
| SC-005 | Manual log review after any scenario: grep the run's log for the literal secret values (masked by GitHub Actions automatically) — confirm no secret appears unmasked |
