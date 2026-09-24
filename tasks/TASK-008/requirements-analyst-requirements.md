# Epic-01: User Management & Authentication — Requirements Analysis

## Overview

Foundational multi-role (Super Admin, Trainer, Coach, Player/Parent) authentication, authorization,
and user-management system. Nothing else in the platform can be built without it: it owns
identity, RBAC, multi-tenant trainer-org scoping, self-service onboarding via ShareLinks, and the
parent/child account model. 14 user stories, 12 in-scope MVP feature groups.

**Note on this analysis**: this document re-derives the requirements independently from the source
spec, per explicit instruction to treat the epic as unanalyzed. It does not assume or reference the
already-implemented `tasks/TASK-001`–`TASK-007` artifacts, `specs/MANIFEST.md`, or the current
codebase — conclusions here may re-tread ground already resolved during actual implementation
(see Gap Analysis for where this independent pass surfaces something the shipped system may already
answer differently).

## Source

`Task/Epics/Epic-01_User_Management_Authentication_SPEC.md` (Epic-01 spec, P0/foundation priority,
12 user stories numbered US-01.01–US-01.14 — two numbers are reused as sub-bullets, not separate
stories — 936 lines).

---

## Functional Requirements

### Core Authentication & Authorization

- **FR-001**: Users register/log in with email + password.
  - Acceptance: unique email enforced at registration; login rejects unknown email/wrong
    password with a generic error (no user-enumeration signal).
  - Priority: High
- **FR-002**: Passwords are stored only as a securely-computed hash, never plaintext.
  - Acceptance: no code path logs, returns, or persists a plaintext password after the request
    completes.
  - Priority: High
- **FR-003**: Email verification gates login (per spec §9 business rules; contradicted by
  Q-01.05 marking this "open" — see Gap Analysis G-1).
  - Acceptance: unverified accounts cannot log in; verification link expires after 24h.
  - Priority: High
- **FR-004**: Password reset flow: request → emailed link → set new password.
  - Acceptance: reset link expires after 1 hour; used/expired links are rejected with a clear
    error; requesting reset for a non-existent email does not reveal account existence.
  - Priority: High
- **FR-005**: Each user has exactly one role (`SUPER_ADMIN`, `TRAINER`, `COACH`, `PLAYER`); after
  login the user lands on the dashboard for their role.
  - Priority: High
- **FR-006**: Session/token issuance, refresh, and logout; sessions expire after a defined
  inactivity window (value is an open question — Q-01.07).
  - Priority: High
- **FR-007**: Login endpoint is rate-limited to prevent brute-force credential attacks.
  - Priority: High

### User Management (Super Admin)

- **FR-008** *(US-01.01)*: Super Admin creates a Trainer account (business name, trainer name,
  email, phone) from the Users tool; system issues a temp password or invite-setup email; new
  trainer forced to reset password on first login; action is audit-logged.
  - Priority: High
- **FR-009**: Users tool provides a global, paginated user directory with tool-specific search
  (not a platform-wide search).
  - Priority: High
- **FR-010**: Super Admin edits any user account's profile fields.
  - Priority: Medium
- **FR-011** *(US-01.12)*: Super Admin deactivates a user (soft delete): login blocked, all
  historical records (attendance, payments, referrals, CRM entries) preserved and visible,
  marked "Inactive."
  - Priority: High
- **FR-012**: Super Admin reactivates a previously-deactivated user, restoring login.
  - Priority: Medium
- **FR-013** *(US-01.13)*: Super Admin permanently deletes a user for GDPR compliance: PII fields
  anonymized (name → "Deleted User", email → `deleted_[id]@example.com`, phone/photo/identifiers
  cleared), historical records retained under the anonymized identity, analytics totals
  unaffected, action is permanent and logged (who/when/why).
  - Priority: High
- **FR-014** *(US-01.07)*: Super Admin impersonates any user except another Super Admin; a
  persistent, color-coded banner indicates impersonation mode with an explicit exit; session
  auto-expires after 1 hour; every impersonation is logged (admin, target, start, end, duration).
  - Priority: High

### ShareLink / Invitation System

- **FR-015**: Trainer generates a **static** player ShareLink: unlimited uses, no expiry, tied to
  the issuing trainer.
  - Priority: High
- **FR-016** *(US-01.08)*: Trainer invites a coach via a **unique** ShareLink: single use, 7-day
  expiry, targets a specific email; trainer can view invitation status (Pending/Accepted/Expired)
  and resend on expiry.
  - Priority: High
- **FR-017**: Registering via a ShareLink resolves two cases distinctly: brand-new user (create
  account + profile + association) vs. already-logged-in existing user (instant association, no
  duplicate account).
  - Priority: High
- **FR-018**: Expired or exhausted ShareLinks are rejected with a clear, actionable error.
  - Priority: Medium
- **FR-019**: Coach acceptance of an invite enforces the single-trainer constraint: a coach
  already active under a different trainer cannot accept a second invite (clear error, no silent
  overwrite).
  - Priority: High

### Player/Parent Features

- **FR-020** *(US-01.02)*: Player/Parent registers via a trainer's ShareLink (name, email,
  password, phone, player name/age/gender); auto-associated with the sending trainer; confirmation
  email sent; player can immediately see that trainer's events/content.
  - Priority: High
- **FR-021**: An existing account clicking a **second** trainer's ShareLink gets a new
  association only (no duplicate account); if the account is a parent with children, the system
  prompts "who will train with [Trainer]?" with a checklist of the parent + each child, and only
  checked family members are associated.
  - Priority: High
- **FR-022**: Multi-trainer players get fully **separated views**: a context switcher (e.g.
  dropdown) swaps between trainer contexts, each showing isolated calendar/tokens/content/
  reservations — never a combined/unified view. Current context persists across the session.
  - Priority: High
- **FR-023** *(US-01.03)*: Parent creates a child profile (name, age 1–18, gender, optional
  school/photo) marked "Child"; if the parent has exactly one trainer, prompt Yes/No to associate;
  if multiple trainers, show a selection checklist; declining leaves the child profile
  trainer-less until later association. Duplicate-name/age combos trigger a warning, not a block.
  - Priority: High
- **FR-024** *(US-01.04)*: Parent adds/removes a child's trainer associations from a
  Family/Player-Profiles view (per child: name, age, associated trainers + dates); add via
  manual ShareLink entry or picking from "My Trainers"; remove requires confirming that upcoming
  RSVPs will be cancelled, and soft-deletes that child's data under the removed trainer (history
  preserved, trainer no longer sees the child in their roster).
  - Priority: High
- **FR-025** *(US-01.05)*: Child purchase approval workflow:
  - USD payments always require parent approval (pending → notify parent by email + in-app →
    parent approves/denies/requests-more-info → child sees status change).
  - Token spending defaults to requiring the same approval, but the parent can toggle
    "allow token spending without approval" **per child**; when enabled, token purchases process
    immediately with an informational (non-approval) parent notification.
  - Unactioned requests auto-expire (deny + notify) after 48 hours.
  - Priority: High
- **FR-026** *(US-01.06)*: Child accounts log in with materially reduced permissions:
  - Allowed: browse/RSVP/cancel-RSVP (approval-gated) events, view purchased content, view own
    progress, submit feedback requests, edit basic profile info, view (not spend) tokens, switch
    between the child's own trainer contexts.
  - Blocked: adding new trainers, adding/removing payment methods, purchasing tokens, completing
    purchases without approval, deleting the account, changing trainer associations, viewing the
    parent's own training data.
  - A child clicking a new trainer's ShareLink is blocked ("ask your parent to register you") and
    triggers a parent-notification email with a CTA to complete registration on the child's behalf;
    the child is **not** associated until the parent acts.
  - A child's context switcher (if multi-trainer) lists only the child's own trainer contexts,
    with no "Me" section.
  - Priority: High
- **FR-027** *(US-01.09)*: Player/Parent sets "Best Times" availability (day-of-week ×
  time-range grid or toggle-per-day); parents set it **per child** via the profile switcher;
  saved with a confirmation message. Trainers can view an availability summary/indicator per
  player and filter "available at [day/time]" when planning.
  - Priority: Medium
- **FR-028**: Camp-to-user conversion: after a camp/evaluation form submission, prompt to create
  an account with the form pre-filled (no re-entry), auto-assigning the resulting account to the
  submitting trainer; alternative path sends a ShareLink by email for later registration.
  - Priority: Medium — **blocked**: depends on Epic-08's camp/evaluation-form entity, which does
    not yet exist (see Gap Analysis G-2).

### Coach Features

- **FR-029** *(US-01.10)*: Coach sets recurring weekly "My Times" availability, including
  multiple time ranges per day.
  - Priority: Medium
- **FR-030**: When a trainer assigns a coach to a time conflicting with their stated
  availability, the system warns and requires a **text reason** to override; the override is
  logged (event, coach, trainer, reason, timestamp); the coach sees the assignment (not blocked)
  and can accept or request a change.
  - Priority: Medium — the trigger side (assigning to an "event") depends on Epic-02's `Event`
    entity (see Gap Analysis G-3); the conflict-check/override primitive itself does not.
- **FR-031**: Coach manages a public profile: bio, credentials, certifications, and a
  visibility toggle.
  - Priority: Medium

### Trainer Features

- **FR-032**: Trainer sees per-player availability indicators/summaries and can filter by
  day/time when planning sessions (consumes FR-027's data).
  - Priority: Medium
- **FR-033**: Trainer assigns coaches to events, gated by the availability-conflict check
  (FR-030).
  - Priority: Medium — same Epic-02 `Event` dependency as FR-030.
- **FR-034**: Trainer manages (views/edits) only their own organization's players and coaches;
  no visibility into other trainers' rosters.
  - Priority: High
- **FR-035** *(US-01.14)*: Trainer customizes portal branding: logo upload (image file, max
  2MB, previewed before save) and a primary brand color (hex, live preview, reset-to-default);
  changes apply immediately and are visible to all of that trainer's players/coaches/parents.
  - Priority: Low

### Profile Management (All Roles)

- **FR-036** *(US-01.11)*: Every user edits their own profile: common fields (name, phone, photo,
  optional school/bio/jersey-number) plus role-specific fields (Player: school/jersey/photo;
  Parent: emergency contact; Coach: bio/credentials/certifications/public-profile toggle;
  Trainer: business name/org details; Super Admin: admin-specific settings). Email, role, skill
  level (player), and account-created date are read-only from this screen.
  - Priority: Medium

---

## Non-Functional Requirements

- **NFR-001**: Dashboard load time < 2 seconds.
- **NFR-002**: User list scales to 10,000 users, loading < 3 seconds with pagination.
- **NFR-003**: Profile save completes < 1 second.
- **NFR-004**: ShareLink registration completes < 2 seconds, and tolerates 100 concurrent
  registrants.
- **NFR-005**: Platform supports 1,000 concurrent users overall.
- **NFR-006**: WCAG 2.1 AA compliance — keyboard navigation, screen-reader support, color
  contrast, visible focus indicators, across all forms introduced by this epic.
- **NFR-007**: Responsive, touch-friendly UI; mobile-optimized forms and file uploads.
- **NFR-008**: CSRF protection on all state-changing endpoints.
- **NFR-009**: Fixed token/session lifetimes: email verification link 24h, password-reset link
  1h, impersonation session 1h (session/access-token lifetime itself is Q-01.07, still open).
- **NFR-010**: Session tokens resist theft/XSS (secure, httpOnly-class handling — spec leaves the
  concrete mechanism to the implementation team).

---

## Business Rules

- **BR-001**: Email is unique across all users platform-wide.
- **BR-002**: A user has exactly one role; permissions are enforced on both frontend and backend.
- **BR-003**: Trainers see/manage only their own organization's data (application-level
  multi-tenancy).
- **BR-004**: A player/parent may be associated with multiple trainers simultaneously; a coach
  may be active under exactly **one** trainer at a time — strictly enforced, no exceptions.
- **BR-005**: Only a Super Admin can create a Trainer account; there is no trainer
  self-registration.
- **BR-006**: A ShareLink registration for an account that already exists creates a new
  association only, never a duplicate account.
- **BR-007**: All players under 18 require a parent-managed account — no independent account for
  a minor at any age (this directly resolves the "16–18 independent login?" half of Q-01.05/open
  question framing — see Gap Analysis G-1 for the residual ambiguity that remains open).
- **BR-008**: A child account can never self-serve a trainer association, payment-method change,
  token purchase, or account deletion; every such action funnels to the parent.
- **BR-009**: USD child purchases always require parent approval; token purchases require it by
  default, overridable per child by the parent.
- **BR-010**: Unactioned child-purchase approval requests auto-expire (auto-deny + notify) at 48
  hours.
- **BR-011**: A Super Admin can impersonate anyone except another Super Admin; impersonation is
  always logged and always visually indicated; sessions self-expire at 1 hour.
- **BR-012**: Deactivation (soft delete) never removes data — it only blocks login; deletion (GDPR)
  irreversibly anonymizes PII while preserving anonymized historical records and unaffected
  analytics totals.
- **BR-013**: Coach-assignment conflicts with stated availability must be overridden with a
  required, logged reason; the coach is informed, never silently blocked.
- **BR-014**: ShareLink usage (which link, by whom, when) is tracked for later analytics
  (Epic-06 dependency, output-only from this epic).
- **BR-015**: Validation is required platform-wide: valid email/phone formats, required
  name/email fields, child age 1–18, no duplicate emails, unique ShareLink codes.

---

## Task Breakdown

### Entities

| Entity | Key Properties | Relations |
|---|---|---|
| `User` | email (unique), passwordHash, role, status, emailVerified, lastLoginAt, timestamps | 1:1 `Profile`; 1:1 optional `TrainerProfile`/`CoachProfile`; 1:many `RefreshToken` |
| `RefreshToken` | token hash, userId, expiresAt, revoked | belongs to `User` |
| `EmailVerificationToken` | token, userId, expiresAt (24h) | belongs to `User` |
| `PasswordResetToken` | token, userId, expiresAt (1h), used | belongs to `User` |
| `Profile` | firstName, lastName, phone, photoUrl, school | belongs to `User` |
| `TrainerProfile` | businessName, address, website, description | belongs to `User` |
| `Branding` | logoUrl, primaryColorHex | belongs to `TrainerProfile`/trainer `User` |
| `CoachProfile` | trainerId, bio, credentials, certifications, publicVisible, joinedAt | belongs to `User`; belongs to one `Trainer` |
| `PlayerProfile` | displayName, birthDate/age, gender, skillLevel, school, jerseyNumber, isChild, parentUserId, emergencyContact | belongs to `User` (self) or parent `User` (child); many `TrainerPlayerAssociation` |
| `TrainerPlayerAssociation` | trainerId, playerProfileId, shareLinkId, connectedAt, status | joins `Trainer` ↔ `PlayerProfile` |
| `ShareLink` | code (unique), type (STATIC/UNIQUE), trainerId, createdBy, targetEmail, expiresAt, maxUses, useCount, active | belongs to `Trainer`; referenced by association/registration records |
| `Availability` | ownerType (COACH/PLAYER), ownerId, dayOfWeek, startTime, endTime, isAvailable | belongs to a Coach or Player profile |
| `CoachAvailabilityOverride` | eventId, coachId, trainerId, reason, timestamp | references `CoachProfile`, `Trainer`, (future) `Event` |
| `ImpersonationLog` | adminId, targetUserId, startedAt, endedAt, durationSeconds | references two `User`s |
| `ChildPurchaseApproval` | childProfileId, parentUserId, eventOrPurchaseRef, amount, paymentType, status, requestedAt, respondedAt, expiresAt, parentNotes | references `PlayerProfile` (child), `User` (parent) |
| `UserDeletionLog` | originalUserId, originalEmailBackup, deletedBy, reason, deletedAt | references `User` |

### Services

| Service | Purpose | Key Methods |
|---|---|---|
| `AuthService` | Registration, login, logout, token refresh | `register`, `login`, `logout`, `refreshTokens`, `verifyEmail`, `requestPasswordReset`, `resetPassword` |
| `UserAdminService` | Super-Admin user CRUD/lifecycle | `createTrainer`, `listUsers`, `editUser`, `deactivateUser`, `reactivateUser`, `deleteUser` |
| `ImpersonationService` | Impersonation session lifecycle + audit | `startImpersonation`, `exitImpersonation`, `getAuditHistory` |
| `ProfileService` | Self-service profile edits + photo upload | `getOwnProfile`, `updateOwnProfile`, `uploadPhoto` |
| `ShareLinkService` | Link generation/resolution/lifecycle | `generateStaticLink`, `generateUniqueLink` (coach invite), `resolveByCode`, `rotateStaticLink`, `resendInvite` |
| `PlayerRegistrationService` | ShareLink-driven registration | `registerNewViaLink`, `associateExistingViaLink` (incl. family-selection branch) |
| `PlayerProfileService` | Player/child profile CRUD | `createSelfProfile`, `createChildProfile`, `listFamilyProfiles` |
| `TrainerAssociationService` | Child-trainer association management | `addChildToTrainer`, `removeChildFromTrainer` |
| `ChildAccountService` | Child-account constraints + ShareLink blocking | `provisionChildLogin`, `handleChildShareLinkClick` |
| `PurchaseApprovalService` | Approval workflow for child spend | `createApprovalRequest`, `approve`, `deny`, `expireStale` |
| `AvailabilityService` | Player/coach availability CRUD + summaries | `setAvailability`, `getAvailabilitySummary`, `filterByAvailability` |
| `CoachAvailabilityOverrideService` | Conflict detection + override logging | `checkConflict`, `recordOverride` |
| `CoachProfileService` | Public/bio profile management | `updatePublicProfile`, `getPublicProfile` |
| `TrainerRosterService` | Trainer-side roster + availability views | `listOwnPlayers`, `listOwnCoaches` |
| `BrandingService` | Portal branding | `uploadLogo`, `setPrimaryColor`, `getBranding` |

### Controllers

| Controller | Representative Endpoints | Purpose |
|---|---|---|
| `AuthController` | `POST /auth/register`, `/login`, `/logout`, `/refresh`, `/verify-email`, `/password-reset/*` | Authentication lifecycle |
| `UserAdminController` | `POST /admin/users` (create trainer), `GET /admin/users`, `PATCH /admin/users/:id`, `POST /admin/users/:id/deactivate`, `/reactivate`, `/delete` | Super-Admin user management |
| `ImpersonationController` | `POST /admin/impersonation/:userId/start`, `POST /admin/impersonation/exit`, `GET /admin/impersonation/history` | Impersonation |
| `ProfileController` | `GET /profile/me`, `PATCH /profile/me`, `POST /profile/me/photo` | Self-service profile |
| `ShareLinkController` | `POST /sharelinks/static`, `POST /sharelinks/coach-invite`, `GET /join/:code`, `POST /join/:code/register` | Invitation system |
| `PlayerProfileController` | `GET /players`, `POST /players/child`, `POST /players/:id/trainers`, `DELETE /players/:id/trainers/:trainerId` | Family/roster management |
| `PurchaseApprovalController` | `GET /purchase-approvals`, `POST /purchase-approvals/:id/approve`, `/deny` | Child-purchase approvals |
| `AvailabilityController` | `GET/PUT /availability/me`, `GET /availability/player/:id` (trainer view) | Best Times / My Times |
| `CoachController` | `PUT /coach/profile`, `GET /coach/public/:slug`, `POST /coach/:id/override-check` | Coach profile + conflict check |
| `TrainerRosterController` | `GET /trainer/roster`, `GET /trainer/players/availability` | Trainer planning views |
| `BrandingController` | `GET/PUT /trainer/branding` | Portal branding |

### Frontend

| Area | Components / Pages | State / API Integration |
|---|---|---|
| Auth | Login, Register (incl. player/parent+child variant), Forgot/Reset Password, Verify-Email landing | `api/endpoints/auth.ts`; redirect-by-role after login |
| Super Admin | Users list (search/filter/paginate), Create-User modal, Impersonation confirm modal + sticky banner, Deactivate/Delete confirm modals, Impersonation-history report | `api/endpoints/admin-users.ts`, `admin-impersonation.ts` |
| Player/Parent | Player Profiles list, Add-Child modal, Family/Trainer-associations panel, Context switcher ("Me"/children ↔ trainer dropdown), Pending-approvals list, Best Times grid | `api/endpoints/player-profiles.ts`, `purchase-approvals.ts`, `availability.ts` |
| Coach | My Times grid, Public-profile editor | `api/endpoints/coach.ts` |
| Trainer | ShareLink-generation modal, Invite-status list, Roster/availability planning view, Branding settings page | `api/endpoints/sharelinks.ts`, `trainer-roster.ts`, `branding.ts` |
| Shared | Profile edit (role-aware field set), Join/ShareLink landing page | `api/endpoints/profile.ts` |

### Testing Tasks

- **Unit**: every service above (happy path + each documented error branch: duplicate email,
  expired/exhausted ShareLink, non-Super-Admin impersonation target, coach dual-trainer
  conflict, child-blocked actions, approval-expiry).
- **Integration/E2E**: full registration-via-ShareLink flow (new + existing account, single- and
  multi-trainer family-selection branches); child-purchase-approval lifecycle end to end;
  Super-Admin create → impersonate → exit; coach invite → accept → single-trainer-conflict
  rejection; deactivate/reactivate and delete/anonymize preserving historical joins; coach
  availability-conflict override flow.
- **Security**: cross-trainer data isolation (a Trainer/Coach/Player token can never read another
  trainer's records), child-session route blocking (server-side, not just hidden UI), Super-Admin
  self/nested-impersonation rejection, rate-limit enforcement on login, anonymization
  completeness after delete.
- **Performance**: 10k-row user list pagination, 100-concurrent-registration ShareLink load.
- **Accessibility**: keyboard-only pass and screen-reader pass on every new form (registration,
  child-profile, availability grids, branding).

---

## Validation Checklist

- [x] All 12 in-scope MVP feature groups mapped to FRs (FR-001–FR-036).
- [x] Happy path covered for every user story (US-01.01–US-01.14).
- [x] Error/edge cases identified: duplicate email, expired/used tokens, exhausted ShareLinks,
      dual-trainer coach conflict, self/nested impersonation, expired approval requests, no-op
      deactivation-of-deleted-user.
- [x] Security requirements addressed: RBAC, multi-tenancy isolation, child-account boundary,
      impersonation restrictions and audit, GDPR anonymization.
- [x] Performance requirements captured (NFR-001–005).
- [x] Testing strategy defined per layer (unit/integration/e2e/security/performance/a11y).
- [ ] Six items remain genuinely unresolved by the source spec itself — see Gap Analysis.

---

## Gap Analysis

- **G-1 (Q-01.05, conflicting)**: The spec's own Business Rules section (§9) states unverified
  users cannot log in, and the Epic-Level Acceptance Criteria (§10.i) list "email verification
  sends and processes correctly" as a completion gate — yet §12's open-questions table still
  marks "Email verification: Required before login or optional?" as **Open, P1**. These two parts
  of the same document disagree. Needs an explicit client decision to close, even though FR-003
  above defaults to "required" per the stronger textual signal.
- **G-2 (Epic-08 dependency)**: FR-028 (Camp-to-User Conversion) requires a camp/evaluation-form
  submission entity that belongs to Epic-08, which is not in scope here and (per the epic
  dependency table) isn't built yet. This requirement cannot be implemented as a vertical slice
  of Epic-01 alone — it needs either a stub/interface contract agreed with Epic-08, or explicit
  descoping to "ShareLink-by-email" only (the spec's own documented fallback) until Epic-08 lands.
- **G-3 (Epic-02 dependency)**: FR-030/FR-033 (coach-assignment conflict warning + override, and
  "assign coaches to events") are triggered by assigning a coach to an **event**, an entity owned
  by Epic-02 (Event Management), explicitly listed as depending on this epic, not the reverse.
  The conflict-check/override *primitive* (given a coach id + a candidate time range) can be built
  now; the actual trigger point (an event-assignment UI/endpoint) cannot exist until Epic-02 ships
  its `Event` entity.
- **G-4 (Q-01.07, session timeout)**: No default is specified anywhere in the spec — "1 day, 7
  days, 30 days?" is posed as an open client question with no fallback stated. Blocks a concrete
  NFR-009 value for the access/session token itself (the three *other* expiries — email-verify,
  password-reset, impersonation — do have spec-stated defaults).
- **G-5 (Branding logo file types, internal inconsistency)**: US-01.14's "Logo Upload" bullet says
  "PNG, JPG, max 2MB"; three lines later its own "Validation" sub-list says "Logo file type: PNG,
  JPG, SVG." The spec disagrees with itself on whether SVG is an accepted upload type. Needs a
  single authoritative answer before FR-035 can be fully specified (SVG carries XSS/script-payload
  risk that PNG/JPG don't, which is likely why one part of the spec excludes it — worth
  surfacing to the client rather than silently picking one).
- **G-6 (Q-01.01/Q-01.02, taxonomy definitions)**: Skill-level values (Beginner/Intermediate/
  Advanced/Elite/custom?) and age-group definitions (birth year vs. age range vs. grade level) are
  both open, client-owned, P2 questions that gate the exact shape of `PlayerProfile.skillLevel`
  and any age-bucketed reporting. Low implementation risk (can ship as a free-form enum/string and
  tighten later) but should be flagged, not silently assumed.
- **G-7 (Q-01.04, notification inventory)**: "What automated emails are required?" (welcome,
  password reset, invite, others?) is open, P1. Several FRs above (FR-001 confirmation email,
  FR-004 reset link, FR-016 invite email, FR-023/FR-025 parent notifications) already imply a
  minimum required set; this question is really asking whether there's a *complete* list beyond
  what's individually specified per user story — worth a single consolidated answer rather than
  inferring it piecemeal across seven different stories.
- **G-8 (Q-01.06, override notification)**: Whether a coach is notified when a trainer overrides
  an availability conflict is open, P2. FR-030 only requires the coach *see* the resulting
  assignment (no blocking) — a proactive notification is a separate, currently-unspecified
  behavior.
- **G-9 (document hygiene, not a requirement gap)**: The source spec has two sections numbered
  "10." (User Flows, then Acceptance Criteria) and two numbered "12." (Questions/Open Issues, then
  Testing Considerations). Purely cosmetic, but worth a note back to whoever maintains the source
  doc since it makes cross-referencing by section number unreliable.

---

## Next Steps (Suggested)

**Immediate blockers to close before implementation planning:**
1. Get client answers to G-1, G-4, G-5, G-7 (P1/P0-adjacent — they change concrete field/endpoint
   behavior, not just cosmetic detail).
2. Agree the Epic-08 integration contract for G-2, or explicitly descope FR-028 to
   "ShareLink-by-email only" for this epic's MVP.
3. Confirm the G-3 split (build the conflict/override primitive now; defer the event-assignment
   trigger point to land alongside Epic-02) is acceptable, so FR-030/FR-033 aren't blocked
   entirely.

**Not part of this analysis**: G-6 and G-8/G-9 are low-risk enough to default and revisit later
without blocking a design pass.

---

**Next by flow:** `/brainstorm` `[TASK-008 context]` — resolve G-1 through G-5 (the ones with real
design-shape impact) through collaborative dialogue before locking architecture.

**Alternatives:**
- `/architect` `[TASK-008 context]` — skip brainstorming only if the gaps above are considered
  acceptable to default without discussion (not recommended given G-1/G-2/G-3/G-5 each change
  concrete behavior).
- `/writing-plans` `[TASK-008 context]` — not recommended yet; no architecture or API design
  exists for this independent pass.
