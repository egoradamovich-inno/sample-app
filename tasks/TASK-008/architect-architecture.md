# TASK-008 Architecture — Epic-01: User Management & Authentication

> Kept isolated from `specs/architect-architecture.md` by explicit choice: that file (on
> `feature/epic-01-user-mgmt`/`feature/epic-01`) documents the real, already-shipped Epic-01
> architecture. This document is an independent architecture pass for TASK-008's hypothetical
> from-scratch redo (see `tasks/TASK-008/requirements-analyst-requirements.md` and
> `brainstorming-design.md`) — not merged into the living specs, not meant to be treated as the
> current system design.

### [TASK-008] User Management & Authentication (2026-07-22)

**Module placement:**

| Module | Path | Rationale |
|---|---|---|
| Auth | `modules/auth/` | Registration, login, tokens, verification, password reset — the one module every other module depends on |
| Users (admin) | `modules/users/` | Super-Admin-only CRUD/lifecycle; kept separate from `profile/` since it operates on *other* users, not the caller's own record |
| Profile | `modules/profile/` | Self-service only — every route derives its target from the JWT, never a path param, per this codebase's established self-only convention |
| Impersonation | `modules/impersonation/` | One-directional consumer of `AuthModule` (reuses `TokenService`) — kept its own module rather than folded into `users/` because its guard (`ImpersonationSessionGuard`) and audit model (`ImpersonationLog`) are a distinct cross-cutting concern, not user-CRUD |
| ShareLink | `modules/sharelink/` | Owns `ShareLinkService` (player static links) and a `CoachInviteService` sibling (coach unique links) — split because static-link and coach-invite lifecycles diverge enough (expiry, use-limits, single-trainer constraint) to warrant separate services under one module, not one god-service |
| Player Profile | `modules/player-profile/` | Folds `PlayerProfileService` / `TrainerAssociationService` / `ChildAccountService` as siblings — three genuinely distinct concerns (profile CRUD, association management, child-login provisioning) that all operate on the same `PlayerProfile` aggregate and would otherwise force awkward cross-module calls for a single family-management screen |
| Purchase Approval | `modules/purchase-approval/` | Separate module, not folded into `player-profile/` — its own entity (`ChildPurchaseApproval`), its own lazy-expiry-on-read lifecycle, and it's the one place payment-adjacent logic lives pre-Epic-05 |
| Availability | `modules/availability/` | Shared by both player "Best Times" and coach "My Times" — same `Availability` entity/shape (`ownerType` discriminator), so one module serves both rather than duplicating the grid logic per role |
| Coach Profile | `modules/coach-profile/` | Owns the coach-specific behaviors that don't fit `profile/`'s generic self-service shape: public-profile visibility/slug, and the availability-conflict-check/override primitive (stub ahead of Epic-02) |
| Trainer Roster | `modules/trainer-roster/` | Read-oriented planning views (own-org player/coach lists, availability filter) — kept separate from `sharelink/`/`player-profile/` since it's pure aggregation/query, no writes |
| Branding | `modules/branding/` | Small, self-contained (logo + color), no reason to fold into `trainer-roster/` — different data shape, different validation rules (file upload) entirely |
| Camp Conversion | `modules/camp-conversion/` | Stub-only this epic (Epic-08 dependency) — isolated into its own module specifically so it can be deleted or absorbed cleanly once Epic-08 defines the real contract, without unpicking it from a larger module |
| Shared: errors, email, storage | `shared/` | Cross-cutting infrastructure with no business-domain identity — `AppException`/global filter, log-only `EmailService`, `StorageService` (local-disk impl with `sharp` resize) |

**Pattern:** Layered Architecture (Controller → Service → Prisma), consistent across every module
above — no repository layer beyond Prisma itself (this codebase's established convention; a
separate repository layer would be pure indirection over Prisma's own query builder).

**Guard chain:** three global `APP_GUARD`s in fixed order — `JwtAuthGuard` → `RolesGuard` →
`ChildAccountGuard` — plus `ThrottlerGuard` on auth/public endpoints. Order matters:
`RolesGuard` must run after `JwtAuthGuard` (needs `req.user` populated) but before
`ChildAccountGuard` (a role check should reject before a child-specific check ever evaluates,
keeping the two concerns independently testable). `@Public()` exempts a route from
`JwtAuthGuard`; `@BlockChildAccounts()` metadata drives `ChildAccountGuard`.

**Entities and relationships:** see `tasks/TASK-008/brainstorming-design.md`'s Data Model table
for the full field-level listing. Key relationship decisions:
- `User` ↔ `Profile`/`TrainerProfile`/`CoachProfile`/`PlayerProfile`: one-to-one, split into
  separate tables (rather than one wide `User` table) specifically so GDPR deletion is a
  single-row PII null-out on `User`+`Profile`, not a cascading delete across every
  role-specific table.
- `User.parentUserId` self-relation: a child's login is a **real second `User` row**, not a
  flag or client-side mode — this is the load-bearing security boundary `ChildAccountGuard`
  checks against.
- `ShareLink` ↔ `TrainerPlayerAssociation`: one-to-many, nullable FK — an association can exist
  without a ShareLink (manually added by a parent from "My Trainers"), so the relation is
  optional, not required.
- `Availability`: polymorphic via `ownerType` discriminator rather than two separate tables
  (`PlayerAvailability`/`CoachAvailability`) — the shape (day/start/end/isAvailable) is
  identical for both, and a discriminated single table avoids duplicating the summary/filter
  query logic in `AvailabilityService`.

**Transaction boundaries:**

| Scenario | Transaction? | Rationale |
|---|---|---|
| `AuthService.register` | Yes | `User` + `Profile` + `EmailVerificationToken` created together — a partial write (User without Profile) is a genuinely broken state |
| `ShareLink` registration (new user) | Yes | `User` + `PlayerProfile` + `TrainerPlayerAssociation` — same all-or-nothing requirement |
| `UserAdminService.deleteUser` | Yes | Read-original-email-for-backup + anonymize-update + `UserDeletionLog` insert must be atomic, or a crash mid-operation could anonymize without ever logging who/why |
| `ShareLinkService.generateStaticLink`/`generateUniqueLink` | No (retry loop, not a transaction) | The retry-on-`P2002` pattern is deliberately outside a transaction — retrying inside one held-open transaction would hold a lock across retries instead of releasing and re-attempting cleanly |
| `PurchaseApprovalService.approve`/`deny` | No | Single-row status update; no multi-table write to coordinate |
| `AvailabilityService.setAvailability` | Yes | Full-replace semantics (delete existing rows for that owner + insert the new set) needs to be atomic, or a concurrent read could observe a momentarily-empty availability grid |

**Security considerations:**
- [x] Authentication required — JWT on every route except `@Public()`-marked ones (register,
  login, refresh, password-reset request/confirm, email-verify, public coach-profile lookup,
  ShareLink resolution).
- [x] Authorization rules — `@Roles()` + `RolesGuard`; `trainerId` always derived from JWT, never
  a path/body parameter, for every trainer-scoped query.
- [x] Input validation — `class-validator` DTOs on every controller method; custom validators for
  phone format, hex-color format, child age range (1–18).
- [x] Rate limiting — `ThrottlerGuard`, explicit tighter limit on `POST /auth/login` (brute-force).
- [x] Audit logging — `ImpersonationLog` (every session), `UserDeletionLog` (every GDPR delete),
  `CoachAvailabilityOverride` (every conflict override).
- [x] Data encryption — passwords via bcrypt (cost factor 12); tokens (refresh, email-verify,
  password-reset) stored as hashes, not raw values, so a DB read alone can't be replayed.

**Scalability considerations:**
- [x] Database indexing — unique indexes on `User.email`, `ShareLink.code`,
  `CoachProfile.publicSlug`; composite index on `TrainerPlayerAssociation(trainerId,
  playerProfileId)` for the roster-listing query path (NFR-002's 10k-user/<3s target).
- [ ] Caching — not needed at this epic's scale (NFR-005: 1,000 concurrent users); revisit if
  `TrainerRosterService`'s availability-filter query becomes a hot path under Epic-02/03 load.
- [x] Async processing — none required; every workflow (approval expiry, token expiry) uses
  lazy expiry-on-read rather than a background job/queue, matching this problem space's existing
  precedent and avoiding a new infra dependency (a scheduler) for this epic alone.
- [ ] Horizontal scaling — stateless JWT auth + DB-backed refresh tokens support multi-instance
  deployment without sticky sessions; no in-memory session state anywhere in this design.

---

## Next Steps

**Next by flow:** `/api-designer` `[TASK-008 context]` — design the REST API surface (DTOs,
Swagger docs, error-code catalog, Bruno collection) from this architecture.

**Alternatives:**
- `/writing-plans` `[TASK-008 context]` — already exists at
  `tasks/TASK-008/writing-plans-plan.md`; revisit only if this architecture pass changed
  something the plan assumed.
- `/coder` `[TASK-008 context]` — not recommended yet; no formal API design exists.
