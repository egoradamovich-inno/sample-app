# Contracts: CI ↔ CD ↔ Runtime Interfaces

This feature has no public API surface of its own; its "contracts" are the interfaces between the
pipeline's stages and between the deploy job's manifests and the running application. Documented
here so `/speckit-tasks` and `/speckit-implement` build exactly these names/shapes, not
improvised ones.

## Namespace (applies to every contract below)

All namespaced resources live in **`sample-app`** (research.md §5). Every `kubectl`/`kn` command
in the deploy job passes `-n sample-app` (or `--namespace sample-app`) explicitly — never relies
on a `kubectl config set-context --current --namespace=...` side effect, so the deploy job is
correct even if the runner's kubeconfig context default namespace is ever changed.

## Contract 1: CI job → GHCR → CD job (the Build Artifact)

- **Interface**: a GHCR image reference: `ghcr.io/<org>/sample-app:<git-sha>`.
- **Producer**: CI job, after Trivy's gating scan (research.md §6) passes.
- **Consumer**: CD job, which reads the same `<git-sha>` (via `github.sha` in the same workflow
  run — CI and CD are jobs in one workflow, not separate workflows, so there is no cross-workflow
  artifact hand-off to design) and uses it for both the migration Job's image and the Knative
  Service's image.
- **Guarantee**: the tag CD deploys is always the exact commit CI just built and scanned — never
  a floating tag, never a race where CD could deploy an older or newer image than what CI verified.

## Contract 2: GitHub Actions repo secrets/variables → CD job (stable credentials)

| GitHub Actions secret/variable | Consumed as | Used by |
|---|---|---|
| `GHCR_PULL_PAT` (secret) | `--docker-password` when creating `sample-app-ghcr-pull` | imagePullSecret |
| `GHCR_PULL_USERNAME` (repository **variable**, not a secret — the PAT-owning account's actual username) | `--docker-username` when creating `sample-app-ghcr-pull` | imagePullSecret. **Not** `${{ github.actor }}` — verified against GitHub's own docs (the `docker-to-azure-app-service` guide pairs a PAT with the fixed owning account as username, not a dynamic contributor identity); `github.actor` is whoever triggered that specific run, which need not be the PAT's owner |
| `SAMPLE_APP_DB_PASSWORD` (secret) | `POSTGRES_PASSWORD` literal when creating `sample-app-db-credentials` | Postgres Deployment env, `DATABASE_URL` |
| *(fixed constants, not a GitHub secret)* | `POSTGRES_USER=sampleapp` and `POSTGRES_DB=sampleapp` literals when creating `sample-app-db-credentials` | Postgres Deployment env (`secretKeyRef`) — these keys must exist in the Secret verbatim, or the Postgres pod fails with `CreateContainerConfigError` before the readinessProbe ever runs (data-model.md's Database Access Credential entity) |
| `JWT_ACCESS_SECRET` (secret) | `--from-literal=JWT_ACCESS_SECRET=...` when creating a new Secret, `sample-app-jwt-secret`, idempotently (same `--dry-run=client \| kubectl apply` pattern as the other two Secrets) | Knative Service env, via `secretKeyRef`. Discovered during implementation, not in the original plan: `apps/backend/src/shared/config/jwt.constants.ts` throws at boot if `JWT_ACCESS_SECRET` is unset, and nothing in this feature's design had previously named a source for it — resolved by following the exact same stable-secret pattern already established for the DB password (FR-010's spirit extended to this value too, since it must equally never be regenerated across redeploys or every user's session would invalidate) |
| `KUBECONFIG_B64` (or equivalent) | written to the isolated kubeconfig path referenced by the runner's `KUBECONFIG` env var (Principle V) | every `kubectl`/`kn` invocation |

GitHub Actions' built-in secret masking (registered secrets are redacted from all logs
automatically) satisfies SC-005 ("no secret in output") — no custom masking/redaction logic is
added by this feature.

## Contract 3: CD job → Kubernetes objects (idempotent ensure-exists, in apply order)

Exact order the deploy job MUST follow (each step is a precondition for the next):

1. `kubectl apply -f k8s/namespace.yaml` — ensure `sample-app` namespace exists.
2. `kubectl apply -f k8s/storageclass.yaml` — ensure `sample-app-db-storage` exists (cluster-scoped, idempotent, safe to re-apply).
3. `kubectl create secret docker-registry sample-app-ghcr-pull ... --dry-run=client -o yaml | kubectl apply -f -` — imagePullSecret (Principle IV).
4. `kubectl create secret generic sample-app-db-credentials ... --dry-run=client -o yaml | kubectl apply -f -` — DB credentials (Principle VIII). `DATABASE_URL`'s embedded password is percent-encoded (`jq`'s `@uri` filter) before interpolation; `POSTGRES_PASSWORD` stays raw. `SAMPLE_APP_DB_PASSWORD` is a human-chosen secret with no character-set restriction, and an unencoded `@`/`:`/`/`/`#`/`?`/space/`%` in a connection URI would otherwise fail to parse or silently misparse the user/password/host boundary — a failure class no status-code check in this pipeline would catch.
5. `kubectl apply -f k8s/postgres-pvc.yaml -f k8s/postgres-deployment.yaml -f k8s/postgres-service.yaml` — ensure Postgres exists; PVC before Deployment so the volume is bindable first.
6. `kubectl wait --for=condition=available deployment/sample-app-postgres -n sample-app --timeout=240s` — don't attempt migrations against a Postgres that isn't ready yet, especially on the very-first-ever run (spec.md Edge Cases). This condition is only meaningful because the Postgres Deployment carries a `pg_isready` `readinessProbe` (data-model.md's Application Database entity) — without it, `Available` would flip `True` as soon as the container process starts, before `initdb` finishes on a first-ever run, and step 7 would race a Postgres that isn't actually accepting connections yet. `240s` budgets: worst-case first-ever `postgres:16` image pull on the worker (image untested on these nodes; 642MB, measured at under 2s over this host's own connection but budgeted generously for nested-virtualization/network variance) + the readinessProbe's own ~65s worst-case patience window (`initialDelaySeconds: 5` + `failureThreshold: 12` × `periodSeconds: 5`) + slack.
7. Render and apply the migration Job, named `sample-app-migrate-${{ github.run_id }}` (**not** the commit SHA — see data-model.md's Migration Job entity for why: a SHA-named Job would collide with a still-`Failed` Job from a prior attempt at the same commit and block retries) with image = this run's SHA tag, `backoffLimit: 0`, `ttlSecondsAfterFinished: 3600`, `resources: {requests: {cpu: 250m, memory: 256Mi}, limits: {cpu: 500m, memory: 512Mi}}` (data-model.md's Migration Job entity — raised from an initial 100m/128Mi after a real deploy showed CPU throttling made the Prisma CLI's own startup take ~89s instead of ~1s unthrottled), and `imagePullSecrets: [{name: sample-app-ghcr-pull}]` (same pull secret as the Knative Service in step 8 — the Job pulls the same private image, and without this reference the pod can't pull it at all and the resulting `ErrImagePullBackOff` would look like a migration failure once `kubectl wait` times out) → `kubectl wait --for=condition=complete job/sample-app-migrate-${{ github.run_id }} --timeout=300s`. `300s` (revised from an initial `180s`) is verified against a real first deploy: actual Job duration was 3m1s (181s) — 92s image pull + ~89s CPU-throttled startup — leaving almost no margin against the old budget. **Stop the deploy here, non-zero exit, if this fails** (FR-011).
8. Render and apply the Knative Service: `IMAGE=ghcr.io/${{ github.repository_owner }}/sample-app:${{ github.sha }} envsubst < k8s/knative-service.template.yaml > /tmp/knative-service.rendered.yaml` then `kn service apply sample-app -n sample-app -f /tmp/knative-service.rendered.yaml` (matches tasks.md T020/T028 — a static, non-templated `k8s/knative-service.yaml` would freeze the image tag from whenever the file was last hand-edited instead of the commit just built). **Not** piped via `-f -` like step 7's `kubectl apply` — confirmed via a real deploy and `kn service apply --help`: unlike `kubectl`, `kn`'s `-f/--filename` takes a real file path only (no stdin support; only its separate `--containers` flag documents `-` for stdin), so `-f -` fails with `open -: no such file or directory`. Render to a real temp file first.
9. `curl -k -sS -o /tmp/body -w '%{http_code}' https://sample-app.cert.local` — real reachability check (FR-014); fail the workflow if the status is not a successful response, printing both status and body.

## Contract 4: Application runtime env contract

| Env var | Set by | Read by |
|---|---|---|
| `DATABASE_URL` | `sample-app-db-credentials` Secret, `valueFrom.secretKeyRef`, on both the migration Job and the Knative Service | `apps/backend/prisma/schema.prisma`'s `datasource db { url = env("DATABASE_URL") }` (existing, unchanged) |
| `JWT_ACCESS_SECRET` | `sample-app-jwt-secret` Secret (new — see Contract 2), `valueFrom.secretKeyRef`, on the Knative Service only (the migration Job doesn't need it) | `apps/backend/src/shared/config/jwt.constants.ts`, which throws at boot if unset (existing, unchanged). No other existing env var in this codebase is a hard boot-time requirement — verified by grepping `apps/backend/src` for the same `getRequiredEnv`/throw-on-missing pattern during implementation; nothing else matched |
| `NODE_ENV` | Hardcoded `production` in the Knative Service template | `apps/backend/src/shared/cookies/auth-cookies.util.ts` gates the httpOnly auth cookies' `Secure` flag on `NODE_ENV === 'production'` |
| `FRONTEND_URL` | Hardcoded `https://sample-app.cert.local` in the Knative Service template | `apps/backend/src/modules/sharelink/sharelink.service.ts` builds share-link URLs from this; defaults to `http://localhost:5173` if unset, which would be wrong in this deployment |
| `PORT` | Knative-injected (do not hardcode in the manifest) | `apps/backend/src/main.ts`'s `app.listen(process.env.PORT ?? 3000)` |

## Contract 5: API surface exposed by the single image (already decided by Principle III, not re-decided here)

- Backend API routes MUST be served under a global `/api` prefix (`app.setGlobalPrefix('api')`,
  added in `apps/backend/src/main.ts` during `/speckit-implement` — confirmed via a real build
  and boot test that every route is now mapped under `/api/*`).
- All other routes fall back to the built frontend's `index.html` (SPA client-side routing),
  served via `useStaticAssets` + a catch-all Express middleware in `main.ts` (not a Nest
  `@Controller` route — `setGlobalPrefix` would otherwise prefix a Nest-routed catch-all with
  `/api` too, defeating the purpose; implemented as raw middleware instead, consistent with the
  existing `/uploads` precedent already being "outside the Nest routing/guard chain" per that
  code's own comment). Verified end-to-end: `/`, a deep client-side route, a real static asset,
  `/api/*`, and `/uploads/*` all return the expected status and body against a real built image.
- This is the "single deployable package" contract FR-004 requires.
