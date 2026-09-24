# Context Handoff: GitHub Actions + Sample App Deployment Phase

This document carries forward everything needed to start Part III of the DevOps AI
certification task in a fresh session, without re-explaining Parts I and II. Paste the
"Kickoff prompt" section at the bottom into the new session to start working immediately.

---

## 1. The certification task (full original scope)

**DevOps AI Certification task.** Time budget: 1 working day, max 8 hours total, can be
split across multiple sessions. Use of AI frameworks (Spec Kit, subagents, skills) is
encouraged.

Sample app source: `https://devops-gitlab.inno.ws/devops-ai-certification/sample-app`
(already cloned to `~/ai-course-task/sample-app`, from GitLab — this is not yet a GitHub
repo; see §6 below).

**I. Terraform (DONE — see `terraform-infra` repo)**
4 VMs via libvirt/KVM: `nginx-vm`, `k3s-control-plane`, `k3s-worker1`, `k3s-worker2`.

**II. Ansible (DONE — see `ansible-provisioning` repo, and §2–4 below for what it actually
built)**
1. k3s cluster provisioning
2. Knative Serving + Kourier on top of k3s
3. nginx reverse-proxy with self-signed TLS

**III. GitHub Actions (THIS REPO — not started yet)**
1. CI pipeline: lint / SAST, build the sample app Docker image, Trivy scan, push to GHCR
2. Self-hosted runner deploys the sample app to the local k3s cluster as a Knative service
   (`kn service apply`)
3. Sample app must be reachable at `https://<app-name>.<domain-name>` (this specific URL
   shape is now **fixed**, not open — see §5) — requires adding
   `<nginx-vm-ip> <app-name>.<domain-name>` to local `/etc/hosts`

**Deliverables**: 3 separate **private** GitHub repositories (Terraform / Ansible /
sample-app + GitHub Actions), plus a working local cluster running the sample app as a
serverless workload, reachable via the domain name.

---

## 2. What's already done: `ansible-provisioning` repository

**Status**: fully implemented and verified against the live 4-VM fleet. `VERIFICATION.md`
written documenting the real verification history. **Not yet git-committed or pushed** —
this was a deliberate pause (see §7) — currently exists only as a local working directory
at `~/ai-course-task/ansible-provisioning`.

All 38 tasks in `specs/001-k3s-knative-nginx-tls/tasks.md` are complete and were verified
live, not just marked done — including two real defects found and fixed during
verification (see §3). Spec Kit artifacts (`spec.md`, `plan.md`, `research.md`,
`data-model.md`, `tasks.md`, constitution) are all in `specs/001-k3s-knative-nginx-tls/` if
Part III needs to check exact FR wording or entity names.

### What's live on the cluster right now

| Component | State |
|---|---|
| k3s | 3-node cluster, `v1.34.11+k3s1`, control-plane tainted `NoSchedule`, Traefik disabled |
| Knative Serving + Kourier | Installed at `knative-v1.23.0`, Kourier is the *only* ingress (`config-network` ingress-class = kourier), no Istio/Contour present |
| nginx (`nginx-vm`) | TLS-terminating reverse proxy, self-signed cert covering `cert.local` + `*.cert.local`, proxies to Kourier's live-discovered gateway |
| Application layer | **Nothing deployed** — this feature deliberately stops at "platform ready to receive one" (spec Assumptions). No Knative Service exists yet. That's Part III's job. |

---

## 3. Known issues found and fixed during Part II — relevant lessons for Part III

**Both of these are already fixed in `ansible-provisioning`'s roles — listed here so Part
III doesn't have to rediscover them if similar symptoms show up.**

### nginx → Envoy HTTP/1.0 rejection (426 Upgrade Required)
Kourier's gateway is Envoy-based; Envoy rejects plain HTTP/1.0, which is nginx's
`proxy_pass` default. Fixed in `roles/nginx_tls_proxy/templates/cert-local.conf.j2` with
`proxy_http_version 1.1;` + `proxy_set_header Connection "";`. **Relevant to Part III**:
if the self-hosted runner or any other component ever proxies to Kourier directly (rather
than through nginx), the same HTTP/1.1 requirement applies.

### Field-manager contention on Knative's webhook configs (cosmetic, not a bug)
Re-applying `serving-core.yaml` always shows `changed=1` on two specific webhook config
objects because Knative's own `webhook` Deployment continuously reconciles their `rules`
field independently of the static manifest. Documented in `VERIFICATION.md` and
`tasks.md` T036. **Not relevant to Part III** unless it re-applies Knative manifests
itself (it shouldn't need to).

### `kubectl`/kubeconfig gotcha (found just now, worth carrying forward explicitly)
A local `kubectl` on the WSL2 host may already have an unrelated context configured
(in this session's case, a pre-existing AWS EKS context) as its current-context. **The
self-hosted GitHub Actions runner will face exactly this same problem** when it needs to
run `kn service apply` / `kubectl` against the k3s cluster: it needs its own kubeconfig
pointing at `k3s-control-plane`, not whatever default context might exist.
- k3s's own kubeconfig lives at `/etc/rancher/k3s/k3s.yaml` on `k3s-control-plane`
  (`10.10.10.11`), readable via `sudo`.
- That file's `server:` field defaults to `https://127.0.0.1:6443` (correct only from the
  control-plane's own perspective) — **must be rewritten to
  `https://10.10.10.11:6443`** before it will work from anywhere else (the runner
  included, if the runner lives elsewhere than on `k3s-control-plane` itself — see the
  open question in §6 about where the runner actually runs).

---

## 4. Provisioned topology and access (unchanged from Part I/II, repeated for convenience)

| VM name | IP | Role |
|---|---|---|
| `nginx-vm` | `10.10.10.10` | reverse-proxy + TLS termination |
| `k3s-control-plane` | `10.10.10.11` | k3s control plane (tainted, no workloads scheduled here) |
| `k3s-worker1` | `10.10.10.12` | k3s worker |
| `k3s-worker2` | `10.10.10.13` | k3s worker |

- Network: `10.10.10.0/24`, distinct from libvirt's `default` network
  (`192.168.122.0/24`) — do not confuse the two.
- SSH: user `ubuntu`, key at `~/.ssh/kvm-provisioning-terraform`, password auth disabled.
- First-boot network race is still a live possibility on VM restart — recovery script is
  `terraform-infra/scripts/recover-vms.sh`.

---

## 5. Decisions already fixed by Part II — Part III MUST conform to these, not re-decide them

- **Domain**: `cert.local`, resolves only via local `/etc/hosts`, pointed at `nginx-vm`
  (`10.10.10.10`).
- **URL scheme — fixed to subdomain-per-app**: `https://<app-name>.cert.local`. The
  path-based alternative (`https://cert.local/<app-name>`) was explicitly rejected during
  Part II's `/speckit-specify`. The self-signed certificate's SAN list is
  `cert.local` + `*.cert.local` specifically to support this.
- **`/etc/hosts` entry needed by Part III is per-app, not just the bare domain** — this
  is a real gotcha worth flagging explicitly: since there's no wildcard support in
  `/etc/hosts`, whatever `/etc/hosts` line the certification task's Part III step asks for
  must be the *specific* app subdomain, e.g. `10.10.10.10 sampleapp.cert.local` — not
  `10.10.10.10 cert.local` alone. Decide the actual `app-name` early in Part III's spec so
  this is unambiguous.
- **TLS verification is deliberately bypassed everywhere**, not just within
  `ansible-provisioning`'s own checks: the self-signed cert's CA is *not* installed as
  trusted anywhere (Part II's spec Clarifications, decided deliberately). This means
  **Part III's self-hosted runner must use `curl -k` / `insecure-skip-tls-verify` (or the
  equivalent for whatever tool it uses) when verifying the sample app is reachable** —
  don't try to add trust-chain verification in Part III; that would be inconsistent with
  the decision already made and ratified in Part II.
- **Kourier's gateway port/address must never be hardcoded** — same principle carries
  over: if Part III's pipeline or runner setup ever needs to know how to reach the
  cluster's ingress directly (bypassing nginx), it must discover it live
  (`kubectl get svc kourier -n kourier-system`), the same way `ansible-provisioning`
  does — not assume port 80.

---

## 6. Open questions Part III's constitution/spec must resolve (not fixed yet)

- **Where does the self-hosted GitHub Actions runner actually run?** Options: on one of
  the existing 4 VMs (which one? `k3s-control-plane` has direct cluster access but is
  tainted for workloads, not necessarily for a runner process; `nginx-vm` has no cluster
  access currently), on the WSL2 host itself, or a new VM. Whichever is chosen needs
  network access to `k3s-control-plane`'s API server (`10.10.10.11:6443`) and a working
  kubeconfig per §3's gotcha, plus the `kn` CLI installed.
- **GHCR image pull access from the cluster**: if the pushed image is private, k3s/Knative
  needs an `imagePullSecret` configured with GHCR credentials — this doesn't exist yet.
  Alternative: make the GHCR package public, which is simpler but a real security-posture
  decision worth deciding explicitly rather than defaulting to it silently.
- **Sample app name** (the `<app-name>` in the URL) — not yet chosen. Needs to be decided
  before the `/etc/hosts` entry and the Knative Service name can be finalized (see §5's
  gotcha about per-app subdomain entries).
- **The `sample-app` source is currently a GitLab clone, not a GitHub repo.** The
  certification's deliverable is a *private GitHub* repository containing the sample app
  source + GitHub Actions. Decide early: push the existing cloned source into a fresh
  private GitHub repo (preserving history if possible, or as a fresh init), then add
  `.github/workflows/` — this should happen in Part III's Setup phase, not be assumed.

---

## 7. Current repo state — `ansible-provisioning` is intentionally not yet pushed

`git init`/commit/push for `ansible-provisioning` was deliberately paused mid-session (not
forgotten) — implementation and verification are complete, `VERIFICATION.md` is written,
and a safety check for accidentally-committed secrets was run and came back clean, but the
actual `git init` → commit → `gh repo create --private` → push sequence was not yet
executed. This can be finished independently of Part III (they don't depend on each
other) — worth doing at some point before final submission, but not a blocker for
starting Part III now.

---

## 8. Process/methodology used so far (continue the same pattern)

Same as Parts I and II: GitHub Spec Kit (`specify` CLI) with Claude Code, per-repo (not a
shared root workspace — avoids a known git-root-resolution bug in Spec Kit, keeps spec
artifacts visible inside the actual deliverable repo). Command sequence per repo:
`specify init --here --integration claude` → `/speckit-constitution` →
`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-analyze` → `/speckit-implement`.

**Lessons carried forward from Parts I and II, still applicable**:
- Keep shared vocabulary identical across `spec.md`/`data-model.md`/`research.md`/
  `tasks.md` — a mismatch caused a real blocking bug in Part I, caught by
  `/speckit-analyze`. Don't skip that gate.
- Verify version/behavior claims against live/official sources during `/speckit-plan`
  research, not from memory — this caught real, current information in both prior parts
  (a Terraform provider rewrite in Part I, exact Knative/k3s compatibility in Part II).
- After `/speckit-implement`, manually verify claims against the live system rather than
  trusting "all done" — this is what caught both real defects in Part II (§3). Live CI
  runs and actual `kn service apply` output are Part III's equivalent of this discipline —
  don't accept a green GitHub Actions checkmark as sufficient without confirming the app
  is actually reachable via the real URL, with real curl output.
- When something doesn't match what's claimed, ask for actual raw output (logs, diffs,
  command results), not summaries — this is what caught the incorrect caBundle diagnosis
  in Part II, which turned out to be a different field entirely.

---

## 9. Kickoff prompt for the new session

Paste everything below into the new Claude Code session, opened in a fresh directory
(either turning the existing `~/ai-course-task/sample-app` clone into the new repo, or a
sibling directory — decide based on §6's last open question):

```
I'm continuing the DevOps AI certification task, starting Part III (GitHub Actions +
sample app deployment). Parts I (Terraform) and II (Ansible: k3s + Knative/Kourier + nginx
TLS) are both done and verified — full context is in the attached
sample-app-actions-context.md. Read it fully before doing anything else, especially §5
(decisions already fixed that this repo must conform to) and §6 (open questions this
repo's spec/clarify needs to resolve).

This repo needs to, using GitHub Actions:
1. CI pipeline: lint/SAST, build the sample app Docker image, Trivy scan, push to GHCR.
2. Self-hosted runner that deploys the sample app to the local k3s cluster as a Knative
   Service via `kn service apply`.
3. Make the sample app reachable at https://<app-name>.cert.local (URL scheme already
   fixed by Part II — do not reconsider path-based routing).

Before drafting the constitution, help me resolve §6's open questions first (where the
runner lives, GHCR image visibility, the app name, and turning the GitLab-cloned
sample-app into a private GitHub repo) — these affect the constitution's Technology Stack
Constraints, so let's settle them before /speckit-constitution rather than during it.

Connectivity: SSH as `ubuntu` using the key at ~/.ssh/kvm-provisioning-terraform, k3s API
at 10.10.10.11:6443 (kubeconfig needs the 127.0.0.1 → 10.10.10.11 fix described in §3).
TLS verification is deliberately bypassed everywhere per §5 — don't add trust-chain
verification anywhere in this repo's checks.

Once we've settled the open questions, set up Spec Kit the same way as the previous two
repos (specify init --here --integration claude), then start with /speckit-constitution.
```
