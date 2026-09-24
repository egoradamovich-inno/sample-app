# TASK-008 Frontend Design — Epic-01: User Management & Authentication

> Kept isolated from `specs/frontend-design-spec.md` for the same reason as the architecture and
> API design docs: that file (on `feature/epic-01-user-mgmt`) is the real, shipped design system
> and component library. Per explicit choice, this pass **reuses "Field House Ledger" verbatim**
> — the design tokens, motion strategy, and layout approach below are copied exactly from the
> real system (confirmed via `git show feature/epic-01-user-mgmt:specs/frontend-design-spec.md`),
> not reinvented — because it's the real intended brand identity for this product, not an
> implementation detail specific to the shipped code. Component-level specs below are written
> fresh for TASK-008's holistic scope (all 14 user stories in one pass), reusing the same tokens/
> motifs/naming conventions the real system established.

## Aesthetic Direction: "Field House Ledger" (reused)

A youth-sports training platform lives between two worlds: the **operator's back office** (Super
Admin managing a roster of trainers/coaches/players — needs density, precision, scanability) and
the **team's front door** (a trainer, coach, or family opening an invite link for the first time —
needs warmth and confidence). This direction commits to one coherent material — a **coach's
roster ledger / scorebook** — and lets density vary by context instead of switching aesthetics:
admin surfaces read like an open scorebook (numbered rows, hairline rules, ink-stamp badges);
human-facing surfaces (registration, family management, profile) use the same type system and
palette with generous air.

**Memorable element:** the **Roster Stamp** — every state-changing action (create, deactivate,
reactivate, delete, approve/deny, association add/remove) resolves with a rotated ink-stamp badge
animation, like a coach physically stamping a roster sheet. Status badges are ink stamps, not
default pill badges. A second signature motif carries the parent/child context-switching UI: the
**Locker Nameplate Flip** — switching context animates like flipping a nameplate in a locker
room, reinforcing "this is a different person/team's data," never a generic dropdown-swap feel.

## Design Tokens (reused verbatim)

### Typography

| Role | Font | Notes |
|---|---|---|
| Display (titles, headers, big numbers) | **Big Shoulders Display** (condensed, variable weight) | All-caps, tight tracking; scoreboard/jersey feel. Never body copy. |
| Body / UI | **Archivo** (400–700) | All functional UI text. |
| Data / mono | **IBM Plex Mono** (400, 500) | IDs, emails, timestamps, ShareLink codes, availability-summary strings. |

Explicitly avoided: Inter, Roboto, Arial, system-ui, Space Grotesk.

```
text-display-xl: 3.5rem / 1.0   — registration hero, invite landing
text-display-lg: 2.25rem / 1.05 — page titles ("USERS", "FAMILY", "MY TIMES")
text-display-md: 1.5rem / 1.1   — modal titles, section headers
text-body:       0.9375rem / 1.5
text-label:      0.75rem / 1.2, uppercase, tracking-wide — labels, table headers
text-mono:       0.8125rem / 1.4
```

### Color Palette

```css
:root {
  --color-paper:        #F7F3EC;
  --color-paper-raised: #FFFFFF;
  --color-ink:          #12151C;
  --color-ink-soft:     #4A4E5A;
  --color-rule:         rgba(18, 21, 28, 0.12);
  --color-rule-strong:  rgba(18, 21, 28, 0.22);

  --color-cinder:       #E2621B;
  --color-cinder-dark:  #B84D12;
  --color-cinder-tint:  #FBEAE0;

  --color-status-active:   #2F7A4D;
  --color-status-inactive: #8B8578;
  --color-status-deleted:  #8C2F1B;
  --color-status-pending:  #B0791A;

  --color-alert:        #B3261E;  /* impersonation-mode only */
  --color-alert-dark:   #8F1E18;
  --color-alert-ink:    #FFF8E7;
  --color-alert-stripe: #F2B705;
}
```

Dark-mode overrides, motion strategy (staggered table-row entrance, Roster Stamp scale+rotate
settle, slide-up modals, `prefers-reduced-motion` degradation to opacity-only), and layout
approach (ledger table for admin/trainer density, single-column max-480px for human-facing
forms) are unchanged from the real system — see the excerpt cited above for exact values; not
re-derived here since reuse means reuse, not approximation.

No purple, no blue-to-purple gradients anywhere in this system.

---

## Component Specs — TASK-008 Scope

### [TASK-008] Auth pages: Login / Register / Forgot-Reset-Password / Verify-Email (2026-07-22)

**Aesthetic role:** human-facing — centered single column, max-width 480px, generous vertical
rhythm (32px between sections).

- `LoginPage`: `text-display-xl` "TRAINING PLATFORM" wordmark above the form; on
  `EMAIL_NOT_VERIFIED` (G-1), the error renders as a distinct banner (not the generic inline
  field error) with a "Resend verification email" cinder-link action — this is the one login
  error that needs a recovery action, not just a message.
- `RegisterPage`: base fields first; a cinder-outlined toggle "I'm registering my child too"
  reveals the child sub-form (name/age/gender) with the same 150ms slide-open used by
  `UserCreateModal`'s role-conditional field reveal in the real system — reusing that exact
  interaction rather than inventing a new one for a structurally identical "reveal more fields"
  moment.
- `ForgotPasswordPage`/`ResetPasswordPage`: success state always reads the same generic
  confirmation copy regardless of whether the email existed (mirrors the anti-enumeration backend
  contract — the UI must not accidentally leak the distinction via different wording).
- `VerifyEmailPage`: on load, shows a Roster Stamp "VERIFIED" badge animating in on success, or a
  clear expired/invalid state with a "Request new link" action.

### [TASK-008] Role Dashboard Redirect (2026-07-22)

No custom visual surface — a pure routing component. Each role's landing page reuses that role's
own first substantive page below (Admin → Users list; Trainer → Roster; Coach → My Times; Player/
Parent → Player Profiles) rather than introducing a fifth "dashboard home" concept not called for
by any user story.

### [TASK-008] Admin: UsersListPage, Create/Deactivate/Delete modals, ImpersonationBanner, ImpersonationHistoryPage (2026-07-22)

Reuses the real system's established `UsersListPage` pattern exactly: `LedgerTable` with numbered
monospace rows, `text-label` sticky header, `StampBadge` for role (neutral ink outline) and status
(status-colored), row-hover action icons, stacked "roster card" responsive collapse below 768px.
`UserCreateModal`'s role-selector-first layout and "SEND INVITE" (not "CREATE") button label carry
over unchanged — the invite-email expectation-setting reasoning still applies identically.

**New this task:** `ImpersonateConfirmModal` — 480px confirm modal, title "VIEW PLATFORM AS
[NAME]?", body states the target's role and a one-line reminder that the session auto-expires in
1 hour; confirm button uses `--color-alert` (not `--color-cinder`) since this is the one action in
the whole system that starts an *ongoing exceptional mode*, not a routine primary action.

`ImpersonationBanner` — sticky, full-width, `--color-alert` fill with `--color-alert-stripe`
hazard-amber trim (decorative border only, never text/fill), `--color-alert-ink` text: "VIEWING
AS [NAME] ([ROLE])" left-aligned, "EXIT IMPERSONATION" button right-aligned. Mounts above
`AppHeader` whenever the decoded access token carries `impersonatedBy` — this is the one place in
the whole system `--color-alert` appears, keeping it meaningfully rare rather than diluted across
every warning state.

`ImpersonationHistoryPage` — same `LedgerTable` shell as `UsersListPage` (admin/coach/trainer
name, target name, start/end `text-mono` timestamps, duration), reinforcing that this is a ledger
of a different kind of entry, not a new visual language.

### [TASK-008] ProfileEditPage (role-aware) (2026-07-22)

Single-column, max-480px, per-role field sets (Player: school/jersey/photo; Coach: bio/
credentials/certifications + a `Switch` component for `publicVisible`; Trainer: business name/org
details). Read-only fields (email, role, skill level, created date) render as `text-label`-styled
static rows, not disabled inputs — visually distinct from "you could edit this but it's
disabled," which disabled inputs otherwise imply.

### [TASK-008] ShareLink: generation modal, invite-status list, JoinLandingPage (2026-07-22)

`ShareLinkGenerationModal` — 480px, shows the generated code as a large `text-mono` block with a
one-tap copy button and a small Roster Stamp "COPIED" flash on click. `CoachInvitationStatusList`
— ledger rows per invite (email, `StampBadge` Pending/Accepted/Expired using the existing status
palette, Resend action visible only on Expired). `JoinLandingPage` — the one fully public page in
this task's scope besides the coach public profile; `text-display-xl` trainer-name hero, then
either the registration form or (existing logged-in parent, multi-trainer) the family-selection
checklist — "Self" pre-checked by default, each child row a simple checkbox with the child's
name/age in `text-body`, no ledger-table treatment here (this is a decision moment, not a data
table).

### [TASK-008] Player/Parent: PlayerProfilesPage, ContextSwitcher, PendingApprovalsPage, BestTimesPage (2026-07-22)

`PlayerProfilesPage` ("FAMILY") — each family member as a roster-card row (name, age, `StampBadge`
per trainer association), "+ ADD CHILD" opens `AddChildProfileModal` (same slide-up modal shell);
per-child trainer list shows add/remove actions inline, remove triggers a confirm modal stating
the RSVP-cancellation consequence in the same declarative tone as `DeactivateConfirmModal`.

`ContextSwitcher` (nav-mounted, both parent and child variants) — the **Locker Nameplate Flip**:
clicking the current context flips like a locker nameplate (`rotateX` 90°→0° over ~220ms, cinder
accent underline on the active entry) to reveal the list (parent: "Me" section + per-child
sections, each row a trainer name; child: flat trainer list, no "Me" section, per FR-026).
Selecting a new context re-flips shut on the new value — the same physical gesture both ways,
reinforcing "you're in a specific place," never a generic dropdown open/close.

`PendingApprovalsPage` — ledger rows (child name, event/purchase ref, amount, payment type
`StampBadge`, requested-at `text-mono`), Approve (cinder)/Deny (ink-outline) actions inline; an
approved/denied row performs the Roster Stamp settle animation in place rather than removing
itself from the list immediately, so the parent sees the outcome register before the list
re-sorts.

`BestTimesPage`/`AvailabilityGrid` — day-of-week × time-range grid, toggle-per-day or explicit
range entry; when a parent, the page is scoped by the currently active `ContextSwitcher` selection
(switching context re-fetches that member's grid, not a separate profile-picker duplicating the
switcher).

### [TASK-008] Coach: MyTimesPage, CoachPublicProfilePage (2026-07-22)

`MyTimesPage` reuses `AvailabilityGrid` unchanged (generalized off a data-source prop, per the
real system's own TASK-005 precedent) with an "add another range" affordance per day for the
multiple-time-ranges-per-day requirement (US-01.10).

`CoachPublicProfilePage` — deliberately outside the authenticated app shell (no `AppHeader`,
no `ContextSwitcher`): standalone layout, `text-display-xl` coach name, bio in `text-body` at a
wider single-column measure than the authenticated app's 480px cap (public marketing-adjacent
page, not a form), a plain "not found" state (matching copy for not-found/not-public/deactivated,
per the API's uniform-404 anti-enumeration contract — the UI must not editorialize a distinction
the backend deliberately doesn't expose).

### [TASK-008] Trainer: TrainerRosterPage, TrainerBrandingPage, AppHeader, BrandingProvider (2026-07-22)

`TrainerRosterPage` ("ROSTER") — `LedgerTable` of own-org players/coaches with a
`RosterAvailabilitySummary` per row (`text-mono` "Mon 5-8pm, Wed 6-9pm" style string, expandable
to the full grid) and a `RosterFilterBar` (day/time filter pills, cinder-tinted when active).

`TrainerBrandingPage` ("BRANDING") — logo upload dropzone (client-side rejects `.svg` immediately
with a clear message, defense-in-depth alongside the backend's own rejection per G-5), live
preview of the uploaded logo in a mock `AppHeader` strip so the trainer sees the real effect
before saving; color picker with a live-updating cinder-accent preview across a few sample
components (button, badge, active nav item) and a "Reset to default" action.

`AppHeader`/`BrandingProvider` — the persistent app shell every other page mounts inside;
`BrandingProvider` resolves the current trainer context (via `ContextSwitcher`'s active selection
for multi-trainer players, or the caller's own `trainerId` for trainer/coach), fetches
`GET /trainer/branding`, and applies the trainer's `primaryColorHex` as a scoped `--color-cinder`
override for everything rendered inside that trainer's context — never leaking one trainer's
brand color into another trainer's context when a multi-trainer player switches.

## Responsive Behavior

Unchanged from the real system: ledger tables collapse to stacked roster cards below 768px
(hairline rule between cards, still numbered, still ledger-styled — not a generic mobile
redesign); single-column human-facing pages (registration, profile, join landing) are
already mobile-width-appropriate at their 480px max and need no separate mobile layout;
`ContextSwitcher`'s Locker Nameplate Flip collapses to a simpler tap-to-open sheet on touch
devices where a hover-adjacent flip gesture doesn't translate, while keeping the same
flip-settle animation timing on open/close.

---

## Next Steps

**Next by flow:** `using-git-worktrees` `[TASK-008 context]` — create the isolated workspace
called for in `writing-plans-plan.md`'s execution handoff, off `main`/`origin/main` (`552f7eb`).

**Alternatives:**
- `/coder-frontend` `[TASK-008 context]` — implement this design directly (not recommended
  without a worktree — see the warning in `writing-plans-plan.md`).
- `/brainstorm` `[TASK-008 context]` — revisit if any component spec above needs further dialogue
  before implementation.
