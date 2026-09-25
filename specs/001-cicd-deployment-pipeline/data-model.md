# Data Model: CI/CD Deployment Pipeline

This feature is infrastructure/pipeline automation, not application data. "Entities" here are the
pipeline/deployment resources named in spec.md's Key Entities section, expressed as concrete
Kubernetes/GHCR/GitHub Actions objects, plus their fields, identity, relationships, and lifecycle
(state transitions). No database schema changes — Prisma's existing `schema.prisma` is unchanged
by this feature; only its migrations are executed by a new step.

## Entity: Build Artifact

Concrete form: a container image in GHCR.

| Field | Value / Source |
|---|---|
| Registry path | `ghcr.io/<org>/sample-app` |
| Visibility | Private (Principle IV) |
| Tag | Git commit SHA (`${{ github.sha }}`) — every pipeline run produces a uniquely identifiable, traceable artifact; `latest` MAY additionally be pushed for convenience but the Knative Service always deploys by SHA tag, never floating `latest`, so redeploys are reproducible. |
| Contents | Single image: Nest backend (compiled `dist/`, `generated/prisma` client, `node_modules` production deps) + frontend's built static assets (Vite `dist/`) copied into a path the backend serves via `useStaticAssets`, following the existing `/uploads` pattern in `apps/backend/src/main.ts`. |
| Build stages | Multi-stage Dockerfile: (1) frontend builder (`npm ci && npm run build --workspace apps/frontend`), (2) backend builder (`npm ci && npm run build --workspace apps/backend`, `prisma generate`), (3) runtime (production `npm ci --omit=dev` for backend deps only, copy backend `dist/` + frontend `dist/` + `generated/prisma`, non-root user, `CMD ["node", "dist/main.js"]`). |
| Identity/uniqueness | One artifact per pipeline run; never duplicated, never mutated after push (immutable once scanned and pushed). |
| Consumed by | This project's own deploy job only (private registry + imagePullSecret gate any other consumer out). |

**Validation rules** (from FR-002/FR-003/FR-005/FR-007): never produced if lint fails; never
scanned if not built; never pushed if Trivy reports a CRITICAL/HIGH finding or Semgrep reports an
ERROR-severity finding.

## Entity: Deployed Application Instance

Concrete form: a Knative `Service` (`serving.knative.dev/v1`) named `sample-app` in the
`sample-app` namespace, and the Kubernetes-managed `Revision`/`Route`/`Configuration` objects
Knative derives from it.

| Field | Value / Source |
|---|---|
| Name | `sample-app` |
| Namespace | `sample-app` |
| Image | This run's Build Artifact, referenced by immutable SHA tag |
| Env | `DATABASE_URL` from `sample-app-db-credentials` Secret (`valueFrom.secretKeyRef`); `PORT` (Nest reads `process.env.PORT`, defaults 3000 — Knative injects `PORT` itself, so this is left to Knative's default, not hardcoded) |
| imagePullSecrets | `sample-app-ghcr-pull` (Principle IV) |
| Scaling | Standard Knative KPA autoscaling, scale-to-zero allowed (unlike Postgres) |
| Networking | Reachable at `https://sample-app.cert.local` via existing Kourier + nginx TLS reverse proxy (Part II, unchanged) |

**State transitions**: `kn service apply` either creates the Service (first-ever run) or creates a
new Revision and shifts the Route's traffic to it (subsequent runs) only after: the migration Job
(below) has completed successfully. If the new Revision fails to become Ready, Knative's own
traffic-shifting behavior keeps the previous Revision serving 100% of traffic (Assumptions section
of spec.md — no custom rollback logic added here, per FR-015's "MUST NOT disrupt the
already-running application").

## Entity: Application Database

Concrete form: a plain Kubernetes `Deployment` (name `sample-app-postgres`) + `Service` (name
`sample-app-postgres`, `ClusterIP`, port 5432) + `PersistentVolumeClaim` (name
`sample-app-postgres-data`) in the `sample-app` namespace. **Not** a Knative Service (Principle
VIII — must never scale to zero).

| Field | Value / Source |
|---|---|
| Image | `postgres:16` (matches constitution's Technology Stack Constraints) |
| Resources | `requests: {cpu: 250m, memory: 256Mi}`, `limits: {cpu: 500m, memory: 512Mi}` (research.md §2) |
| Storage | PVC bound to the dedicated `sample-app-db-storage` StorageClass (research.md §3), size sized for this exercise's data volume (e.g. `2Gi` — generous relative to a training/coaching-platform demo dataset) |
| Replicas | 1 (a single-instance Postgres; no HA/replication in scope) |
| Strategy | `strategy: {type: Recreate}` — the default `RollingUpdate` can wedge in `Pending` trying to mount the RWO PVC into a surge pod while the old pod still holds it; not triggered by today's pinned `postgres:16` image, but cheap, preventive correctness for any future image/resource change to this Deployment |
| Readiness | `readinessProbe: {exec: {command: ["pg_isready", "-U", "sampleapp"]}, initialDelaySeconds: 5, periodSeconds: 5, failureThreshold: 12}` — `sampleapp` matches the `POSTGRES_USER` value the Database Access Credential entity creates, not a placeholder (matches tasks.md T017). Checks Postgres is actually accepting connections, not just that the process started. The `Deployment`'s `Available` condition (gated on in Contract 3 step 6) depends on pod readiness, and without this probe Kubernetes marks the container Ready as soon as the process forks, before `initdb` finishes — a real race on the very-first-ever deploy (spec.md Edge Cases), where first-time `initdb` takes noticeably longer than a normal restart. `failureThreshold: 12` at a 5s period gives ~60s of grace for first-time `initdb` before the probe is considered failed. |
| Applied by | Idempotent `kubectl apply -f k8s/postgres-*.yaml` as an early step of the deploy job, before the migration Job |

**State transitions**: created once, on the first-ever deploy run. Every subsequent run's
`kubectl apply` is a no-op reconciliation against the already-existing object (FR-015: "MUST NOT
create duplicate infrastructure"). Never deleted or recreated by the pipeline.

## Entity: Database Access Credential

Concrete form: a Kubernetes `Secret` (name `sample-app-db-credentials`, type `Opaque`) in the
`sample-app` namespace, holding four literal keys: `POSTGRES_USER`, `POSTGRES_DB`,
`POSTGRES_PASSWORD`, and the assembled `DATABASE_URL`.

| Field | Value / Source |
|---|---|
| Keys | `POSTGRES_USER: sampleapp`, `POSTGRES_DB: sampleapp`, `POSTGRES_PASSWORD: ${{ secrets.SAMPLE_APP_DB_PASSWORD }}` (raw), `DATABASE_URL: postgresql://sampleapp:<percent-encoded password>@sample-app-postgres.sample-app.svc.cluster.local:5432/sampleapp` — all four are explicit `--from-literal` keys, not just `POSTGRES_PASSWORD`/`DATABASE_URL` with the user/db name only embedded in the URL string: the Postgres Deployment (data-model.md's Application Database entity) reads `POSTGRES_USER` and `POSTGRES_DB` individually via `secretKeyRef`, and a `secretKeyRef` pointing at a key that doesn't exist in the Secret puts the pod in `CreateContainerConfigError` — it never starts, so the readinessProbe never runs and the deploy job's `kubectl wait --for=condition=available` (Contract 3 step 6) times out looking like "Postgres won't come up," when the actual cause is a missing Secret key. `DATABASE_URL`'s copy of the password is percent-encoded (`jq -rn --arg p "$PASSWORD" '$p \| @uri'`) — `POSTGRES_PASSWORD` itself stays raw, since Postgres's own auth expects the literal value. `SAMPLE_APP_DB_PASSWORD` is a human-chosen secret with no character-set restriction, and an unencoded `@`/`:`/`/`/`#`/`?`/space/`%` in a connection URI either fails to parse or silently misparses the user/password/host boundary — verified end-to-end against a real Postgres instance with a password containing every one of those characters |
| Password source | `${{ secrets.SAMPLE_APP_DB_PASSWORD }}` — a GitHub Actions repository secret, set once by a maintainer (spec.md Assumptions) |
| Creation command | `kubectl create secret generic sample-app-db-credentials --from-literal=POSTGRES_USER=sampleapp --from-literal=POSTGRES_DB=sampleapp --from-literal=POSTGRES_PASSWORD=... --from-literal=DATABASE_URL=... --dry-run=client -o yaml \| kubectl apply -f -` — idempotent, and since the literal values come from the same stable GitHub secret (password) and fixed constants (user/db name) every run, re-applying never changes the stored values (FR-010: "MUST NOT generate a new value on each run") |
| Consumed by | Postgres Deployment (as `POSTGRES_USER`/`POSTGRES_DB`/`POSTGRES_PASSWORD` env, each via its own `secretKeyRef`), the migration Job and the Knative Service (both as `DATABASE_URL` via `secretKeyRef`) |

**Validation rule**: this Secret MUST exist and be correctly populated before both the migration
Job and the Knative Service are applied — deploy-job step ordering enforces this (see
contracts/manifests.md).

## Entity: Registry Access Credential

Concrete form: a Kubernetes `Secret` (name `sample-app-ghcr-pull`, type
`kubernetes.io/dockerconfigjson`) in the `sample-app` namespace.

| Field | Value / Source |
|---|---|
| Creation command | `kubectl create secret docker-registry sample-app-ghcr-pull --docker-server=ghcr.io --docker-username=${{ vars.GHCR_PULL_USERNAME }} --docker-password=${{ secrets.GHCR_PULL_PAT }} --dry-run=client -o yaml \| kubectl apply -f -` (Principle IV). Username is the fixed repository **variable** `GHCR_PULL_USERNAME` (the PAT-owning account), **not** `${{ github.actor }}` — verified against GitHub's own docs (the `docker-to-azure-app-service` guide pairs a PAT with its fixed owning account as username, not a dynamic contributor identity); matches contracts/manifests.md Contract 2 and tasks.md T022. |
| Scope of the PAT | `read:packages` only (Principle IV — least privilege) |
| Consumed by | Knative Service and the migration Job, both via `spec.template.spec.imagePullSecrets: [{name: sample-app-ghcr-pull}]` — the Job pulls the same private SHA-tagged image as the Knative Service it precedes, so it needs the identical pull secret reference |

## New Entity (not in spec.md's Key Entities, introduced by this plan's design decisions):
Migration Job

Concrete form: a Kubernetes `Job` (name `sample-app-migrate-<github.run_id>`, unique per workflow
*execution* — not per commit — so an on-demand manual re-run of the same commit, including a retry
of a run whose migration previously failed, always gets a fresh Job object; see below and
contracts/manifests.md Contract 3 step 7) in the `sample-app` namespace, running `prisma migrate
deploy` against `DATABASE_URL`.

| Field | Value / Source |
|---|---|
| Name | `sample-app-migrate-${{ github.run_id }}` — **not** the commit SHA. `github.run_id` is unique per workflow run (including a manual re-run of an unchanged commit, per spec.md Assumptions' "on-demand manual trigger for re-running deployment without a new code change"). Naming by SHA instead would mean a prior failed Job (`backoffLimit: 0` exhausted, object still present as `Failed`) blocks every subsequent retry against that same commit — `kubectl apply`/`create` would hit `AlreadyExists`, and `kubectl wait --for=condition=complete` on the old, already-`Failed` object would never succeed, forcing a manual `kubectl delete job` before any retry could work. `github.run_id` sidesteps this entirely: every execution, retried or not, is a new Job. |
| Image | Same Build Artifact SHA tag as the Knative Service it precedes (ensures the schema and the code that expects it are always the same commit) |
| `imagePullSecrets` | `[{name: sample-app-ghcr-pull}]` — same private-registry pull secret as the Knative Service (see Registry Access Credential entity). Without this, the pod can't pull the private GHCR image at all (Principle IV) and sits in `ErrImagePullBackOff`; `kubectl wait --for=condition=complete` then times out, and the failure surfaces as a migration-step timeout even though it's actually a missing pull-secret reference — easy to misdiagnose, so this field is called out explicitly rather than left implicit in a shared pod-spec template. |
| Command | `npx prisma migrate deploy` (existing `apps/backend` Prisma setup, unchanged) |
| `backoffLimit` | `0` — a migration failure must surface immediately as a Job failure, not be silently retried and masked (Principle VIII: "fail the deploy loudly ... rather than silently") |
| `ttlSecondsAfterFinished` | `3600` — completed/failed Job objects are garbage-collected by Kubernetes an hour after finishing, instead of accumulating indefinitely in the `sample-app` namespace across every pipeline run (each run mints a uniquely-named Job per the naming decision above, so without a TTL these would never be cleaned up) |
| Resources | `requests: {cpu: 250m, memory: 256Mi}`, `limits: {cpu: 500m, memory: 512Mi}` — explicit, not left implicit `BestEffort`, for consistency with every other manifest in this repo (Principle VIII's spirit). Originally sized smaller (100m/128Mi) on the assumption that `prisma migrate deploy` itself is ~1s of work (true unthrottled, measured locally); a real first deploy against the live cluster showed the Prisma CLI's own startup (jiti-transpiling `prisma.config.ts`, resolving/linking the query engine binary) is real CPU-bound work that got heavily throttled at 100m/200m, taking ~89s in-container. Raised to bring that closer to the unthrottled figure, not just to paper over it with a bigger timeout. |
| Gate | Deploy job runs `kubectl wait --for=condition=complete --timeout=300s job/sample-app-migrate-${{ github.run_id }}` and stops the deploy (does not run `kn service apply`) on a non-zero result. `300s` is revised from an initial `180s` after a real first deploy measured the actual Job duration at 3m1s (181s) — 92s image pull (337MB, first pull of that tag on that node, confirmed via `kubectl describe pod`'s own `Pulled ... in 1m31.861s` event) plus ~89s of CPU-throttled Prisma CLI startup (see Resources above) — leaving only ~1s of margin against the original budget. `300s` restores real margin above the observed figure. |

## New Entity: Storage Class

Concrete form: `StorageClass` `sample-app-db-storage` (cluster-scoped, not namespaced),
`provisioner: rancher.io/local-path`, `reclaimPolicy: Retain`, `volumeBindingMode:
WaitForFirstConsumer` (research.md §3). Referenced by the Postgres PVC's `storageClassName`.

## New Entity (discovered during `/speckit-implement`'s first real deploy, not anticipated at
plan time): Cluster Domain Claim

Without this, the Knative Ingress never registers `sample-app.cert.local` as a route at all —
its own default-generated hosts are only internal `sample-app.sample-app[.svc[.cluster.local]]`
forms, confirmed via a real 404 straight from Kourier for the external host, independently of
the app (healthy) and nginx (healthy, forwards the Host header correctly) — see
contracts/manifests.md Contract 3 step 8.5 and research.md's addendum on this discovery.

Concrete form: `ClusterDomainClaim` (`networking.internal.knative.dev/v1alpha1`, cluster-scoped,
not namespaced — confirmed via `kubectl api-resources`/`kubectl explain` against the live
cluster, not assumed from docs, since different Knative doc snapshots showed inconsistent API
versions) named `sample-app.cert.local`, delegating that exact hostname to the `sample-app`
namespace so its `DomainMapping` (below) is permitted to claim it.

| Field | Value / Source |
|---|---|
| `spec.namespace` | `sample-app` — the one namespace this repo uses consistently for every other resource (research.md §5) |
| Creation command | `kubectl apply -f k8s/domain-claim.yaml` — idempotent (a `ClusterDomainClaim` re-applied with the same spec is a no-op), matching every other "ensure exists" step in this pipeline |
| Why explicit, not auto-created | `config-network`'s `autocreate-cluster-domain-claims` has no override on this live cluster (confirmed via `kubectl get cm config-network -n knative-serving` — the entire functional `data` block is just `ingress-class: kourier.ingress.networking.knative.dev`; every other setting, including this one, exists only in the illustrative `_example` block). Knative's built-in default for this flag is `"false"`, meaning the cluster administrator (this pipeline) is responsible for creating `ClusterDomainClaim`s explicitly. |
| Consumed by | The `DomainMapping` below — Knative's admission/reconciliation logic checks that a claim exists and names this namespace before allowing the `DomainMapping` to take effect |

**State transitions**: created once, on the first-ever deploy that reaches this step. Every
subsequent run's `kubectl apply` is a no-op reconciliation (FR-015). Never deleted or recreated
by the pipeline.

## New Entity (same discovery as above): Domain Mapping

Concrete form: `DomainMapping` (`serving.knative.dev/v1beta1` — confirmed via `kubectl explain
domainmapping` against the live cluster) named `sample-app.cert.local` in the `sample-app`
namespace, referencing the `sample-app` Knative Service.

| Field | Value / Source |
|---|---|
| `spec.ref` | `{name: sample-app, kind: Service, apiVersion: serving.knative.dev/v1}` — the Knative Service this hostname routes to (data-model.md's Deployed Application Instance entity) |
| `spec.tls` | Deliberately omitted. `config-network`'s `external-domain-tls` has no override on this live cluster either (same `_example`-only situation as `autocreate-cluster-domain-claims` above), so Knative's built-in default (`"Disabled"`) applies — no automatic certificate provisioning is attempted. This matches the cluster's actual TLS architecture: nginx already terminates TLS with its own self-signed certificate before proxying to Kourier (Constitution Principle I), and there is no cert-manager installed on this cluster to fulfill an automatic-TLS request even if one were attempted. Omitting `spec.tls` maps the `DomainMapping` to plain HTTP, which is exactly what nginx's `proxy_pass http://kourier_gateway` (plain HTTP, not HTTPS) already expects. |
| Creation command | `kubectl apply -f k8s/domain-mapping.yaml` — idempotent, same pattern as every other resource in this pipeline. Applied together with the `ClusterDomainClaim` in one step: `kubectl apply -f k8s/domain-claim.yaml -f k8s/domain-mapping.yaml -n sample-app` |
| Gate | Deploy job runs `kubectl wait --for=condition=Ready domainmapping/sample-app.cert.local -n sample-app --timeout=60s` before the reachability check — the same "don't trust `apply` succeeding, verify status" discipline already applied to the migration Job and the Postgres Deployment (Constitution Principle VI) |
| Ordering | Must be applied **after** the Knative Service (its `spec.ref` needs the Service to already exist) and **before** the reachability curl (the mapping needs to actually be routing, not just accepted by the API server) — contracts/manifests.md Contract 3 step 8.5, between steps 8 and 9 |

**State transitions**: created once, on the first-ever deploy that reaches this step. Every
subsequent run's `kubectl apply` is a no-op reconciliation (FR-015) — the mapping's `spec.ref`
never changes (it always points at the same Knative Service by name), so redeploys never
recreate or disrupt it. Never deleted by the pipeline.
