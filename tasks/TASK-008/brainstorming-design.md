# Epic-01: User Management & Authentication — Design

> Companion to `tasks/TASK-008/requirements-analyst-requirements.md`. Produced as an independent
> design pass over the Epic-01 spec, per explicit instruction to treat it as unanalyzed rather
> than referencing the already-implemented `TASK-001`–`TASK-007` artifacts. Delivery shape:
> **one holistic design, single implementation pass** (not sliced into delivery increments),
> per explicit user choice.

## Problem Statement

The platform needs identity, RBAC, and multi-tenant scoping before any other epic can function.
Four roles (Super Admin, Trainer, Coach, Player/Parent) have materially different permissions;
trainer organizations must never see each other's data; the parent/child account relationship is
a real security boundary (a child's own login), not a UI-level "acting as" mode.

## Decisions Locked This Session

- **G-1 (email verification)**: **Required before login.** Matches the spec's business-rules
  text and epic-level completion gate over the still-open questions-table entry.
- **G-5 (branding logo formats)**: **PNG/JPG only, SVG rejected.** Inline SVG rendered in a
  header shared across an entire trainer's org carries a stored-XSS risk (`<script>`/event
  handlers) that raster formats don't.
- **G-2 (Camp-to-User Conversion / Epic-08 dependency)**: **Build a stub integration point now.**
  A `CampConversionService.createPrefillDraft()`-shaped contract that Epic-08 can call into once
  its evaluation-form entity exists, even though nothing produces real input for it yet.
- **G-3 (coach-conflict override / Epic-02 dependency)**: **Build the conflict-check primitive
  plus a stub controller/UI.** A "check availability for coach X at time Y" endpoint and a
  minimal trainer-facing check, ahead of Epic-02's real `Event` entity landing.
- **G-4 (session TTL)**: **15-minute JWT access token + 7-day sliding, DB-backed, revocable
  refresh token.**
- **Email sending**: **log-only `EmailService` stub**, matching the real codebase's existing
  precedent — a pluggable interface, no live provider wired in this pass.
- **Deferred, non-blocking** (G-6, G-7, G-8): skill-level/age-group taxonomy ships as a free-form
  string/enum; the automated-email set is exactly what's listed per user story below (no broader
  inventory exists yet); coaches are not proactively notified when a trainer overrides a conflict
  (they only see the resulting assignment).

## Architecture

- **Backend**: NestJS, one module per domain, Controller → Service → Prisma:
  `auth/`, `users/` (admin CRUD + lifecycle), `profile/`, `impersonation/`, `sharelink/` (+
  `coach-invite` sibling), `player-profile/` (folds `PlayerProfileService` /
  `TrainerAssociationService` / `ChildAccountService` as siblings — mirrors this repo's existing
  module-folding convention for closely-related concerns within one domain),
  `purchase-approval/`, `availability/` (shared by player "Best Times" and coach "My Times"),
  `coach-profile/`, `trainer-roster/`, `branding/`, `camp-conversion/` (stub only).
- **Guards**: three global `APP_GUARD`s in order — `JwtAuthGuard` → `RolesGuard` →
  `ChildAccountGuard` — plus `ThrottlerGuard` on auth/public endpoints. `@Public()` opts a route
  out of JWT auth; `@BlockChildAccounts()` metadata drives `ChildAccountGuard`.
- **Multi-tenancy**: application-level `trainerId` scoping. Every trainer-scoped endpoint derives
  `trainerId` from the JWT, never a path or body parameter.
- **Child accounts**: a child's own login is a genuine second `User` row (`parentUserId` set),
  linked to its `PlayerProfile` via a child-user reference — a JWT-level security boundary.
- **Frontend**: React + Vite + Tailwind. `pages/<role>/` groups role-specific pages,
  `api/endpoints/*.ts` one file per backend module, plain `useState`/`useEffect` — no
  state-management library, per this repo's established convention.

## Data Model

| Entity | Key Fields | Notes |
|---|---|---|
| `User` | email (unique), passwordHash (bcrypt), role, status (`ACTIVE/INACTIVE/DELETED`), emailVerified, lastLoginAt | Split from `Profile`/`TrainerProfile` so GDPR delete is a single-row PII null-out, not a cascade |
| `Profile` | firstName, lastName, phone, photoUrl, school | 1:1 with `User` |
| `TrainerProfile` | businessName, address, website, description | 1:1 with `User`; owns `Branding` |
| `Branding` | logoUrl, primaryColorHex | PNG/JPG only (G-5) |
| `CoachProfile` | trainerId, bio, credentials, certifications, publicVisible | One trainer only, strictly enforced |
| `PlayerProfile` | displayName, birthDate, gender, skillLevel, school, jerseyNumber, isChild, parentUserId, emergencyContact, tokenAutoApprove | `tokenAutoApprove` is a standing per-child setting, not per-request |
| `RefreshToken` | tokenHash, userId, expiresAt, revoked | 7-day sliding (G-4) |
| `EmailVerificationToken` | token, userId, expiresAt (24h) | |
| `PasswordResetToken` | token, userId, expiresAt (1h), used | |
| `ShareLink` | code (unique), type (STATIC/UNIQUE), trainerId, createdBy, targetEmail, expiresAt, maxUses, useCount, active | STATIC: unlimited/no expiry. UNIQUE: single-use/7-day |
| `TrainerPlayerAssociation` | trainerId, playerProfileId, shareLinkId, connectedAt, status | Join table; no duplicate accounts on re-registration |
| `Availability` | ownerType (COACH/PLAYER), ownerId, dayOfWeek, startTime, endTime, isAvailable | Shared shape for Best Times + My Times |
| `CoachAvailabilityOverride` | eventId (nullable/stub until Epic-02), coachId, trainerId, reason, timestamp | Reason required |
| `ImpersonationLog` | adminId, targetUserId, startedAt, endedAt, durationSeconds | 1h cap |
| `ChildPurchaseApproval` | childProfileId, parentUserId, eventOrPurchaseRef, amount, paymentType, status, requestedAt, respondedAt, expiresAt, parentNotes | 48h auto-expire |
| `UserDeletionLog` | originalUserId, originalEmailBackup, deletedBy, reason, deletedAt | Compliance audit trail |

GDPR delete anonymizes `User`/`Profile` fields in place (name → "Deleted User", email →
`deleted_[id]@example.com`) so every historical foreign key (attendance, payments, associations)
keeps resolving without a cascading delete.

## API Design (representative surface)

- `POST /auth/register|login|logout|refresh`, `/auth/verify-email`,
  `/auth/password-reset/request|confirm`
- `POST /admin/users` (create trainer), `GET /admin/users` (paginated + tool-specific search),
  `PATCH /admin/users/:id`, `POST /admin/users/:id/deactivate|reactivate|delete`
- `POST /admin/impersonation/:userId/start`, `POST /admin/impersonation/exit`,
  `GET /admin/impersonation/history`
- `GET/PATCH /profile/me`, `POST /profile/me/photo`
- `POST /sharelinks/static`, `POST /sharelinks/coach-invite`, `GET /join/:code`,
  `POST /join/:code/register`
- `GET /players`, `POST /players/child`, `POST /players/:id/trainers`,
  `DELETE /players/:id/trainers/:trainerId`
- `GET /purchase-approvals`, `POST /purchase-approvals/:id/approve|deny`
- `GET/PUT /availability/me`, `GET /availability/player/:id` (trainer view)
- `PUT /coach/profile`, `GET /coach/public/:slug` (uniform 404, anti-enumeration),
  `POST /coach/:id/conflict-check` (stub, Epic-02 dependency, G-3)
- `GET/PUT /trainer/branding`, `GET /trainer/roster`
- `POST /camp-conversion/draft` (stub, Epic-08 dependency, G-2 — accepts a generic prefill
  payload, returns a registration-draft token)

Every error uses `AppException` + `errorCode`, handled by a single global `AppExceptionFilter`,
per this repo's existing convention.

## Error Handling

Domain-specific `AppException` subclasses per module (e.g. `DuplicateEmailException`,
`ShareLinkExpiredException`, `CoachAlreadyActiveElsewhereException`,
`ChildAccountRestrictedException`, `CannotImpersonateSuperAdminException`) — never a bare
`HttpException` or an empty catch. Race-prone unique-generation (ShareLink codes, coach public
slugs) uses retry-on-`P2002`, not check-then-insert, per this repo's established pattern.
Child-account restrictions and self/nested-impersonation guards are enforced server-side via
guards, never trusted from frontend state alone.

## Testing Strategy

- **Unit** (mocked Prisma): every service's happy path + each documented error branch.
- **E2E** (real Postgres): full ShareLink registration (new account, existing-account
  reassociation, multi-trainer family-selection branch), child-purchase-approval lifecycle,
  admin create→impersonate→exit, coach invite→accept→dual-trainer rejection,
  deactivate/reactivate and delete/anonymize preserving historical joins, coach conflict-check
  stub.
- **Security**: cross-trainer data isolation, child-session route blocking enforced at the API
  level (not just hidden UI), rate-limit enforcement on login, anonymization completeness after
  delete, self/nested-impersonation rejection.
- **Known gotcha to design around**: mint tokens via `TokenService.issuePair()` directly in
  multi-user e2e specs rather than looping real `POST /auth/login` calls, to avoid tripping the
  IP-keyed 5-per-60s login throttle.
- **Performance**: 10k-row user list pagination; 100-concurrent-registration ShareLink load.
- **Accessibility**: keyboard-only + screen-reader pass on every new form (registration,
  child-profile, availability grids, branding).

## Security Considerations

- RBAC enforced by both `RolesGuard` (backend) and role-aware routing (frontend) — never
  frontend-only.
- Multi-tenancy is `trainerId`-scoped at the query level, always derived from the JWT.
- Impersonation capped at 1 hour via `TokenService.issuePair({ impersonatedBy })`, handed off via
  a **second, dedicated cookie** so the admin's own session is never overwritten; every session
  logged (admin, target, start, end, duration); Super Admins can never be impersonation targets.
- GDPR delete is irreversible, anonymizes PII in place, and is logged for compliance.
- Passwords bcrypt-hashed; CSRF protection and `ThrottlerGuard` on auth/public endpoints.
- Branding logo uploads reject SVG (G-5) to avoid inline stored-XSS in an org-wide-shared header.

## Open Questions (deferred, non-blocking per this session)

- **G-6**: Skill-level and age-group taxonomy (Q-01.01/Q-01.02) — ship as free-form string/enum
  now, tighten once the client answers.
- **G-7**: Whether a complete automated-email inventory exists beyond what's individually
  specified per user story (Q-01.04) — the per-story list in this doc is the working set.
- **G-8**: Whether a coach is proactively notified when a trainer overrides an availability
  conflict (Q-01.06) — not built this pass; the coach only sees the resulting assignment.
- **G-9**: Source spec has duplicate section numbers ("10." and "12." each used twice) — a
  documentation hygiene note for whoever maintains the source doc, not a design gap.

---

## Next Steps

**Next by flow:** `/writing-plans` `[TASK-008 context]` — create detailed implementation tasks
from this design.

**Alternatives:**
- `/architect` `[TASK-008 context]` — review architecture implications before creating the plan.
- `/api-designer` `[TASK-008 context]` — formalize the API surface (DTOs, Swagger, error-code
  catalog) ahead of planning.
