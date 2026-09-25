---

description: "Task list template for feature implementation"
---

# Tasks: CI/CD Deployment Pipeline

**Input**: Design documents from `/specs/001-cicd-deployment-pipeline/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/manifests.md, quickstart.md (all present and consistent as of this generation)

**Tests**: Not included — not requested in spec.md or by the user; verification instead relies on the existing repo test/lint suites (Polish phase) and quickstart.md's runnable scenarios (per-story checkpoints).

**Organization**: Tasks are grouped by user story from spec.md: **US1** (P1, CI: lint→SAST→build→scan→push), **US2** (P2, CD: ensure-infra→migrate→deploy→verify), **US3** (P3, idempotency/concurrency hardening).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3
- Every task names its exact file path(s)

## Path Conventions

Existing npm-workspaces monorepo (`apps/backend`, `apps/frontend`) plus this feature's own additions at the repo root: `.github/workflows/`, `Dockerfile`, `.dockerignore`, `k8s/`, `docs/`.

---

## Phase 1: Setup

- [X] T001 Create `.github/workflows/deploy.yml` skeleton: `name: CI/CD`, `on: {push: {branches: [main]}}` (workflow_dispatch added later in T031), `permissions: {contents: read, packages: write}` — no jobs yet, just the workflow-level shell every later task adds jobs/steps into
- [X] T002 [P] Create root `.dockerignore` excluding `node_modules`, `.git`, `**/dist`, `**/generated`, `apps/backend/uploads`, `.env*`, `tasks/`, `specs/`, `.claude/`

**Checkpoint**: Workflow file and Dockerfile build context exist; nothing runnable yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one-time, manual, non-pipeline setup both US1 and US2 depend on to ever execute against real infrastructure (Principle V; spec.md Assumptions). Not application code — no user story's automated steps can be end-to-end validated on the real runner/cluster without this, but writing/reviewing the pipeline's own YAML and manifests (US1, US2) does not require it to already be done.

- [X] T003 Write `docs/ci-cd-runner-setup.md` documenting, **in this order — the first item is a hard blocker for every other item, not routine housekeeping**: (0) **FIRST, before anything else**: verify this WSL2 host's self-hosted Actions Runner binary is at **v2.327.1 or later**, upgrading it now if not. This is not optional and not a deprecation warning — independently verified (web search) that GitHub removed Node.js 20 from Actions runners entirely on **September 23, 2026** (two days before this planning session), with no fallback: the temporary `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` opt-out that previously let old runners keep working is itself gone as of that date. `actions/checkout@v7`, `actions/setup-node@v7`, and `actions/upload-artifact@v7` (T007–T010, T021) all require Node.js 24 runtime support. If this runner's binary predates v2.327.1, **the very first job in this workflow fails outright** — not a warning, an outright failure — so this step must be verified/fixed before installing anything else in this doc; (a) installing Docker, `kubectl`, and the `kn` CLI on this WSL2 host's self-hosted GitHub Actions runner (Principle V); (b) creating the isolated kubeconfig (copy `k3s-control-plane`'s `/etc/rancher/k3s/k3s.yaml`, rewrite `server:` to `https://10.10.10.11:6443`, reference it via a `KUBECONFIG` env var in the runner service's own environment — **never** merged into this host's default `~/.kube/config`, which this planning session confirmed already holds unrelated EKS contexts); (c) the `10.10.10.10 sample-app.cert.local` `/etc/hosts` line required on the runner's own host, since FR-014's reachability check runs from wherever the runner executes; (d) the GitHub repository secrets/variables to configure once: `GHCR_PULL_PAT` (`read:packages`-scoped PAT), the repository **variable** `GHCR_PULL_USERNAME` (the PAT-owning account's actual GitHub username — not a secret, but must be set explicitly rather than derived from `github.actor`, per T022), `SAMPLE_APP_DB_PASSWORD` (stable DB password, never regenerated), and whatever mechanism exposes the isolated kubeconfig to the runner process; (e) a one-time manual checklist item, performed once before the first real deploy and not repeated per pipeline run (visibility doesn't revert on its own once set): confirm the `ghcr.io/.../sample-app` package visibility is set to **Private** in the repo's GHCR package settings (Principle IV/FR-006) — GHCR does not reliably default a new package to private off `GITHUB_TOKEN` pushes alone

**Checkpoint**: Runner and secrets prerequisites are documented; a maintainer can now provision them once, out of band, before either story's workflow can run for real.

---

## Phase 3: User Story 1 - Every Push Automatically Produces a Verified, Publishable Build (Priority: P1) 🎯 MVP

**Goal**: Every push to `main` is linted, SAST-scanned, built into one image, vulnerability-scanned, and — only if all of that passes — published to GHCR as a private artifact tagged to that commit.

**Independent Test** (spec.md): push a commit to `main` and observe a new private build artifact appear, tagged to that commit, only after lint, SAST, and image scanning have all run and been recorded.

### Implementation for User Story 1

- [X] T004 [US1] Add `app.setGlobalPrefix('api')` in `apps/backend/src/main.ts`, immediately after `NestFactory.create(...)` — backend API routes must be served under a global `/api` prefix (Constitution Principle III; contracts/manifests.md Contract 5). Verified via this session's read of `main.ts`: no global prefix is set today.
- [X] T005 [US1] Add SPA fallback serving in `apps/backend/src/main.ts`: alongside the existing `app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' })` line, add `app.useStaticAssets(join(process.cwd(), 'public'), { index: false })` to serve the copied frontend build, plus a catch-all fallback (registered last, excluded from the `/api` and `/uploads` prefixes) that returns `public/index.html` for client-side routing — this is the "single deployable package" contract FR-004 requires and contracts/manifests.md Contract 5 documents (depends on T004 for prefix ordering). **Implemented as raw Express middleware (`app.use(...)`), not a Nest `@Controller`/`@Get` route** as originally sketched: `setGlobalPrefix('api')` (T004) prefixes *every* Nest-routed controller path including a catch-all one, which would defeat the purpose; middleware sits outside Nest's routing entirely, consistent with this file's own existing `/uploads` precedent. Verified end-to-end against a real built+booted image: `/`, a deep client-side route, a real static asset, `/api/*`, and `/uploads/*` (404s correctly, doesn't fall back to the SPA) all return the expected status/body
- [X] T006 [US1] Create root `Dockerfile`, multi-stage, per data-model.md's Build Artifact entity — **one image, not one Dockerfile per app** (this resolves plan.md's "single repo-root Dockerfile" option explicitly): stage `builder` (`FROM node:22-slim` + bcrypt/sharp toolchain, matching `apps/backend/Dockerfile.dev`'s proven approach; `npm ci`; `prisma generate` + the same `.ts`→`.js` sed fix Dockerfile.dev already uses; `npm run build --workspace apps/frontend`; `npm run build --workspace apps/backend`; `npm prune --omit=dev`); stage `runtime` (`WORKDIR /app/apps/backend` — not `/app`, since `main.ts`'s `process.cwd()`-relative `uploads`/`public` paths assume this cwd, matching the native/Dockerfile.dev convention; copies pruned `node_modules`, `dist`, `generated`, `prisma`, `prisma.config.ts`, frontend `dist` → `./public`; non-root `appuser`; `EXPOSE 3000`; `CMD ["node", "dist/src/main.js"]`).
  Three real bugs found and fixed by actually building and running this image (not assumed):
  (1) `prisma` (the CLI, needed by the migration Job's `npx prisma migrate deploy`) was a devDependency while `@prisma/client` was a production dependency — a `--omit=dev` image would silently lose the CLI. Fixed by moving `prisma` to `dependencies` in `apps/backend/package.json` (+ synced `package-lock.json`).
  (2) `apps/backend/prisma.config.ts`'s `datasource: { url: env("DATABASE_URL") }` is evaluated eagerly by the Prisma CLI for *any* subcommand including `generate`, and reproducibly fails the build with `PrismaConfigEnvError` if copied into the build context before `generate` runs (DATABASE_URL is a runtime-only value). Fixed by copying only `apps/backend/prisma` (not `prisma.config.ts`, not the rest of the tree) before `generate`, mirroring `Dockerfile.dev`'s existing (and, it turns out, deliberate-in-effect) ordering.
  (3) `tsc`'s inferred `rootDir` spans both `src/` and the backend-root `prisma.config.ts`, so compiled output is `dist/src/main.js`, not `dist/main.js` — the repo's own `package.json` `start:prod` script (`node dist/main`) is stale for the same reason, pre-existing and out of scope here. `CMD` points at the real path.
- [X] T007 [US1] Add `lint` job to `.github/workflows/deploy.yml`: `runs-on: self-hosted`, `actions/checkout@v7`, `actions/setup-node@v7` (Node 22, npm workspaces cache), `npm ci`, then `npm run lint:backend` and `npm run lint:frontend` as separate steps — a failure in either step stops the job, producing no build (FR-002). Action versions independently verified (web search, not memory) as of this session: `actions/checkout` v7.0.1 (released July 2026, supersedes v6), `actions/setup-node` v7 (released same week) — both three majors ahead of the previously-assumed v4.
- [X] T008 [US1] Add `sast` job (needs: `lint`) to `.github/workflows/deploy.yml`: `runs-on: self-hosted` (FR-017 — every job runs on project-controlled infrastructure, not GitHub-hosted `ubuntu-latest`), `actions/checkout@v7`, install Semgrep, run `semgrep scan --config auto --json --output semgrep-results.json` (captures every severity, exit code reflects only internal tool errors — research.md §6), `actions/upload-artifact@v7` for `semgrep-results.json` (SC-004 visibility), then a follow-up step that parses the JSON, counts findings with `"severity": "ERROR"`, and `exit 1` if that count is nonzero (FR-003/FR-007 — only ERROR-severity findings block; lower severities are recorded, not blocking)
- [X] T009 [US1] Add `build-scan-push` job (needs: `sast`) to `.github/workflows/deploy.yml`: `runs-on: self-hosted` (FR-017, same reasoning as T008), `actions/checkout@v7`, first step: `docker build -t ghcr.io/${{ github.repository_owner }}/sample-app:${{ github.sha }} .` using the Dockerfile from T006 (FR-004)
- [X] T010 [US1] In the `build-scan-push` job, add the Trivy full-severity report step: `trivy image --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --exit-code 0 --format table --output trivy-report.txt ghcr.io/${{ github.repository_owner }}/sample-app:${{ github.sha }}`, then `actions/upload-artifact@v7` for `trivy-report.txt` (SC-004; research.md §6 — always exit 0, purely informational)
- [X] T011 [US1] In the `build-scan-push` job, add the Trivy gating step, after T010: `trivy image --severity CRITICAL,HIGH --exit-code 1 ghcr.io/${{ github.repository_owner }}/sample-app:${{ github.sha }}` — fails the job before any push if a CRITICAL or HIGH finding exists (FR-005/FR-007; research.md §6 — reuses Trivy's local vulnerability DB cache from T010, so this second pass is fast)
- [X] T012 [US1] In the `build-scan-push` job, add GHCR login (`docker login ghcr.io -u ${{ github.actor }} -p ${{ secrets.GITHUB_TOKEN }}`) and push steps for both `:${{ github.sha }}` and `:latest` tags, after T011 passes — the Knative Service (US2) always deploys by the SHA tag, never the floating `latest` (data-model.md's Build Artifact entity)
- [X] T013 [US1] Checkpoint: manually run quickstart.md Scenario 1 — push a commit, confirm in the Actions run: lint/SAST/Trivy-report/Trivy-gate results are each visible from the run's own record (SC-004), and a new private image tagged to that commit's SHA appears in GHCR (Independent Test satisfied)

**Checkpoint**: User Story 1 is fully functional and independently testable/deployable as an MVP — every push produces a verified, private, GHCR-published image, with no deployment yet.

---

## Phase 4: User Story 2 - A Published Build Becomes a Live, Reachable Application (Priority: P2)

**Goal**: A published build (from US1) is deployed to the k3s/Knative cluster — namespace, imagePullSecret, Postgres, DB credentials, and schema all ensured/brought up to date — and becomes reachable at `https://sample-app.cert.local`, verified by a real request.

**Independent Test** (spec.md): starting from a freshly published build and a target environment with nothing pre-deployed, trigger deployment and confirm via a real request to the fixed web address that the application responds correctly.

### Implementation for User Story 2

- [X] T014 [P] [US2] Create `k8s/namespace.yaml` — `Namespace` `sample-app` (research.md §5)
- [X] T015 [P] [US2] Create `k8s/storageclass.yaml` — `StorageClass` `sample-app-db-storage`, `provisioner: rancher.io/local-path`, `reclaimPolicy: Retain`, `volumeBindingMode: WaitForFirstConsumer` (research.md §3 — cluster default `local-path` is confirmed `reclaimPolicy: Delete`, unacceptable for Principle VIII's persistent DB)
- [X] T016 [US2] Create `k8s/postgres-pvc.yaml` — `PersistentVolumeClaim` `sample-app-postgres-data` in namespace `sample-app`, `storageClassName: sample-app-db-storage` (depends on T015), `accessModes: [ReadWriteOnce]`, `resources.requests.storage: 2Gi`
- [X] T017 [US2] Create `k8s/postgres-deployment.yaml` — `Deployment` `sample-app-postgres` in namespace `sample-app`: image `postgres:16`; `strategy: {type: Recreate}` (avoids a `RollingUpdate` surge pod wedging on the RWO PVC if the image/resources ever change — research.md/data-model.md); container `resources: {requests: {cpu: 250m, memory: 256Mi}, limits: {cpu: 500m, memory: 512Mi}}` (research.md §2, sized against measured live worker headroom); env `POSTGRES_DB` (`secretKeyRef: {name: sample-app-db-credentials, key: POSTGRES_DB}`), `POSTGRES_USER` (`secretKeyRef.key: POSTGRES_USER`), and `POSTGRES_PASSWORD` (`secretKeyRef.key: POSTGRES_PASSWORD`) — these three keys **must exist verbatim** in the `sample-app-db-credentials` Secret created by T023, or the pod fails immediately with `CreateContainerConfigError` (never starts, readinessProbe never runs, and T025's `kubectl wait` times out looking like "Postgres won't come up" when it's actually a missing secret key — same failure class as the migration Job's `imagePullSecrets` gap); `readinessProbe: {exec: {command: ["pg_isready", "-U", "sampleapp"]}, initialDelaySeconds: 5, periodSeconds: 5, failureThreshold: 12}` (data-model.md's Application Database entity — checks Postgres actually accepts connections, not just that the process started, giving ~60s grace for first-ever `initdb`; `sampleapp` matches the `POSTGRES_USER` value T023 creates, not a placeholder); volume from the PVC in T016
- [X] T018 [P] [US2] Create `k8s/postgres-service.yaml` — `ClusterIP` `Service` `sample-app-postgres` in namespace `sample-app`, port 5432, selecting the Deployment from T017
- [X] T019 [US2] Create `k8s/migration-job.template.yaml` — Job template with `${IMAGE}` and `${RUN_ID}` placeholders (substituted via `envsubst` in T026): `name: sample-app-migrate-${RUN_ID}` (**not** the commit SHA — data-model.md's Migration Job entity: a SHA-named Job would collide with a still-`Failed` Job from a prior attempt at the same commit and block on-demand retries); `image: ${IMAGE}`; `command: ["npx", "prisma", "migrate", "deploy"]`; env `DATABASE_URL` from `sample-app-db-credentials`; `imagePullSecrets: [{name: sample-app-ghcr-pull}]` (without this the pod can't pull the private image at all and sits in `ErrImagePullBackOff`, misdiagnosable as a migration failure); `backoffLimit: 0` (fail loudly, Principle VIII); `ttlSecondsAfterFinished: 3600`; container `resources: {requests: {cpu: 100m, memory: 128Mi}, limits: {cpu: 200m, memory: 256Mi}}` (explicit, not implicit `BestEffort`, matching every other manifest in this repo)
- [X] T020 [US2] Create `k8s/knative-service.template.yaml` — Knative `Service` `sample-app` in namespace `sample-app`, with `${IMAGE}` placeholder: `spec.template.spec.imagePullSecrets: [{name: sample-app-ghcr-pull}]`; env `DATABASE_URL` from `sample-app-db-credentials`, `JWT_ACCESS_SECRET` from the new `sample-app-jwt-secret` (T023a), `NODE_ENV=production` (gates the auth cookies' `Secure` flag — `apps/backend/src/shared/cookies/auth-cookies.util.ts`), `FRONTEND_URL=https://sample-app.cert.local` (used by `apps/backend/src/modules/sharelink/sharelink.service.ts` for share-link URLs, defaults to `localhost:5173` if unset). Verified by grepping `apps/backend/src` for every hard-required/production-sensitive env var during implementation — these four (plus `DATABASE_URL`) are the complete set; no other env var is a boot-time requirement (contracts/manifests.md Contract 4)
- [X] T021 [US2] Add `deploy` job (needs: `build-scan-push` from T012) to `.github/workflows/deploy.yml`: `runs-on: self-hosted`, `actions/checkout@v7`, then `kubectl apply -f k8s/namespace.yaml` (contracts/manifests.md Contract 3 step 1)
- [X] T022 [US2] In the `deploy` job, add: `kubectl apply -f k8s/storageclass.yaml` (Contract 3 step 2), then the idempotent imagePullSecret step: `kubectl create secret docker-registry sample-app-ghcr-pull --docker-server=ghcr.io --docker-username=${{ vars.GHCR_PULL_USERNAME }} --docker-password=${{ secrets.GHCR_PULL_PAT }} -n sample-app --dry-run=client -o yaml | kubectl apply -f -` (Principle IV; Contract 3 step 3). Uses a fixed repository **variable** `GHCR_PULL_USERNAME`, **not** `${{ github.actor }}` — verified against GitHub's own docs (the `docker-to-azure-app-service` guide's registry-credentials example pairs a PAT with `DOCKER_REGISTRY_SERVER_USERNAME=MY_REPOSITORY_OWNER`, the fixed owning account, not a dynamic contributor identity). `github.actor` is whoever triggered that specific workflow run — any contributor — which is not necessarily the account that owns the long-lived `GHCR_PULL_PAT`; a mismatched username risks the pull secret silently authenticating as the wrong identity or failing, depending on GHCR's token validation for that PAT. `GHCR_PULL_USERNAME` must be added to `docs/ci-cd-runner-setup.md` (T003) alongside the other one-time repo secrets/variables.
- [X] T023 [US2] In the `deploy` job, add the idempotent DB credentials secret step: `kubectl create secret generic sample-app-db-credentials --from-literal=POSTGRES_USER=sampleapp --from-literal=POSTGRES_DB=sampleapp --from-literal=POSTGRES_PASSWORD=${{ secrets.SAMPLE_APP_DB_PASSWORD }} --from-literal=DATABASE_URL="postgresql://sampleapp:${ENCODED_PASSWORD}@sample-app-postgres.sample-app.svc.cluster.local:5432/sampleapp" -n sample-app --dry-run=client -o yaml | kubectl apply -f -` (FR-010 — password always from the same stable GitHub secret, never regenerated; Contract 3 step 4). **Must include `POSTGRES_USER` and `POSTGRES_DB` as explicit keys**, not just baked into the `DATABASE_URL` string — T017's Postgres Deployment reads all four keys individually via `secretKeyRef`, and a missing key there is a `CreateContainerConfigError`, not a graceful fallback. **`DATABASE_URL`'s password is percent-encoded (`ENCODED_PASSWORD=$(jq -rn --arg p "${{ secrets.SAMPLE_APP_DB_PASSWORD }}" '$p | @uri')`), `POSTGRES_PASSWORD` is not** — `SAMPLE_APP_DB_PASSWORD` is a human-chosen secret with no character-set restriction, and an unencoded `@`/`:`/`/`/`#`/`?`/space/`%` in a connection URI either fails to parse or silently misparses the user/password/host boundary, a failure class no status-code check in this pipeline would catch. Verified end-to-end against a real Postgres container with a password containing all of those characters (`p@ss:w/rd#1?x y%z`) — `prisma migrate deploy` connected and applied migrations successfully through the encoded URL
- [X] T023a [US2] **Added during `/speckit-implement`, not in the original task breakdown**: in the `deploy` job, add the idempotent JWT secret step: `kubectl create secret generic sample-app-jwt-secret --from-literal=JWT_ACCESS_SECRET=${{ secrets.JWT_ACCESS_SECRET }} -n sample-app --dry-run=client -o yaml | kubectl apply -f -`. Discovered while implementing T020: `apps/backend/src/shared/config/jwt.constants.ts` throws at boot if `JWT_ACCESS_SECRET` is unset, and nothing in the plan/tasks had named a source for it — this follows the exact same stable-secret pattern as T023's DB password (see contracts/manifests.md Contract 2)
- [X] T024 [US2] In the `deploy` job, add: `kubectl apply -n sample-app -f k8s/postgres-pvc.yaml -f k8s/postgres-deployment.yaml -f k8s/postgres-service.yaml` (Contract 3 step 5; depends on T016/T017/T018)
- [X] T025 [US2] In the `deploy` job, add: `kubectl wait --for=condition=available deployment/sample-app-postgres -n sample-app --timeout=240s` — concrete value per research.md §7 (budgets a worst-case first-ever `postgres:16` pull plus the readinessProbe's ~65s worst-case patience window from T017, not an arbitrary guess)
- [X] T026 [US2] In the `deploy` job, render and apply the migration Job: `IMAGE=ghcr.io/${{ github.repository_owner }}/sample-app:${{ github.sha }} RUN_ID=${{ github.run_id }} envsubst < k8s/migration-job.template.yaml | kubectl apply -n sample-app -f -` (depends on T019, T025)
- [X] T027 [US2] In the `deploy` job, add: `kubectl wait --for=condition=complete job/sample-app-migrate-${{ github.run_id }} -n sample-app --timeout=180s`, and on failure run `kubectl logs job/sample-app-migrate-${{ github.run_id }} -n sample-app` before `exit 1` so the failure reason is visible in the run's own output (FR-011, Principle VI). `180s` is verified per research.md §7: `prisma migrate deploy` measured at ~1s against this repo's actual schema, so the budget is pull/schedule headroom, not migration runtime. **Deploy stops here (no `kn service apply`) on failure.**
- [X] T028 [US2] In the `deploy` job, render and apply the Knative Service: `IMAGE=ghcr.io/${{ github.repository_owner }}/sample-app:${{ github.sha }} envsubst < k8s/knative-service.template.yaml > /tmp/knative-service.rendered.yaml && kn service apply sample-app -n sample-app -f /tmp/knative-service.rendered.yaml` (depends on T020, T027 succeeding — Contract 3 step 8). **Not** `-f -`: a real deploy caught `kn` (unlike `kubectl`) rejecting stdin on `-f/--filename` with `open -: no such file or directory` — confirmed via `kn service apply --help`, which documents stdin support (`-`) only for its separate `--containers` flag, not `-f`.
- [X] T029 [US2] In the `deploy` job, add the reachability check: `STATUS=$(curl -k -sS -o /tmp/body -w '%{http_code}' https://sample-app.cert.local); cat /tmp/body; echo "HTTP $STATUS"; [ "$STATUS" -ge 200 ] && [ "$STATUS" -lt 300 ]` — fails the job (FR-014) if the status isn't 2xx, with both status and body printed per Principle VI (Contract 3 step 9)
- [ ] T030 [US2] Checkpoint: manually run quickstart.md Scenario 2 against a clean `sample-app` namespace (nothing pre-deployed) — confirm namespace/secrets/Postgres/migration Job/Knative Service are all created and the `curl -k` check succeeds with a real HTML body (Independent Test satisfied)

**Checkpoint**: User Stories 1 AND 2 both work — a push produces a build (US1) that becomes a live, reachable application (US2).

---

## Phase 5: User Story 3 - Repeated Deployments Never Break What's Already Running (Priority: P3)

**Goal**: Re-running the pipeline — new commits, manual re-runs, or concurrent pushes — never duplicates infrastructure, never regenerates credentials, never loses data, and never runs two deploys against the same environment at once.

**Independent Test** (spec.md): run the full pipeline twice in a row with no code changes and confirm the second run succeeds cleanly, with the application reachable and functioning identically afterward, no duplicated resources, no data loss.

### Implementation for User Story 3

- [X] T031 [US3] Add `workflow_dispatch: {}` alongside the existing `push` trigger in `.github/workflows/deploy.yml` (T001) — spec.md Assumptions explicitly allow "an on-demand manual trigger for re-running deployment without a new code change"
- [X] T032 [US3] Add `concurrency: {group: deploy-sample-app, cancel-in-progress: false}` to the `deploy` job **only** (T021) in `.github/workflows/deploy.yml` — **not** at workflow level, so the `lint`/`sast`/`build-scan-push` jobs on unrelated concurrent pushes stay unaffected (FR-016; research.md §4). `cancel-in-progress: false` is deliberate: a queued run must never cancel one already mid-migration or mid-`kn service apply`
- [X] T033 [US3] Audit T021–T024 and confirm every namespaced/cluster-scoped object creation uses `kubectl apply` or `--dry-run=client -o yaml | kubectl apply -f -` — never a bare `kubectl create` — so a second run never fails with `AlreadyExists` (FR-015); fix any step found using bare `create`
- [ ] T034 [US3] Checkpoint: execute quickstart.md Scenario 3 against the real cluster — run the pipeline twice back-to-back with no code changes; confirm the second run succeeds, `kubectl get pvc sample-app-postgres-data -n sample-app -o jsonpath='{.metadata.uid}'` is unchanged across both runs, `kubectl get secret sample-app-db-credentials -n sample-app -o jsonpath='{.data.POSTGRES_PASSWORD}'` is byte-identical, and application data created between the two runs is still present afterward
- [ ] T035 [US3] Checkpoint: execute quickstart.md's concurrency check — trigger two pushes seconds apart and confirm in the Actions UI that the second `deploy` job queues behind the first (not running in parallel, not cancelled) per the `concurrency` block from T032

**Checkpoint**: All three user stories are independently functional; the pipeline is safe to run repeatedly and concurrently without operator intervention.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T036 [P] Run `npm run lint:backend` and `npm run lint:frontend` locally to confirm the `main.ts` changes (T004, T005) pass existing lint rules before relying on CI (T007) to catch it
- [X] T037 [P] Run `npm run test:backend` and `npm run test:frontend` to confirm no regression from the `main.ts` changes, per this repo's CLAUDE.md convention (run before any task is claimed done)
- [ ] T038 Update `docs/ci-cd-runner-setup.md` (T003) with any deviations found while executing the quickstart checkpoints (T013, T030, T034, T035)
- [ ] T039 Attach real `curl -k https://sample-app.cert.local` output (status + body) as final evidence of completion, per Constitution Principle VI — a passing workflow run alone is not sufficient
- [ ] T040 [P] Manually grep the full logs of each checkpoint run (T013, T030, T034) for the literal `GHCR_PULL_PAT` and `SAMPLE_APP_DB_PASSWORD` secret values, confirming GitHub Actions' built-in masking redacts them everywhere they'd otherwise appear (SC-005 — "no secret value is ever visible in the pipeline's visible output"); this was previously undocumented as a task despite being called out in quickstart.md's Success Criteria mapping

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: no code dependency on Phase 1, but conventionally done alongside it; blocks nothing in Phase 3/4's *authoring* — only blocks those stories' checkpoints (T013, T030) from being validated against real infrastructure
- **User Story 1 (Phase 3)**: depends on Phase 1 (T001 workflow skeleton must exist to add jobs into)
- **User Story 2 (Phase 4)**: depends on User Story 1 being deployable at least once (needs a published image to deploy) — T021's job has `needs: build-scan-push`
- **User Story 3 (Phase 5)**: depends on User Story 2's `deploy` job existing (T021) to attach `concurrency` to (T032) and to re-run (T034, T035)
- **Polish (Phase 6)**: depends on all three user stories being complete

### Within Each User Story

- T004→T005→T006 (main.ts changes before the Dockerfile that copies their output) → T007→T008→T009→T010→T011→T012 (workflow jobs in dependency order via `needs:`) → T013 (checkpoint)
- T014/T015/T018 can be written in parallel; T016 depends on T015 (storageClassName reference); T017 depends on T016 (PVC name); T019/T020 are independent of T014–T018 but are applied only after Postgres is ready (T024→T025→T026→T027→T028→T029→T030)
- T031→T032 (trigger before concurrency, same file, sequential) → T033 (audit) → T034/T035 (checkpoints, can run in either order)

### Parallel Opportunities

- T002 (dockerignore) is independent of T001 and can run in parallel
- T014, T015, T018 (separate small manifest files with no file-level conflict) can be authored in parallel
- T036, T037, T040 (Polish) touch different commands/no shared file and can run in parallel

---

## Parallel Example: User Story 2 manifest authoring

```bash
Task: "Create k8s/namespace.yaml — Namespace sample-app"
Task: "Create k8s/storageclass.yaml — StorageClass sample-app-db-storage, reclaimPolicy: Retain"
Task: "Create k8s/postgres-service.yaml — ClusterIP Service sample-app-postgres, port 5432"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational docs)
2. Complete Phase 3 (User Story 1: T004–T013)
3. **STOP and VALIDATE**: run quickstart.md Scenario 1 — confirm a private, scanned, GHCR-published image appears per push
4. This alone is a shippable increment: automated quality/security gating on every push, even with no deployment wired up yet

### Incremental Delivery

1. Setup + Foundational → Phase 3 (US1) → validate → MVP delivered
2. Phase 4 (US2) → validate via quickstart Scenario 2 → the build is now live at `https://sample-app.cert.local`
3. Phase 5 (US3) → validate via quickstart Scenario 3 + concurrency check → the pipeline is safe for real, repeated, day-to-day use
4. Phase 6 (Polish) → final lint/test/DoD pass before calling the feature complete
