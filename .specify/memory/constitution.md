<!--
Sync Impact Report
- Version change: (none, template placeholder) → 1.0.0 (initial ratification)
- Modified principles: n/a (first concrete draft; all 8 principles are new)
- Added sections: Core Principles (I–VIII), Technology Stack Constraints, Development Workflow,
  Governance
- Removed sections: none
- Templates requiring follow-up: none checked against yet — first ratification, no dependent
  spec/plan/tasks artifacts exist yet for this feature
- Deferred placeholders: none — all bracket tokens replaced
- Draft note: Principle VIII (Database as an Explicit, Minimal Dependency) added during
  pre-ratification review — Part II's infrastructure does not provision a datastore, and this
  repo owns that gap. Idempotent-secret-creation and stable-DB-password wording added to
  Principle VIII during a second pre-ratification review pass (non-idempotent `kubectl create
  secret` would fail on redeploy #2; a re-randomized DB password would desync from the
  already-initialized PVC's Postgres).
-->
# Sample App (DevOps Cert Part III) Constitution

## Core Principles

### I. Conform to the Provisioned Platform (NON-NEGOTIABLE)
Parts I (Terraform: 4-VM libvirt/KVM fleet) and II (Ansible: k3s + Knative Serving/Kourier +
nginx TLS reverse proxy) are already built, verified against the live 4-VM fleet, and treated as
immutable ground truth for this repo. This repo MUST NOT re-provision, redesign, or second-guess
platform-level decisions already made there. Specifically and without exception:
- The domain is `cert.local`, resolved only via local `/etc/hosts`; the URL scheme is
  subdomain-per-app (`https://<app-name>.cert.local`) — the path-based alternative was
  explicitly rejected in Part II and MUST NOT be reopened.
- TLS verification is deliberately bypassed everywhere (self-signed cert, no trust chain
  installed anywhere): use `curl -k` / `--insecure-skip-tls-verify` (or equivalent) for every
  reachability check in this repo's CI/CD and docs. Do not add trust-chain setup.
- Kourier's gateway address/port MUST be discovered live (`kubectl get svc kourier -n
  kourier-system`) wherever it is needed directly — never hardcoded.
- Any component that talks to Kourier's Envoy gateway directly (bypassing nginx) MUST use
  HTTP/1.1 (Envoy rejects plain HTTP/1.0 with a 426).

Rationale: Parts I and II were independently verified against the live cluster, including two
real defects found and fixed during that verification. Re-deciding any of this in Part III risks
reintroducing bugs that verification already closed out, and wastes the certification's fixed
time budget.

### II. Reuse Existing Tooling, Introduce Only What Is Missing
Lint and test tooling already exist in this repo and MUST be reused as-is, not replaced:
ESLint for the backend (`apps/backend/eslint.config.mjs`), oxlint for the frontend
(`apps/frontend/.oxlintrc.json`), Jest for backend unit/e2e tests, Vitest for frontend tests.
The only new tools this repo introduces are ones the app genuinely lacks: Semgrep for SAST and
Trivy for container image scanning. Don't add a second linter, a second test runner, or a
repository abstraction layer that doesn't already exist in the codebase.

Rationale: matches this repo's own engineering conventions (see CLAUDE.md/AGENTS.md) against
inventing parallel tooling, and keeps the CI pipeline's footprint proportional to this
certification's fixed 8-hour time budget.

### III. Single Deployable Artifact, Single URL
The backend (NestJS) and frontend (React/Vite) are packaged into one production Docker image:
NestJS serves the built frontend static assets (extending the existing `useStaticAssets` pattern
already used for `/uploads` in `apps/backend/src/main.ts`) and the API from one process on one
port, with API routes under a global `/api` prefix and an SPA fallback route for client-side
routing. This is deployed as exactly one Knative Service, reachable at exactly one URL. A
two-service split (separate frontend/backend Knative Services on separate subdomains) is
explicitly rejected: it would require moving the existing httpOnly-cookie JWT auth to
cross-subdomain cookies (`SameSite=None; Secure; Domain=.cert.local`) and permissive
cross-origin credentials handling, which is unjustified complexity and a wider auth attack
surface for a single-app deployment exercise.

Rationale: keeps auth same-origin (no cookie/CORS redesign needed beyond what already exists),
and matches the one-app/one-URL shape Part II's infrastructure was built for.

### IV. Private-by-Default Image Supply Chain
The built image is pushed to GHCR as PRIVATE, never public. The deploy step MUST ensure a
`kubernetes.io/dockerconfigjson` imagePullSecret exists in the target namespace (created via
`kubectl create secret docker-registry`, using a GitHub PAT scoped to `read:packages` only), and
the Knative Service manifest MUST reference it under `spec.template.spec.imagePullSecrets`.
Making the package public instead is not an acceptable shortcut.

Rationale: private-by-default is the safer posture and was decided explicitly rather than
defaulted into; the imagePullSecret mechanics are well-understood and not worth trading away for
convenience.

### V. Isolated, Purpose-Built Self-Hosted Runner
The GitHub Actions self-hosted runner for this repo runs on the WSL2 host itself (this machine),
not a new VM, and requires Docker, `kubectl`, and the `kn` CLI installed there. Its kubeconfig is
copied from `k3s-control-plane` (`/etc/rancher/k3s/k3s.yaml` on `10.10.10.11`) with the `server:`
field rewritten from `https://127.0.0.1:6443` to `https://10.10.10.11:6443`, and MUST be kept
completely separate from any other kubectl context already on this host (e.g. an unrelated EKS
context) — via its own path referenced by `KUBECONFIG` in the runner process's environment, never
merged into the default `~/.kube/config`.

Rationale: a prior session on this same host already hit exactly this kubeconfig collision;
documenting it as a constitutional constraint prevents the runner from silently running
`kubectl`/`kn` against the wrong cluster.

### VI. Verify Against the Live System, Not Green Checkmarks
A passing GitHub Actions run is not sufficient evidence of success. After every deploy, verify
the actual application is reachable at `https://sample-app.cert.local` with real `curl -k`
output (status code and body), not just a successful `kn service apply` or workflow checkmark.
When something doesn't match what's claimed, get the actual raw output (logs, `kubectl describe`,
`curl -kv`), not a summary.

Rationale: this exact discipline is what caught two real defects during Part II's verification
that a "looks done" pass would have missed.

### VII. Spec-Driven Workflow with Consistent Vocabulary
Follow the same Spec Kit sequence used in Parts I and II: `/speckit-constitution` →
`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-analyze` → `/speckit-implement`. Keep identical terminology for the same concept across
`spec.md`, `plan.md`, `data-model.md` (if used), and `tasks.md`. `/speckit-analyze` is a required
gate, not optional, before `/speckit-implement`. During `/speckit-plan`, verify version and
behavior claims (Docker/Knative/GHCR/Actions runner behavior) against live/current official
sources rather than from memory.

Rationale: a vocabulary mismatch between spec artifacts caused a real blocking bug in Part I that
`/speckit-analyze` caught — skipping that gate here would reintroduce the same risk class.

### VIII. Database as an Explicit, Minimal Dependency
The application requires PostgreSQL 16 to function (Prisma-backed persistence) — this is a
genuine dependency Part II's infrastructure does not provide (Part II covers k3s + Knative +
nginx only, not application-level datastores). This repo MUST provision it explicitly, as a
plain Kubernetes Deployment + Service + PersistentVolumeClaim in the k3s cluster (not a Knative
Service — a database MUST NOT be subject to scale-to-zero), applied idempotently via
`kubectl apply` as a step in the deploy job, before `kn service apply` runs. Credentials MUST be
stored as a Kubernetes Secret (e.g. `sample-app-db-credentials`, created via
`kubectl create secret generic`) and referenced as `DATABASE_URL` via `envFrom` /
`valueFrom.secretKeyRef` in the Knative Service manifest — never hardcoded or committed to the
repo. Schema migrations (`prisma migrate deploy`) MUST run as an explicit step before traffic
could reach the new revision — either a Kubernetes Job run once per deploy or an init-container
on the Knative Service's pod spec (decide which during `/speckit-plan`, based on what fits
Knative's revision model most simply) — and MUST fail the deploy loudly (non-zero exit, workflow
step failure) rather than silently, if migrations fail. Both this Secret and Principle IV's
imagePullSecret MUST be created idempotently (e.g. `kubectl create secret ... --dry-run=client
-o yaml | kubectl apply -f -`), and the database password specifically MUST come from a stable
source (a GitHub Actions repository secret), never freshly randomly generated on each pipeline
run.

Rationale: Without this, the app cannot start regardless of how correct the build/scan/push/
deploy pipeline is — Principle VI's "real curl output" check would be the first thing to surface
this gap, only after the rest of the pipeline already reports green. Making it explicit now
avoids discovering it mid-`/speckit-plan` and having to redo Technology Stack Constraints after
the fact. Non-idempotent secret creation would fail with `AlreadyExists` on the second pipeline
run, and a freshly randomized DB password would drift out of sync with what the
already-initialized PVC's Postgres actually expects, breaking connectivity after the first
redeploy — a failure Principle VI's live curl check would only catch after the fact, not
prevent.

## Technology Stack Constraints

- **Runtime**: Node.js 22, npm workspaces monorepo (`apps/backend`, `apps/frontend`).
- **Backend**: NestJS 11, Prisma 6.19, PostgreSQL 16, ESLint, Jest.
- **Frontend**: React 19, Vite 8, Tailwind v4, oxlint, Vitest.
- **Production Dockerfile**: none exists today (only `Dockerfile.dev` for each app, dev-mode
  only, bind-mount based); this feature must author a production multi-stage Dockerfile per
  Principle III's single-image topology.
- **CI tools**: ESLint + oxlint (lint, reused), Semgrep (SAST, new), Trivy (image scan, new),
  GHCR (registry), `kn` CLI + `kubectl` (deploy).
- **Database**: PostgreSQL 16, deployed as a plain Kubernetes Deployment + Service +
  PersistentVolumeClaim in the k3s cluster (namespace to be decided during `/speckit-plan`) —
  NOT a Knative Service. Applied idempotently via `kubectl apply` as part of the deploy job.
  Credentials live in a Kubernetes Secret, referenced by the app via `DATABASE_URL`. Migrations
  (`prisma migrate deploy`) run as an explicit, failure-visible step before the new Knative
  revision can receive traffic (Kubernetes Job or init-container — decided during
  `/speckit-plan`). The DB password comes from a stable GitHub Actions repository secret, never
  freshly randomly generated per run (see Principle VIII).
- **App/service name**: `sample-app` (confirmed against the running app; kept for consistency
  with the GitHub repo name, the GitLab-sourced project directory, and all cross-referenced
  Part I/II infra docs, even though the app's own internal `package.json` name is
  `accelerator-mini`).
- **Target URL**: `https://sample-app.cert.local`. Required local `/etc/hosts` line:
  `10.10.10.10 sample-app.cert.local` (the specific subdomain — no wildcard support in
  `/etc/hosts`).
- **GHCR visibility**: PRIVATE (see Principle IV).
- **Self-hosted runner host**: this WSL2 host, with its own isolated kubeconfig (see
  Principle V).
- **Provisioned topology** (from Parts I/II, for reference — not owned by this repo):
  `nginx-vm` 10.10.10.10, `k3s-control-plane` 10.10.10.11, `k3s-worker1` 10.10.10.12,
  `k3s-worker2` 10.10.10.13, network `10.10.10.0/24`; SSH as `ubuntu` with key
  `~/.ssh/kvm-provisioning-terraform`.

## Development Workflow

- Spec Kit command sequence per Principle VII: constitution → specify → clarify → plan → tasks →
  analyze → implement. `/speckit-analyze` is a required gate, not optional, before
  `/speckit-implement`.
- Run this repo's own test/lint commands (`npm run test:backend`, `npm run test:frontend`,
  `npm run lint:backend`, `npm run lint:frontend`) before any task is claimed done, per this
  repo's existing CLAUDE.md guidance — this constitution does not relax that.
- After `/speckit-implement`, manually verify the live system per Principle VI: a real
  `curl -k https://sample-app.cert.local` (or equivalent), not just workflow success, is required
  before the feature is considered complete.
- Research (library versions, GitHub Actions/Knative/GHCR behavior) performed during
  `/speckit-plan` MUST be checked against current official sources, not answered from training
  data/memory alone.
- The Postgres/database manifests (Deployment, Service, PVC, migration Job/init-container
  config) are versioned in this repo, not in `ansible-provisioning` — Part II's scope is not
  being reopened; this is new infrastructure this repo owns per Principle VIII.

## Governance

This constitution governs the Part III (GitHub Actions + deployment) Spec Kit feature work in
this repository; it supplements, and does not override, the repository's existing `AGENTS.md`
and `CLAUDE.md` agent-policy rules (file naming, `tasks/`/`specs/` conventions, `.env`/secrets
handling), which remain in force. It supersedes ad hoc practice for anything it explicitly
addresses above.

Amendments require: a documented rationale for the change, an explicit version bump following
semantic versioning (MAJOR for backward-incompatible principle removals/redefinitions, MINOR for
new principles or materially expanded guidance, PATCH for wording/clarification only), and an
update to `Last Amended` below. Any PR or `/speckit-analyze` pass touching this feature MUST
verify compliance with the Core Principles above; unresolved conflicts block `/speckit-implement`.

**Version**: 1.0.0 | **Ratified**: 2026-09-25 | **Last Amended**: 2026-09-25
