# Feature Specification: CI/CD Deployment Pipeline

**Feature Branch**: `001-cicd-deployment-pipeline`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "this feature (the CI/CD + deployment pipeline). The spec should
cover, as already-settled constraints (do NOT reopen these during /speckit-clarify — that's for
genuinely open questions only, not re-litigating what the constitution already fixed): CI: lint
(ESLint + oxlint, reused) → SAST (Semgrep, new) → build production Docker image (single image,
NestJS serving API under /api + built Vite SPA with fallback route) → Trivy scan → push to GHCR
as PRIVATE. CD (self-hosted runner on this WSL2 host, isolated kubeconfig pointing at
10.10.10.11:6443): ensure imagePullSecret exists (idempotent) → ensure Postgres
Deployment/Service/PVC exists in the target namespace (idempotent kubectl apply) → ensure DB
credentials Secret exists (idempotent, password from a GitHub Actions repo secret, never
randomized) → run prisma migrate deploy as an explicit, failure-visible step (Job or
init-container — decide the exact mechanism during /speckit-plan) → kn service apply the Knative
Service, referencing both secrets and DATABASE_URL → verify reachability with a real curl -k
https://sample-app.cert.local (status + body), not just a green workflow. Target URL is fixed:
https://sample-app.cert.local, requiring the /etc/hosts line 10.10.10.10 sample-app.cert.local
locally (documented, not automated — that's a developer-machine step, not a pipeline step)."

## Clarifications

### Session 2026-09-25

- Q: Should the pipeline hard-fail on any source-code security or image vulnerability finding at
  all, or apply a severity threshold where only higher-severity findings block the run while
  lower-severity ones are recorded but don't stop it? → A: Severity-threshold gating. The image
  vulnerability scan fails the pipeline only on CRITICAL or HIGH severity findings; the
  source-code security scan fails the pipeline only on ERROR-level findings. Lower-severity
  findings from either scan are recorded in the run's output but do not block. Rationale: a hard
  fail on any finding at all is impractical (base images almost always carry some low-severity,
  not-yet-patched CVEs), while a severity threshold is standard practice for a real, non-decorative
  security gate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every Push Automatically Produces a Verified, Publishable Build (Priority: P1)

A developer pushes a code change to the main branch. Without any manual step, the change is
linted, scanned for security issues in the source code, built into a single deployable package,
scanned for known vulnerabilities, and — if all of that succeeds — published to a private
registry that only this project's pipeline and deployment can pull from.

**Why this priority**: This is the foundation everything else depends on. Without a trustworthy,
automatically-produced build, there is nothing safe to deploy. It also delivers value on its own
(automated quality/security gating) even before deployment is wired up.

**Independent Test**: Push a commit to main and observe, without touching anything else, that a
new private build artifact appears, tagged to that commit, only after lint, source-code security
scanning, and image vulnerability scanning have all run and been recorded.

**Acceptance Scenarios**:

1. **Given** a code change with no lint errors, **When** it is pushed to main, **Then** the
   pipeline runs lint, source-code security scanning, the build, and image vulnerability
   scanning, and publishes a new private build artifact tagged to that commit.
2. **Given** a code change that fails lint, **When** it is pushed to main, **Then** the pipeline
   stops at the lint step, no build is produced, and the failure is clearly visible.
3. **Given** a successful build, **When** it is published, **Then** it is only pullable by
   credentials the project controls — it is never publicly accessible.

---

### User Story 2 - A Published Build Becomes a Live, Reachable Application (Priority: P2)

Once User Story 1 has produced a trustworthy build, that build is automatically delivered to the
project's existing serving environment and becomes reachable at the project's fixed web address,
including everything the application needs to actually run (its database, its credentials, its
schema being up to date) — without anyone manually running deployment commands.

**Why this priority**: A build that is never deployed delivers no end-user value. This is the
step that turns "we built it" into "it's running and usable," which is the actual deliverable of
this certification phase.

**Independent Test**: Starting from a freshly published build (from User Story 1) and a target
environment that has nothing pre-deployed, trigger deployment and confirm — via a real request to
the fixed web address, not by reading logs — that the application responds correctly.

**Acceptance Scenarios**:

1. **Given** a newly published build and no application currently deployed, **When** deployment
   runs, **Then** the application's database and its credentials are provisioned automatically if
   they don't already exist, the database schema is brought up to date, and the application
   becomes reachable at the fixed web address.
2. **Given** the database schema update fails during deployment, **When** that happens, **Then**
   the previously working version of the application keeps serving traffic and the failure is
   reported clearly — the broken version never receives live traffic.
3. **Given** deployment reports success internally, **When** the pipeline checks the fixed web
   address directly, **Then** it must receive an actual successful response before the overall
   run is allowed to be marked successful.

---

### User Story 3 - Repeated Deployments Never Break What's Already Running (Priority: P3)

The team re-runs the pipeline many times over the life of the project (new commits, re-runs to
fix a mistake, redeploying without code changes). Each of these runs must leave the application in
a working state at least as good as before — never duplicating infrastructure, never locking
people out of the database, and never losing existing data.

**Why this priority**: A pipeline that only works the first time is not usable for real,
ongoing development. This is what makes the previous two stories sustainable rather than a
one-off demo.

**Independent Test**: Run the full pipeline twice in a row with no code changes in between and
confirm the second run succeeds cleanly and the application is reachable and functioning
identically afterward, with no duplicated resources and no data loss.

**Acceptance Scenarios**:

1. **Given** the application is already deployed and its database already exists, **When** the
   pipeline runs again unchanged, **Then** it does not fail, does not create duplicate
   infrastructure, and does not change the database credentials the running application already
   relies on.
2. **Given** two pipeline runs are triggered close together, **When** they would both try to
   change the same deployed environment, **Then** they are not allowed to run against it at the
   same time.

---

### Edge Cases

- What happens on the very first-ever run, when none of the target environment's pieces (database,
  credentials, deployed application) exist yet? The pipeline must succeed end-to-end without any
  manual pre-provisioning step beyond the one-time documented secrets setup (see Assumptions).
- What happens if the vulnerability/security scanning steps find an issue? Resolved: the pipeline
  applies a severity threshold — it stops (no publish, no deploy) only on higher-severity
  findings; lower-severity findings are recorded but do not block (see Clarifications).
- What happens if the schema update step fails partway through? The deployment must stop before
  the new version can receive any live traffic, and the previous working version must keep
  serving.
- What happens if the live reachability check fails right after an apparently successful deploy?
  The overall run must be reported as failed, not successful.
- What happens if two deployment runs are triggered close together? They must not run
  concurrently against the same target environment.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The pipeline MUST automatically run on every push to the main branch, with no
  manual step required to start it.
- **FR-002**: The pipeline MUST run backend lint and frontend lint and MUST stop, without
  producing a build, if either reports errors.
- **FR-003**: The pipeline MUST run static source-code security scanning (SAST) on every run.
- **FR-004**: The pipeline MUST build one single deployable package containing both the
  application's user interface and its backend API, servable together as one unit.
- **FR-005**: The pipeline MUST scan the built package for known vulnerabilities before it is
  published.
- **FR-006**: The pipeline MUST publish the built, scanned package to a private registry —
  never a publicly accessible one.
- **FR-007**: The pipeline MUST fail (blocking publish and deployment) when the source-code
  security scan reports an error-level finding, or when the image vulnerability scan reports a
  critical- or high-severity finding. Lower-severity findings from either scan MUST be recorded
  in the run's output without blocking the pipeline.
- **FR-008**: The deployment step MUST ensure the credential that lets the target environment
  pull the private package exists before deploying, creating it if it doesn't already exist
  without failing when it does.
- **FR-009**: The deployment step MUST ensure a running database with persistent storage exists
  in the target environment before deploying the application, creating it if it doesn't already
  exist without failing when it does, and this database MUST never be shut down automatically due
  to inactivity (unlike the application itself).
- **FR-010**: The deployment step MUST ensure the database's access credentials exist as a
  securely stored secret in the target environment, sourced from one stable, pre-configured
  value — MUST NOT generate a new value on each run.
- **FR-011**: The deployment step MUST bring the database schema up to date before the new
  application version can receive any live traffic, and MUST stop the deployment (not proceed) if
  this step fails.
- **FR-012**: The deployment step MUST deploy the application as a workload that can scale down to
  zero when idle, kept separate from the always-on database.
- **FR-013**: Every successful deployment MUST result in the application being reachable at the
  project's one fixed web address.
- **FR-014**: The pipeline MUST verify reachability via an actual request/response check against
  the fixed web address — not merely by the absence of internal errors — and MUST report the run
  as failed if that check does not succeed.
- **FR-015**: The deployment mechanism MUST be safe to run repeatedly: running it again with no
  code changes MUST NOT fail, MUST NOT create duplicate infrastructure, and MUST NOT disrupt the
  already-running application.
- **FR-016**: The pipeline MUST NOT allow two deployment runs to execute concurrently against the
  same target environment.
- **FR-017**: The pipeline MUST execute on infrastructure the project already controls directly
  (with network access to the target environment), not on third-party-hosted, shared execution
  infrastructure.
- **FR-018**: Reaching the application at its fixed web address MUST rely on a one-time, clearly
  documented local machine configuration step rather than public DNS; the pipeline MUST NOT
  attempt to automate that local step.

### Key Entities

- **Build Artifact**: The single published package (image) produced by one pipeline run,
  identified by the commit it came from; consumed only by this project's own deployment step.
- **Deployed Application Instance**: The live, running version of the application currently
  serving the fixed web address; replaced (not duplicated) by each successful deployment.
- **Application Database**: The persistent datastore the application depends on; created once and
  reused by every subsequent deployment, never recreated from scratch.
- **Database Access Credential**: The stable secret the application uses to reach its database;
  provisioned once from a fixed source and reused, never regenerated.
- **Registry Access Credential**: The secret that lets the target environment pull the private
  build artifact; provisioned once and reused.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer who pushes a working code change to main sees that change live at the
  project's fixed web address, with no manual deployment step, within one pipeline run.
- **SC-002**: 100% of pipeline runs that reach the deployment stage end with the application
  verifiably reachable and responding correctly at the fixed web address — never a run reported
  successful while the application is actually unreachable.
- **SC-003**: Running the full pipeline repeatedly back-to-back with no code changes never
  breaks the running application, never duplicates infrastructure, and never loses existing
  application data, across an unlimited number of repeat runs.
- **SC-004**: Every pipeline run's lint, security-scan, and vulnerability-scan results are visible
  to the team directly from that run's own record, without needing to search elsewhere.
- **SC-005**: No secret value (passwords, access tokens) is ever visible in the pipeline's visible
  output or stored in the project's source code.

## Assumptions

- The pipeline is triggered automatically by pushes to the main branch; it may also support an
  on-demand manual trigger for re-running deployment without a new code change. Pull-request-only
  gating (running checks on a proposed change before it merges, without publishing/deploying) is
  out of scope for this feature.
- The target serving environment (the cluster, its serverless capability, its ingress/TLS)
  already exists and is reachable, per the project's earlier phases — this feature provisions
  only the application, its database, and the pipeline itself, not the underlying platform.
- The one-time creation of the long-lived registry access token and the database's stable
  password (as values the pipeline reads at run time) are manual, documented setup actions
  performed once by a project maintainer beforehand — not something the pipeline creates for
  itself on first run.
- If a deployment's new version fails to become healthy, the existing serving environment's own
  behavior of not shifting live traffic to an unhealthy version is relied upon; this feature does
  not add separate custom rollback logic beyond that.
- Exactly where in the target environment the application's resources live (e.g., which
  namespace) is a planning-level detail, not decided by this specification.
