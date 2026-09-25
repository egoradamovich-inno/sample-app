# ADR-002: Sharp Fails on the Live k3s Cluster — Missing CPU SIMD Support (Part I Platform Blocker)

## Status

**Resolved.** The recommended Terraform fix (`cpu { mode = "host-passthrough" }` on the `k3s-worker1`/`k3s-worker2` `libvirt_domain` resources) was applied and re-provisioned outside this repo. Verified independently, not assumed: a throwaway diagnostic pod on each worker confirmed `sharp._isUsingX64V2()` returns `true` on both, and the live running libvirt domain XML for both workers shows `<cpu mode='host-passthrough' check='none' migratable='on'/>`. A subsequent real deploy confirmed the app pod boots cleanly with `sharp` loading via its native binding. See `specs/001-cicd-deployment-pipeline/research.md` §8 for the full evidence chain.

## Context

The first real deploy of the CI/CD pipeline (`.github/workflows/deploy.yml`) to the live k3s cluster produced a crash-looping pod:

```
TypeError: Cannot read properties of undefined (reading 'endsWith')
    at /app/node_modules/sharp/dist/sharp.cjs:115:19
```

The exact same image booted and served requests correctly in every local Docker test run during implementation (native `amd64`, this development host's CPU). It only fails on the actual k3s worker nodes.

## Root Cause (verified with live evidence, not inferred)

A diagnostic pod was scheduled directly onto `k3s-worker1` running the real deployed image, first to inspect `/proc/cpuinfo`, then to exercise `sharp`'s own module-loading sequence directly:

1. **`/proc/cpuinfo` on `k3s-worker1`** (via `kubectl run` with a node selector): exposes **none** of `avx`, `avx2`, `sse4_1`, `sse4_2`. This development host, by contrast, has all four. The k3s VMs' virtual CPU model (a Part I / Terraform-libvirt provisioning decision) is far more minimal than a typical modern x86-64 host.

2. **`sharp`'s native binding** (`@img/sharp-linux-x64/sharp.node`) loads successfully (the file is found and `dlopen` succeeds), but `sharp._isUsingX64V2()` returns `false` — the prebuilt binary requires the x86-64-v2 microarchitecture level (SSE4.2, POPCNT, etc.), which this CPU doesn't provide. `sharp` correctly detects this itself and nulls out the result with a synthetic `Error` carrying `code: "Unsupported CPU"`.

3. **`sharp`'s own documented fallback**, `@img/sharp-wasm32`, was added as an explicit dependency during implementation specifically to handle this class of problem. It **also fails**, with a different and more fundamental error:
   ```
   CompileError: WebAssembly.Module(): Wasm SIMD unsupported
   ```
   This CompileError has no `.code` property (unlike a normal Node module-resolution error), which is what trips a genuine bug in `sharp`'s own error-reporting code (`err.code.endsWith("MODULE_NOT_FOUND")` on an error whose `.code` is `undefined`) — but the underlying problem is real regardless of that cosmetic crash: **this CPU can't run WASM SIMD either**. V8's WebAssembly SIMD implementation itself needs a baseline of native SIMD instructions to lower to, and this virtual CPU doesn't provide enough of one.

Both of `sharp`'s available code paths — native and WASM — require SIMD support this CPU does not have at any level. This is not a "missing one optimization flag" problem; it's a CPU model that predates SSE4.x-era baseline assumptions most current native/WASM image-processing binaries make.

## Decision

**Do not work around this inside the `sample-app` repository.** Per Constitution Principle I ("Conform to the Provisioned Platform (NON-NEGOTIABLE)"), this repo must not re-provision, redesign, or second-guess platform-level decisions made in Part I (Terraform) or Part II (Ansible). The k3s VMs' CPU model is exactly such a decision, and the fix belongs there, not as an application-level or Dockerfile-level workaround in this repo.

Options considered and explicitly **not** taken here (each would work, but routes around the platform issue instead of fixing it):
- Build `libvips`/`sharp` from source in the Dockerfile targeting a generic, no-SIMD-assumed x86-64 baseline.
- Replace `sharp` with a pure-JavaScript image library (e.g. `jimp`) with no native/WASM binary at all.

Both remain available as a fallback if the platform-level fix turns out not to be feasible, but the recommended path is the platform fix below.

## Recommended Fix (Part I / Terraform, outside this repo's scope)

Add a `cpu` block to the affected `libvirt_domain` resource(s) provisioning the k3s worker VMs in `terraform-infra`, so the guest sees the host's real CPU features instead of QEMU's conservative default model:

```hcl
cpu {
  mode = "host-passthrough"
}
```

(A named baseline model with at least SSE4.2 — e.g. `Nehalem` or `SandyBridge` — is a viable alternative to `host-passthrough` if passthrough isn't desired for migration-portability reasons, as long as it includes SSE4.2.)

After applying the Terraform change, the affected VM(s) need to be recreated/restarted for the new CPU model to take effect, then re-provisioned via `ansible-provisioning` (k3s + Knative + nginx) per Part II's existing process.

## Consequences

### If left unaddressed
- The CI/CD pipeline's `deploy` job will continue to fail at the Knative Service readiness step for any code path that loads `sharp` at module-import time (this app's `LocalDiskStorage` does, for photo/logo thumbnailing) — which, since it's imported at bootstrap, blocks the *entire application* from starting, not just the photo/logo features.
- T030/T034/T035 (this feature's live-deploy checkpoints) cannot be completed until this is fixed.

### After the platform fix
- No changes needed in this repo — the existing `sharp` dependency (native binary) continues to work exactly as designed, and the `@img/sharp-wasm32` dependency added during implementation remains a harmless, more-portable safety net for any future host with WASM SIMD support but no native x86-64-v2 support.

## References

- `apps/backend/src/shared/storage/local-disk.storage.ts` — the only code path that imports `sharp`
- `specs/001-cicd-deployment-pipeline/research.md` §8 — implementation-time research note covering the same finding
- `specs/001-cicd-deployment-pipeline/tasks.md` — T030/T034/T035 blocked pending this fix
