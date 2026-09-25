# CI/CD Self-Hosted Runner Setup (one-time, manual)

This is one-time, manual setup performed by a project maintainer on this WSL2 host before the
`.github/workflows/deploy.yml` pipeline can run for real. None of this is automated by the
pipeline itself (Constitution Principle V; spec.md Assumptions).

## 0. FIRST — before anything else below: verify the Actions Runner binary version

**This is a hard blocker, not routine housekeeping.** Verify this WSL2 host's self-hosted
GitHub Actions Runner binary is at **v2.327.1 or later**, upgrading it now if it isn't.

GitHub removed Node.js 20 from Actions runners entirely on **September 23, 2026**, with no
fallback: the temporary `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` opt-out that previously let
older runners keep working is itself gone as of that date. `actions/checkout@v7`,
`actions/setup-node@v7`, and `actions/upload-artifact@v7` (used throughout `deploy.yml`) all
require Node.js 24 runtime support, which only a runner at v2.327.1+ provides.

If this runner's binary predates v2.327.1, **the very first job in the workflow fails
outright** — not a deprecation warning, an outright failure. Check and upgrade this before
installing anything else in this document.

```bash
# From the runner's install directory:
./config.sh --version   # or check the runner's own update mechanism / re-download from
                         # https://github.com/actions/runner/releases if below 2.327.1
```

## 1. Install required tooling on this host

- **Docker** — used to build the production image, and to run Semgrep/Trivy via their
  official images (no separate install needed for those two).
- **`kubectl`** — talks to the k3s cluster.
- **`kn`** CLI — applies the Knative Service.
- **`jq`** — parses `semgrep-results.json` in the `sast` job's severity-gating step, and percent-encodes `SAMPLE_APP_DB_PASSWORD` for `DATABASE_URL` in the `deploy` job (`jq`'s `@uri` filter).
- **`envsubst`** (part of the `gettext-base` package on Debian/Ubuntu) — renders
  `k8s/migration-job.template.yaml` and `k8s/knative-service.template.yaml`.

## 2. Isolated kubeconfig (Constitution Principle V)

Copy `k3s-control-plane`'s kubeconfig and keep it **completely separate** from this host's
default `~/.kube/config` — this planning/implementation session confirmed the default config
on this host already holds unrelated EKS contexts, and merging would risk `kubectl`/`kn`
silently running against the wrong cluster.

```bash
ssh -i ~/.ssh/kvm-provisioning-terraform ubuntu@10.10.10.11 \
  "sudo cat /etc/rancher/k3s/k3s.yaml" > ~/.kube/sample-app-config
sed -i 's#https://127.0.0.1:6443#https://10.10.10.11:6443#' ~/.kube/sample-app-config
chmod 600 ~/.kube/sample-app-config
```

Set `KUBECONFIG=~/.kube/sample-app-config` in the **self-hosted runner service's own
environment** (e.g. its systemd unit's `Environment=` line, or `.env` file in the runner's
install directory) — not in the workflow YAML, so every job the runner executes picks it up
automatically without a per-step `env:` override.

## 3. `/etc/hosts` entry on this runner host

```
10.10.10.10 sample-app.cert.local
```

Required because FR-014's reachability check (`curl -k https://sample-app.cert.local`) runs
from wherever the runner executes — this host, not a generic "developer machine."

## 4. GitHub repository secrets and variables (Settings → Secrets and variables → Actions)

| Name | Type | Value |
|---|---|---|
| `GHCR_PULL_PAT` | Secret | A GitHub PAT scoped to `read:packages` only (Principle IV) |
| `GHCR_PULL_USERNAME` | **Variable** (not a secret) | The GitHub username that owns `GHCR_PULL_PAT` — **not** derived from `github.actor` at runtime, since whoever triggers a given workflow run need not be the PAT's owner |
| `SAMPLE_APP_DB_PASSWORD` | Secret | A stable password for the Postgres `sampleapp` user — set once, never regenerated (FR-010). Any character set is fine, including `@`/`:`/`/`/`#`/`?`/spaces/`%` — the `deploy` job percent-encodes it before embedding it in `DATABASE_URL`, so there is no need to restrict it to alphanumerics for this pipeline's sake |
| `JWT_ACCESS_SECRET` | Secret | A stable, random secret for signing access tokens (`apps/backend/src/shared/config/jwt.constants.ts` requires this to boot) — set once, never regenerated |

## 5. One-time GHCR package visibility check

Before the first real deploy (not repeated per pipeline run — visibility doesn't revert on
its own once set): confirm the `ghcr.io/<org>/sample-app` package visibility is set to
**Private** in the repository's GHCR package settings (Principle IV/FR-006). GHCR does not
reliably default a new package to private off `GITHUB_TOKEN` pushes alone.
