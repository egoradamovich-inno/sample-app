# Research: CI/CD Deployment Pipeline

All decisions below were verified against either (a) the live k3s cluster (via SSH to
`k3s-control-plane` at `10.10.10.11`, key `~/.ssh/kvm-provisioning-terraform`, since this planning
session's own `~/.kube/config` only has unrelated EKS contexts — the isolated runner kubeconfig
per Principle V doesn't exist yet), or (b) current official docs fetched via Context7, per
Principle VII. Raw command output is preserved inline where it drove the decision.

## 1. Migration execution mechanism (FR-011): Kubernetes Job vs. init-container

**Decision**: Kubernetes Job, run once per pipeline deploy, before `kn service apply`.

**Live-cluster evidence (decisive, not just a style preference)**:

```
$ kubectl get cm config-features -n knative-serving -o yaml
...
kubernetes.podspec-init-containers: "disabled"
...
labels: {app.kubernetes.io/name: knative-serving, app.kubernetes.io/version: 1.23.0}
```

Part II's Knative Serving 1.23.0 install has `kubernetes.podspec-init-containers` **disabled**
cluster-wide. Enabling it would mean editing the `config-features` ConfigMap that
`ansible-provisioning` (Part II) owns — which Principle I forbids re-provisioning or
second-guessing. This alone rules out the init-container mechanism for this repo without touching
out-of-scope infrastructure.

**Reasoning, independent of the above (would have pointed the same way even if the flag were
enabled)**:
- Knative Revisions are immutable and re-created on every `kn service apply` that changes the pod
  spec, and a Revision's pod (including any init container) is re-run on every cold start from
  scale-to-zero — not just on deploy. `prisma migrate deploy` is idempotent but still a wasted
  DB round-trip on every cold start, and it would run with the request-handling path blocked on a
  migration check that has nothing to do with serving that request.
- A Job scoped to the pipeline run executes `prisma migrate deploy` exactly once per deploy,
  completes before `kn service apply` runs, and its failure (non-zero exit) is a normal
  `kubectl wait --for=condition=complete job/...` failure — a clean, explicit, failure-visible gate
  per Principle VIII, satisfying FR-011's "stop the deployment if this step fails" without any
  Knative-side feature-flag dependency.

**Alternatives considered**:
- Init-container on the Knative Service pod spec: rejected — requires an out-of-scope platform
  change (see above) and re-runs on every cold start, not just on deploy.
- A `postStart` lifecycle hook: rejected — not failure-visible (Kubernetes does not fail pod
  scheduling on a `postStart` error in a way that blocks traffic before it starts), and would still
  re-run per-revision-instance like an init container.

## 2. Postgres resource requests/limits

**Decision**: Postgres Deployment requests `cpu: 250m, memory: 256Mi`; limits `cpu: 500m,
memory: 512Mi`.

**Live-cluster evidence** — actual headroom on the two schedulable nodes (control-plane is
`NoSchedule`-tainted, confirmed via `kubectl get nodes -o jsonpath='{.spec.taints}'`, so only
`k3s-worker1`/`k3s-worker2` are candidates):

| Node | Allocatable | Currently requested (existing Knative/Kourier system pods) | Headroom |
|---|---|---|---|
| k3s-worker1 | 2 vCPU / 2908Mi | 500m / 260Mi (`activator` + `net-kourier-controller`) | 1.5 vCPU / ~2.6Gi |
| k3s-worker2 | 2 vCPU / 2909Mi | 500m / 500Mi (`autoscaler` + `controller` + `3scale-kourier-gateway`) | 1.5 vCPU / ~2.4Gi |

(`kubectl describe node` "Allocated resources" section, both workers, confirms 25% CPU / 8–17%
memory currently committed — see command transcript from this planning session.)

A 250m/256Mi request leaves >1 vCPU and >2Gi free per worker even before considering the app's
own Knative revision pod (small NestJS container, request ballparked at 100m/256Mi in the
manifest) and the one-shot migration Job (same footprint, runs to completion and exits). The
512Mi limit gives Postgres burst room without being able to single-handedly pressure a 2908Mi
node into OOM-killing the co-located activator/autoscaler/kourier pods, whose own limits already
reserve up to 1000Mi/800Mi each on separate nodes.

**Alternatives considered**:
- No explicit requests/limits ("best effort" / `BestEffort` QoS): rejected per the user's
  instruction and because on a 3GB node, an unbounded Postgres under load is exactly what could
  starve or OOM-kill the Knative control plane pods sharing the node — there is no cluster-level
  isolation between namespaces here.
- Larger requests (e.g. 500m/512Mi) to be conservative: rejected as unnecessary given the measured
  headroom; would not change scheduling outcomes but would reserve capacity nothing currently
  needs.

## 3. PVC storage class / reclaim policy

**Decision**: Add a dedicated `StorageClass` (`sample-app-db-storage`, provisioner
`rancher.io/local-path`, `reclaimPolicy: Retain`) and reference it explicitly on the Postgres PVC,
rather than relying on the cluster default.

**Live-cluster evidence**:

```
$ kubectl get storageclass -o yaml
...
  metadata:
    annotations:
      storageclass.kubernetes.io/is-default-class: "true"
    name: local-path
  provisioner: rancher.io/local-path
  reclaimPolicy: Delete
  volumeBindingMode: WaitForFirstConsumer
```

Confirmed: k3s's built-in default (`local-path`, from the `local-storage` k3s addon) has
`reclaimPolicy: Delete`. Under `Delete`, deleting the PVC (e.g. an accidental
`kubectl delete pvc` during a manual debugging session, or a slip in a future `kubectl apply -f`
that changes the PVC name and orphans the old one) deletes the backing host-path directory and
its data — for Principle VIII's "never recreated from scratch" persistent database, that is an
unacceptable single point of accidental data loss with no recovery path.

A dedicated `StorageClass` with `reclaimPolicy: Retain` (same `provisioner: rancher.io/local-path`
and `volumeBindingMode: WaitForFirstConsumer`, since the underlying provisioner and node-local
binding behavior are Part II platform facts this repo isn't changing — only the reclaim policy
differs) means a deleted PVC leaves its `PersistentVolume` in `Released` state with data intact
on-disk, recoverable by an operator, instead of being silently destroyed. This is defense-in-depth
that costs one extra manifest and doesn't touch Part II's actual `local-path` StorageClass.

**Alternatives considered**:
- Use the default `local-path` StorageClass as-is: rejected — `Delete` reclaim policy is an
  accidental-data-loss risk for the one genuinely persistent, "never recreated" resource this repo
  owns (Principle VIII).
- Patch the existing default `local-path` StorageClass's `reclaimPolicy` in place: rejected —
  `reclaimPolicy` is immutable after StorageClass creation (Kubernetes API rejects the patch), and
  mutating a Part-II-owned, cluster-wide default object would affect any other future PVC on the
  cluster, violating Principle I's "don't second-guess platform-level decisions."

## 4. Concurrency control mechanism (FR-016)

**Decision**: GitHub Actions native `concurrency:` key at the deploy job level:
```yaml
jobs:
  deploy:
    concurrency:
      group: deploy-sample-app
      cancel-in-progress: false
```

**Docs verification** (via Context7, `/websites/github_en_actions`, current as of this session):
current syntax confirmed as `concurrency.group` (+ optional `concurrency.cancel-in-progress`),
settable at either workflow level or per-job — GitHub's own worked example for deployments
specifically shows job-level `concurrency: <group-name>` scoped to a deploy job so that other jobs
(lint/SAST/build) in the same workflow run are unaffected. `cancel-in-progress` defaults to
`false` when omitted; set explicitly here for clarity, not to change behavior.

**`cancel-in-progress: false` is a deliberate choice, not the default going unexamined**: a second
push arriving mid-deploy must **queue**, not cancel the in-flight run — cancelling a run partway
through `prisma migrate deploy` or `kn service apply` could leave the database mid-migration or
the Knative Service in a half-applied state, which is strictly worse than a queued run waiting a
few extra minutes. FR-016 only requires runs don't execute *concurrently*; it doesn't require
newer runs to preempt older ones.

**Alternatives considered**:
- Workflow-level `concurrency:` covering the whole workflow (lint+SAST+build+deploy): rejected —
  would serialize CI checks on unrelated concurrent pushes too, which FR-016 doesn't ask for and
  which would slow down feedback on lint/SAST failures for no safety benefit (those steps don't
  touch the shared target environment).
- `cancel-in-progress: true`: rejected per the reasoning above — safe to cancel a *queued* run, not
  a run that already started mutating cluster/DB state.
- Custom locking (e.g. a Kubernetes Lease or a lock file in the cluster): rejected — GitHub
  Actions' native `concurrency:` key already solves this at the workflow-scheduling layer, before
  the runner even starts; building custom locking would duplicate that for no benefit, and the
  user's brief explicitly asked to avoid this.

## 5. Target namespace

**Decision**: `sample-app` (not `default`), created idempotently by the deploy job
(`kubectl create namespace sample-app --dry-run=client -o yaml | kubectl apply -f -`) as its first
step. Every namespaced resource this repo introduces — the imagePullSecret (Principle IV), the DB
credentials Secret, the Postgres Deployment/Service/PVC (Principle VIII), the dedicated
StorageClass reference (cluster-scoped, not namespaced, but the PVC that uses it lives here), and
the Knative Service — is created in `sample-app`, consistently, across every manifest and every
`kubectl`/`kn` invocation in the deploy job.

**Live-cluster evidence**: `kubectl get ns` confirms only the stock namespaces exist today
(`default`, `knative-serving`, `kourier-system`, `kube-system`, `kube-public`,
`kube-node-lease`) — `default` is currently empty (`kubectl get all -n default` shows only the
built-in `kubernetes` Service), so there's no existing in-place work in `default` this decision
would disrupt.

**Alternatives considered**:
- `default` namespace: rejected — mixes this repo's application resources with whatever else may
  ever land in `default`, and gives no natural scope for `kubectl get all -n <ns>`-style
  operational checks specific to this app.

## 6. Semgrep and Trivy severity-threshold gating (FR-007), verified against current docs

**Semgrep** (Context7, `/semgrep/semgrep-docs`): `semgrep scan --severity=ERROR` reports findings
only from rules at that severity (repeatable flag; values `INFO`, `WARNING`, `ERROR` — the legacy
names for what the rule-metadata table now documents as `LOW`/`MEDIUM`/`HIGH`/`CRITICAL`, kept
backwards-compatible). Plain `semgrep scan` always exits `0` regardless of findings unless the
`--error` flag is passed (`semgrep ci` differs: it exits `1` on any finding by default unless
configured otherwise). Decision: run once with full output captured to a results file (all
severities, for SC-004 visibility) using `semgrep scan --config auto --json --output
semgrep-results.json`, then a follow-up step counts `ERROR`-severity entries in that JSON and
fails the job (`exit 1`) only if that count is nonzero — this satisfies both "record lower-severity
findings without blocking" and "fail on ERROR-level findings" from one scan pass rather than two.

**Trivy** (Context7, `/aquasecurity/trivy`): `--severity` accepts a comma-separated list (e.g.
`--severity CRITICAL,HIGH`) combined with `--exit-code 1` to fail only on those severities;
official CI examples confirm exactly this pattern (`trivy image --exit-code 1 --severity
CRITICAL ...`). Decision: two invocations against the same already-built local image — (1) full
report, all severities, `--exit-code 0`, output saved as the run's visible artifact for SC-004;
(2) gating pass, `--severity CRITICAL,HIGH --ignore-unfixed --exit-code 1`, fails the job on a
nonzero exit. Both runs reuse Trivy's local vulnerability DB cache, so the second pass is fast
(no re-pull, no re-scan of layers from scratch beyond cache lookup).

**`--ignore-unfixed` addendum (discovered during `/speckit-implement`'s first real pipeline
run, not anticipated in the original design)**: the gating pass without this flag reproducibly
failed on ~64 CRITICAL/HIGH findings — every one of them in `node:22-slim`'s Debian base layer
(util-linux, systemd, gzip, zlib, ncurses, perl) or npm's own bundled CLI installation
(pacote, picomatch, sigstore, etc.), confirmed via the actual Trivy table output: every single
finding had an empty `Fixed Version` column and a status of `affected`/`fix_deferred`/
`will_not_fix`. None were actionable by anything this repo controls — not a Dockerfile change,
not an `apt-get upgrade`, not a dependency bump. `--ignore-unfixed` is Trivy's own documented
shorthand for `--ignore-status affected,will_not_fix,fix_deferred,end_of_life` — it excludes
exactly this class of finding from the *gate* while the full report step (SC-004) stays
unfiltered, so genuinely fixable CRITICAL/HIGH findings (a real Fixed Version exists and isn't
applied) still block the pipeline. Separately, the same run's `node-pkg` findings that *did*
have a Fixed Version (`multer`, `sharp`, `react-router`, `deepmerge-ts`, `js-yaml` nested under
`@nestjs/swagger`) were fixed directly — version bumps plus root-level npm `overrides` for the
transitive-only ones — not filtered out.

## 7. `kubectl wait` timeout values for Postgres availability and the migration Job

**Decision**: `--timeout=240s` for `kubectl wait --for=condition=available deployment/sample-app-postgres`;
`--timeout=180s` for `kubectl wait --for=condition=complete job/sample-app-migrate-<run_id>`.

**Empirical evidence, not a guess**: this planning session actually ran the pieces being timed,
rather than estimating from memory:

- `docker run -d postgres:16 ...` then polling `pg_isready`: ready in **~2–4s** on this host once
  the container is running — confirms the readinessProbe's ~65s worst-case patience window
  (`initialDelaySeconds: 5` + `failureThreshold: 12` × `periodSeconds: 5`, data-model.md's
  Application Database entity) is already generous for `initdb`, not undersized.
- `postgres:16`'s image size is **642MB**; a fresh `docker pull postgres:16` (cache cleared first)
  completed in under 2s over this host's connection. The actual k3s workers pull over the same
  host's egress path (Part I's VMs are libvirt/KVM guests on this WSL2 host), but with nested
  virtualization/network variance unmeasured from this planning session, `240s` budgets several
  times that measured pull time as headroom, not because a multi-minute pull is expected.
- `prisma migrate deploy` was run for real against this repo's actual
  `apps/backend/prisma/migrations` (2 migrations: `20260101000000_init_epic01`,
  `20260101000100_refresh_token_impersonation_fields`; schema has 16 models) on a warm local
  Postgres 16 container: **completed in ~1s**. This confirms the 180s Job timeout is overwhelmingly
  pull/schedule headroom for the pipeline's own (larger, NestJS+frontend) image, not migration
  runtime — this schema's migration set is small and fast to apply regardless of where it runs.

**Alternatives considered**:
- Leaving `--timeout=...` as a literal placeholder for `/speckit-tasks`/`/speckit-implement` to
  fill in later: rejected — both values materially affect first-run reliability (an
  under-generous timeout would false-fail the very first deploy on infrastructure that has never
  pulled either image before), so they belong in the plan's own artifacts, verified, not deferred.
- A much larger timeout (e.g. 600s) "to be safe": rejected as unjustified once the actual
  migration/readiness timings were measured — an oversized timeout only delays failure detection
  for a genuinely stuck deploy (e.g. a real connectivity problem to Postgres), which works against
  Principle VI's "fail loudly" spirit.

**Addendum — revised after the first real deploy against the live cluster (`/speckit-implement`,
not anticipated at plan time)**: the migration Job's `kubectl wait --timeout=180s` timed out on
the very first real run. `kubectl describe pod` on the (still-present, `Complete`) Job's pod gave
the actual breakdown, not a guess: image pull took **1m31.861s** (92s) for the 337MB image — a
real first-ever pull of that exact tag on that node, in the same ballpark this planning
session's local-connection pull-time estimate assumed generous headroom for — and the Job's total
`DURATION` was **3m1s (181s)**, meaning the remaining ~89s went to container start + `prisma
migrate deploy` itself. That ~89s is dramatically higher than this session's earlier ~1s local
measurement, because that measurement ran unthrottled on this planning session's own machine,
not under the migration Job's original `100m`/`200m` CPU request/limit — the Prisma CLI's own
startup (transpiling `prisma.config.ts` via `jiti`, resolving and linking the query engine
binary) is real CPU-bound work, and 100-200m CPU throttles it heavily. **Revised**: Job resources
raised to `requests: {cpu: 250m, memory: 256Mi}` / `limits: {cpu: 500m, memory: 512Mi}` (closing
the gap at the root, not just papering over it with a bigger number), and the timeout raised to
`300s` (real margin above the observed 181s, rather than the ~1s the original 180s left). This is
exactly the class of assumption Principle VI exists to catch — a local approximation stood in for
the live system's actual behavior, and the live system disagreed.
