# Implementation Plan: CI/CD Deployment Pipeline

**Branch**: `001-cicd-deployment-pipeline` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-cicd-deployment-pipeline/spec.md`

## Summary

Ship a single GitHub Actions workflow that, on every push to `main`: lints (ESLint + oxlint,
reused) → SAST (Semgrep, new) → builds one production Docker image (NestJS serving `/api` + built
Vite SPA with an SPA-fallback route) → scans it (Trivy, new) → pushes it to GHCR as **private** —
then, on a self-hosted runner with an isolated kubeconfig, deploys to the existing k3s/Knative
cluster: idempotently ensures the `sample-app` namespace, imagePullSecret, Postgres
Deployment/Service/PVC (on a dedicated `Retain`-policy StorageClass), and DB-credentials Secret
exist; runs `prisma migrate deploy` as a Kubernetes Job that must succeed before traffic can shift;
applies the Knative Service; and verifies the deploy with a real `curl -k
https://sample-app.cert.local`, not a green checkmark. A GitHub Actions `concurrency:` group on the
deploy job prevents two deploys from racing the same environment.

Five decisions the constitution and the user explicitly required to be settled here (not left
implicit), all verified against the live cluster or current docs rather than memory — full
evidence in [research.md](./research.md):

1. **Migrations run as a Kubernetes Job**, not an init-container — decisively because the live
   cluster's Knative Serving 1.23.0 install has `kubernetes.podspec-init-containers: "disabled"`
   in its `config-features` ConfigMap, and enabling it would mean editing Part-II-owned platform
   config (forbidden by Principle I). Independently, a Job also better fits Knative's revision
   model: it runs exactly once per deploy, vs. an init-container re-running on every cold start.
2. **Postgres gets explicit `requests: {cpu: 250m, memory: 256Mi}` / `limits: {cpu: 500m, memory:
   512Mi}`**, sized against measured live headroom (both schedulable workers currently commit only
   500m CPU / 260–500Mi memory out of 2 vCPU / ~2.9Gi allocatable each).
3. **A dedicated `sample-app-db-storage` StorageClass with `reclaimPolicy: Retain`** backs the
   Postgres PVC, because the cluster's default `local-path` StorageClass is confirmed
   `reclaimPolicy: Delete` — unacceptable for a "never recreated" persistent database.
4. **FR-016 concurrency uses GitHub Actions' native `concurrency: {group: deploy-sample-app,
   cancel-in-progress: false}`** at the deploy-job level (verified current syntax via Context7) —
   `cancel-in-progress: false` deliberately, so a queued run never cancels one mid-migration.
5. **Target namespace is `sample-app`** (not `default`), used consistently across every
   namespaced manifest and `kubectl`/`kn` invocation.

## Technical Context

**Language/Version**: TypeScript on Node.js 22 (existing); GitHub Actions workflow YAML + Bash
(new, this feature); Kubernetes manifest YAML (new).

**Primary Dependencies**: NestJS 11, Prisma 6.19, React 19, Vite 8 (existing, unchanged by this
feature); ESLint + oxlint (existing, reused for CI); Semgrep (new, SAST); Trivy (new, image scan);
`kubectl` + `kn` CLI (new, CD).

**Storage**: PostgreSQL 16, deployed by this feature as a plain Kubernetes Deployment + Service +
PVC in the `sample-app` namespace (new infrastructure this repo owns per Constitution Principle
VIII — not present in Parts I/II).

**Testing**: Existing `npm run test:backend` (Jest) / `npm run test:frontend` (Vitest) continue to
gate merges per repo convention (see CLAUDE.md); this feature does not add new application test
suites, only pipeline-level validation (`quickstart.md`'s runnable scenarios) and existing
lint/test commands run as CI steps.

**Target Platform**: Self-hosted GitHub Actions runner on the WSL2 host (Principle V) for both CI
and CD jobs; CD deploys to the existing k3s cluster (`k3s-control-plane` 10.10.10.11,
`k3s-worker1` 10.10.10.12, `k3s-worker2` 10.10.10.13) with Knative Serving 1.23.0 + Kourier +
nginx TLS reverse proxy (Parts I/II, immutable ground truth per Principle I).

**Project Type**: Web application (existing) + CI/CD pipeline infrastructure (this feature) — no
new application project type; this feature adds `Dockerfile` (production, multi-stage),
`.github/workflows/`, and `k8s/` manifests to the existing monorepo.

**Performance Goals**: N/A — this feature's scope is build/scan/publish/deploy automation, not
application runtime performance. Existing app performance characteristics are unchanged.

**Constraints**:
- Single Docker image, single Knative Service, single URL (`https://sample-app.cert.local`) —
  Principle III, non-negotiable.
- GHCR image MUST stay private (Principle IV).
- Runner MUST use an isolated kubeconfig, never merged into `~/.kube/config` (Principle V) — this
  planning session confirmed the current default `~/.kube/config` on this host holds unrelated EKS
  contexts, concretely illustrating why isolation matters.
- Postgres MUST run as a plain Deployment (not Knative Service) so it never scales to zero
  (Principle VIII).
- Migrations MUST run as an explicit, failure-visible step before the new revision can take
  traffic (Principle VIII; mechanism decided above).
- k3s workers are resource-constrained (2 vCPU / ~3GB allocatable each, confirmed live) and already
  carry Knative's activator/autoscaler/controller/webhook + the Kourier gateway.
- Reachability verification MUST use `curl -k` (self-signed cert, no trust chain — Principle I).

**Scale/Scope**: Single application, single environment, single fixed URL — no multi-environment
(staging/prod) or multi-tenant scope. Three Knative/Kubernetes worker nodes total capacity; one
Postgres instance; one deploy target.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design below.*

| Principle | Check | Status |
|---|---|---|
| I. Conform to the Provisioned Platform | No re-provisioning of Parts I/II. Init-container mechanism for migrations was rejected specifically because it would require editing Part-II-owned Knative config; Job mechanism needs zero platform changes. Dedicated StorageClass adds a new object rather than mutating the existing default. `curl -k` used throughout; Kourier address not hardcoded (discovered live if ever needed in scripts). | PASS |
| II. Reuse Existing Tooling | ESLint/oxlint reused as-is; only Semgrep + Trivy added, matching the constitution's explicit allowance. No new test runner, no repository-layer abstraction introduced. | PASS |
| III. Single Deployable Artifact, Single URL | One multi-stage Dockerfile, one image, one Knative Service, one URL. No second service/subdomain considered. | PASS |
| IV. Private-by-Default Image Supply Chain | GHCR push is private; imagePullSecret creation is idempotent (`kubectl create secret docker-registry --dry-run=client -o yaml \| kubectl apply -f -`) and referenced under `spec.template.spec.imagePullSecrets`. | PASS |
| V. Isolated, Purpose-Built Self-Hosted Runner | Runner setup (installing Docker/kubectl/kn, writing the isolated kubeconfig via `KUBECONFIG` env var) is a one-time, documented manual/setup step, not a workflow step — consistent with the constitution treating runner provisioning as out of this feature's automated scope, same as the Assumptions section of spec.md treats the registry PAT and DB password as pre-provisioned. | PASS |
| VI. Verify Against the Live System | FR-014/SC-002 implemented as a real `curl -k` step reading status + body, run after `kn service apply`, that fails the workflow on non-2xx or unreachable. | PASS |
| VII. Spec-Driven Workflow, Verified Sources | This plan's five required decisions were each verified against either the live cluster (SSH to `k3s-control-plane`) or current official docs (Context7: Knative, GitHub Actions, Semgrep, Trivy) — see research.md. No claim in this plan rests on unverified memory. | PASS |
| VIII. Database as an Explicit, Minimal Dependency | Postgres 16 as Deployment+Service+PVC (not Knative Service), idempotent `kubectl apply`, credentials in a Secret sourced from a stable GitHub Actions repo secret, migrations as a Job before traffic shifts, explicit resource requests/limits sized against live headroom. | PASS |

No violations — Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-cicd-deployment-pipeline/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── manifests.md     # Phase 1 output — resource/interface contracts between CI, CD, and the app
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── deploy.yml              # single workflow: lint → SAST → build → scan → push → deploy → verify

apps/backend/
└── Dockerfile                  # NEW: production multi-stage build (this feature)
                                 # (Dockerfile.dev already exists, untouched)

apps/frontend/
└── Dockerfile                  # NEW, or folded into a single repo-root multi-stage Dockerfile —
                                 # see data-model.md "Build Artifact" for the exact staging decision

k8s/
├── namespace.yaml               # sample-app namespace
├── storageclass.yaml            # sample-app-db-storage (local-path provisioner, reclaimPolicy: Retain)
├── postgres-deployment.yaml     # Postgres 16 Deployment (resource requests/limits from research.md)
├── postgres-service.yaml        # ClusterIP Service, port 5432
├── postgres-pvc.yaml            # PVC bound to sample-app-db-storage
├── migration-job.template.yaml   # Job template: prisma migrate deploy (${IMAGE}/${RUN_ID} substituted via envsubst per run)
└── knative-service.template.yaml # kn/Knative Service template (${IMAGE} substituted via envsubst per run; env, imagePullSecrets, DATABASE_URL)
```

**Structure Decision**: This is infrastructure/pipeline work layered onto the existing
`apps/backend` + `apps/frontend` npm-workspaces monorepo (Option 2 shape, already in place) — no
new application source directories. This feature's own footprint is a single production
Dockerfile (or one per app, decided in data-model.md), one GitHub Actions workflow file, and a
`k8s/` directory of plain manifests versioned in this repo per the constitution's Development
Workflow section ("Postgres/database manifests are versioned in this repo, not in
`ansible-provisioning`").

## Complexity Tracking

*Not applicable — no Constitution Check violations.*
