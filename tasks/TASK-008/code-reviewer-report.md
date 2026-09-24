# Code Review — TASK-008 / Epic-01 (User Management & Authentication)

**Scope:** `accelerator-mini/.worktrees/TASK-008/apps/backend` (NestJS) and `apps/frontend` (React 19 + Vite + Tailwind v4), reviewed against `tasks/TASK-008/api-designer-spec.md`, `architect-architecture.md`, `frontend-design-spec.md`, and `writing-plans-plan.md` (Phases A–K, J1–J9).

**Method:** Every planned task (A1–K5, J1–J9) was confirmed present and committed. Six focused reviews were run in parallel (one per phase group), each reading the actual source and test files — not summarizing from the plan. The five highest-impact findings were independently re-verified by direct file read before being included below.

## Summary

The implementation is broad, faithful to the plan, and genuinely test-driven — nearly every reviewed test asserts real behavior against real service/component code rather than trivially passing against a stub. **No issue rises to a confirmed Critical severity** (no SQL injection, no broken auth-guard chain, no crash-on-golden-path), but one Major finding (hardcoded JWT secret fallback) is elevated to **Critical** here because it matches the review checklist's explicit "no hardcoded secrets" security gate and its blast radius (full authentication bypass) if the deploy config omits the env var. Beyond that, there are 14 Major and 12 Minor findings spread across concurrency edge cases, two genuinely broken user-facing flows (family-selection association, camp-conversion consume), file-upload hardening gaps, and a handful of accessibility items.

**Verification evidence (DoD):**
- Backend: `npx jest` → **29 suites / 196 tests passed**
- Frontend: `npx vitest run` → **30 files / 78 tests passed**; lint clean (3 harmless fast-refresh warnings only); `tsc -b` clean; `vite build` succeeds
- Two bugs found and fixed live during browser verification (see `tasks/TASK-008/` session notes): missing backend CORS (`main.ts`), and an uncaught `AxiosError` in `BrandingProvider` for trainer-less users — both already fixed and not re-listed below.

---

## Issues Found

### Critical (Must Fix)

- [ ] **Hardcoded fallback JWT secret, no fail-fast on missing env var** — `apps/backend/src/shared/config/jwt.constants.ts:2`. `JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me'`, with no startup assertion. *Failure scenario:* a deploy that omits `JWT_ACCESS_SECRET` boots silently on a public, source-committed secret — anyone can forge a valid `{ role: SUPER_ADMIN }` access token and take over any account. Fix: throw on boot if the env var is unset; never ship a working default.

### Major (Should Fix)

**Backend — Foundation/Auth**
- [ ] **Login timing side-channel defeats anti-enumeration** — `auth.service.ts:105`. Unknown email short-circuits before `bcrypt.compare` runs; known email pays the ~200ms cost-12 compare. Response *body* is identical, but latency reliably signals whether an email is registered. Fix: compare against a dummy hash on the unknown-email path.
- [ ] **`ValidationPipe` errors don't map to the spec's `VALIDATION_ERROR` contract** — `shared/errors/app-exception.filter.ts:37-49`. `class-validator` failures surface as `errorCode: 'HTTP_EXCEPTION'` with the field-level `details` lost and `message` as an array instead of the spec'd string. Clients keying on `errorCode === 'VALIDATION_ERROR'` never match.

**Backend — Admin/Impersonation/Profile**
- [ ] **Impersonation dual-cookie handoff is not implemented** — `impersonation.controller.ts:32-37`. `start()` returns the token pair in the JSON body; there is no cookie of any kind (confirmed by grep — zero cookie/`@Res` references in the whole module). The spec's core safety guarantee ("admin's own session cookie is never overwritten") is neither implemented nor testable. *Failure scenario:* a client stores the impersonation token in the same slot as the admin's real session, silently clobbering it.

**Backend — ShareLink/Player-Parent**
- [ ] **Expired-but-PENDING purchase approvals are still approvable; `expireStale()` doesn't exist** — `purchase-approval.service.ts:122-175` (confirmed by direct read: `assertOwnedAndPending` checks only `status !== PENDING`, never `expiresAt`; lazy-expiry only runs inside `listForParent`). *Failure scenario:* a child requests a $20 USD purchase, the parent never opens the list, and 3 days later `POST /purchase-approvals/:id/approve` still succeeds despite the 48h window closing.

**Backend — Coach/Trainer/Camp/Cross-cutting**
- [ ] **Logo upload is never resized** — `shared/storage/local-disk.storage.ts:41-51` (confirmed by direct read: `saveLogo` writes the raw buffer; only `savePhoto` calls `sharp().resize()`). A 4000×4000 PNG gets served full-size into the shared `AppHeader`.
- [ ] **No 2MB size cap on logo upload** — `branding.controller.ts:47`. `FileInterceptor('logo')` has no `limits`, and nothing checks byte length — a 100MB upload is fully buffered and written to disk (resource-exhaustion vector).
- [ ] **Camp-conversion consume-and-associate flow was never wired up** — `camp-conversion.service.ts`/`.controller.ts`. `getDraft` is read-only: it never invalidates the draft and nothing associates the resulting account with the named trainer. One draft token can pre-fill unlimited registrations for 24h.
- [ ] **`coach-invite-concurrency` e2e exercises the wrong race** — `test/coach-invite-concurrency.e2e-spec.ts:48-65`. It races two *new-user* accepts (contesting the `User.email` unique index), not the single-trainer re-check, and explicitly tolerates a 500 — so the named "single trainer under concurrency" guarantee is unverified, and the underlying check-then-create at `coach-invite-accept.service.ts:82-88` has no P2002 catch.

**Frontend — Auth/Routing/Admin**
- [ ] **Refresh token persisted in `localStorage`** — `api/token-storage.ts:5-12,27-30`. Both the access token and the 7-day sliding refresh token live in `localStorage`, contradicting the backend's httpOnly-cookie-oriented design. Any XSS gets a durable, reload-surviving account takeover, not just an access-token leak.
- [ ] **`RegisterPage.tsx` is missing the required child sub-form** — confirmed by direct read: no toggle, no child fields, no `shareLinkCode` handling anywhere in the file, despite `RegisterPayload` supporting it and the design spec requiring it. The US-01.03 "register my child" entry path is simply absent.
- [ ] **`RegisterPage.test.tsx` gives false confidence** — it only covers the success/duplicate paths, so the suite stays green while the spec-required behavior above is unimplemented.

**Frontend — Profile/ShareLink/Player/Coach/Trainer**
- [ ] **`JoinLandingPage.tsx:64-81` — family-selection "Confirm" POSTs a blank registration instead of associating** — it calls `registerViaLink(code, { email:'', password:'', ... })`. *Failure scenario:* an already-logged-in multi-trainer parent selects family members and clicks Confirm; the backend rejects the blank email/password (400), so the association is never created — the feature is non-functional as wired.
- [ ] **`ProfileEditPage.tsx:80-87` — photo upload has no error handling.** Every other mutation on the page has `try/catch`; this one doesn't. A failed upload produces an unhandled rejection with no Banner — the user sees nothing and assumes it saved.
- [ ] **`StampBadge.tsx:6-7` — likely WCAG contrast failure (unverified by tool, flagged as plausible).** `inactive` (#8B8578) and `pending` (#B0791A) on the paper background estimate to ~3.3–3.5:1 for 12px uppercase text, below the 4.5:1 AA minimum — low-vision users may not be able to read "REMOVED"/"EXPIRED"/"PENDING" stamps. Recommend verifying with an actual contrast tool before treating as confirmed.

### Minor (Consider)

**Backend**
- `/auth/refresh` returns only `{ accessToken, refreshToken }`, missing the spec'd `user` field (`auth.controller.ts:85-89`).
- `TokenService` manually `new`s `JwtService` instead of using DI (`token.service.ts:31`).
- `OptionalJwtAuthGuard.canActivate` is a no-op override that can be deleted (`optional-jwt-auth.guard.ts:14-18`).
- Impersonation-cap-survives-refresh edge case is implemented but untested (`token.service.spec.ts`).
- `editUser` has no existence/role check before touching `trainerProfile` — editing a non-trainer with `businessName` set throws an unmapped Prisma `P2025` → 500 instead of 404 (`user-admin.service.ts:154-159`).
- Photo upload has no size cap and a missing file crashes with a raw TypeError instead of 400 (`profile.controller.ts:44-49`).
- `createTrainer`/`deleteUser` response shapes deviate from the spec'd `UserSummaryDto` (`user-admin.controller.ts:34-35,69-74`).
- No child notification is sent when a purchase approval auto-expires (`purchase-approval.service.ts:108`).
- TOCTOU: email-uniqueness and `TrainerPlayerAssociation` checks happen outside/before the transaction in `player-registration.service.ts` (inconsistent with the coach path, which checks inside the tx) — a double-submit surfaces a raw 500 instead of 409/idempotent.
- Availability owner-scoping returns 404 where the spec says 403 (`availability.service.ts:145`) — safe, just the wrong status code.
- `TrainerRosterService` materializes the full roster and paginates in-memory, plus N+1 availability lookups per member — fine at current scale, will degrade.

**Frontend**
- `VerifyEmailPage.tsx:15-37` — under React 19 StrictMode double-invoke, a valid one-time token can render as "invalid" on the second (failed) call.
- `ImpersonationHistoryPage.tsx:41-52` — `.finally` with no `.catch`; a failed fetch shows an empty table with no error state.
- `UsersListPage.tsx:321-329` — search has no debounce, firing one request per keystroke.
- `LoginPage.tsx:36` — post-login redirect drops query string/hash from the intended destination.
- Most exported page components lack explicit return types (inconsistent with `AuthContext.tsx`, which annotates).
- `AvailabilityGrid.tsx:51` — rows keyed by array index in a list supporting mid-list removal; can misassociate focus/DOM after a removal.
- `BestTimesPage.tsx:53` / `MyTimesPage.tsx:49` — save confirmation is a plain `<p>`, not an `aria-live` region.
- `ContextSwitcher.tsx:62-124` — `role="menu"` has no roving focus and doesn't close on Escape/outside-click; also missing `aria-haspopup` on the trigger (`:53-60`).
- `TrainerBrandingPage.tsx:64` — `URL.createObjectURL` preview is never `revokeObjectURL`'d.
- **Web Interface Guidelines:** email/password/coach-email inputs missing `autocomplete`/`name` (`JoinLandingPage.tsx:197-205`, `ShareLinkGenerationModal.tsx:76-82`); no skip-link to main content (`AppShell.tsx:10-16`).

### Positive Notes

- Full Phase-A–K and J1–J9 task coverage confirmed present and committed; no gaps between the plan and the actual file tree.
- bcrypt cost factor 12 preserved; refresh tokens stored only as hashes; JWT payload carries no PII beyond `sub`/`role`/`parentUserId`/`impersonatedBy`.
- Guard chain order (`JwtAuthGuard → RolesGuard → ChildAccountGuard → ThrottlerGuard`) matches the architecture spec exactly; login throttling correctly applied.
- GDPR delete correctly backs up the original email **before** overwriting and runs anonymize + log-insert in one transaction; deactivate/reactivate state machine correctly blocks resurrecting a `DELETED` user.
- ShareLink generation and coach-invite claiming are both genuinely race-safe (catch-and-retry-on-P2002 / atomic `updateMany`), each backed by a real concurrency test.
- Child login provisioning creates the `Profile` row in the same transaction as the `User` — the historically-noted bug class is explicitly avoided and tested.
- `CoachProfileService`'s public-profile lookup returns a truly uniform 404 across all three "not found" cases, gated on live `User.status`.
- Multi-tenancy isolation is real at the Prisma query level (`where: trainerId`), and the isolation e2e test seeds Trainer B's data before asserting exclusion — not just an empty-list coincidence.
- Frontend's `apiClient` 401-refresh-retry logic is correct and proven non-looping by an exact call-sequence test, including the refresh-itself-fails case.
- `Modal.tsx` implements a genuine focus trap with Escape-to-close and focus-restore; `PlayerProfilesPage.test.tsx` proves the Add-Child modal → submit → refetch wiring end-to-end, not just isolated renders.
- Multi-trainer branding color isolation is handled deliberately (reset-to-null before each fetch, in-flight-fetch guard) — confirmed correct in code, not just asserted by a test.

---

## Next Steps

**Next by flow:** `/coder [context]` and `/coder-frontend [context]` — fix the Critical finding and the Major findings above, starting with the JWT secret fail-fast, the impersonation cookie handoff, the JoinLandingPage broken association flow, and the missing RegisterPage child sub-form (the four with the widest user/security impact).

**Alternatives:**
- `/test-generator [context]` — close the testing gaps called out above (impersonation-cap-across-refresh, ValidationPipe error-shape, logo size/resize, single-trainer concurrency with a pre-existing coach, RegisterPage child-form coverage).
- `/finishing-branch [context]` — not recommended until the Critical and highest-impact Major findings are resolved.
