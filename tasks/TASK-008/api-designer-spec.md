# TASK-008 API Design — Epic-01: User Management & Authentication

> Kept isolated from `specs/api-designer-spec.md` for the same reason as
> `tasks/TASK-008/architect-architecture.md`: that file (on `feature/epic-01-user-mgmt`/
> `feature/epic-01`) documents the real, already-shipped API. This is TASK-008's independent
> API design pass — not merged into the living specs.
>
> **Deviation from the api-designer skill's generic template**: the template's controller example
> uses CQRS (`CommandBus`/`QueryBus`). This codebase's fixed convention (per
> `tasks/TASK-008/architect-architecture.md`, itself following the real repo's established
> pattern) is plain **Controller → Service → Prisma**, no CQRS — every controller below calls its
> module's service directly.

## Global Conventions

**Error response shape** (all errors, via the single global `AppExceptionFilter`):

```typescript
{
  statusCode: number;
  message: string;
  errorCode: string;
  details?: Record<string, unknown>;
}
```

**Error Code Catalog** (this task's additions):

| Code | Status | Meaning |
|---|---|---|
| `DUPLICATE_EMAIL` | 409 | Email already registered |
| `EMAIL_NOT_VERIFIED` | 403 | Login blocked pending verification (G-1) |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password (generic, no enumeration) |
| `ACCOUNT_DEACTIVATED` | 403 | `status = INACTIVE` or `DELETED` |
| `VERIFICATION_TOKEN_EXPIRED` \| `_INVALID` | 400 | Email-verify token bad/expired/used |
| `PASSWORD_RESET_TOKEN_EXPIRED` \| `_INVALID` | 400 | Reset token bad/expired/used |
| `SHARELINK_EXPIRED` \| `SHARELINK_EXHAUSTED` \| `SHARELINK_NOT_FOUND` | 400/404 | ShareLink resolution failures |
| `SHARELINK_TYPE_MISMATCH` | 400 | STATIC code hit a coach-only accept route or vice versa |
| `COACH_ALREADY_ACTIVE_ELSEWHERE` | 409 | Single-trainer constraint violation |
| `CANNOT_IMPERSONATE_SUPER_ADMIN` | 403 | Impersonation target guard |
| `CHILD_ACCOUNT_RESTRICTED` | 403 | `ChildAccountGuard` rejection |
| `APPROVAL_NOT_FOUND` \| `APPROVAL_ALREADY_RESOLVED` | 404/409 | Purchase-approval state errors |
| `VALIDATION_ERROR` | 400 | `class-validator` pipe failures (field-level `details`) |

**Auth header**: `Authorization: Bearer <accessToken>` on every non-`@Public()` route.
**Pagination query params** (list endpoints): `page` (default 1), `pageSize` (default 20, max
100) → `{ items: T[], total: number, page: number, pageSize: number }`.

---

## Module: Auth (`modules/auth/`)

### [TASK-008] POST /auth/register (2026-07-22)

```typescript
export class RegisterDto {
  @ApiProperty({ example: 'parent@example.com' })
  @IsEmail() @MaxLength(255)
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString() @MinLength(8) @MaxLength(72) // bcrypt's own input cap
  password: string;

  @ApiProperty() @IsNotEmpty() @MaxLength(100)
  firstName: string;

  @ApiProperty() @IsNotEmpty() @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional() @Matches(/^\+?[0-9\s-()]{7,20}$/)
  phone?: string;

  @ApiPropertyOptional({ description: 'ShareLink code, if registering via invite' })
  @IsOptional() @IsString()
  shareLinkCode?: string;
}

export class AuthResponseDto {
  @ApiProperty() @Expose() accessToken: string;
  @ApiProperty() @Expose() refreshToken: string;
  @ApiProperty() @Expose() user: UserSummaryDto;
}
```

**Status Codes:** 201 created (unverified); 409 `DUPLICATE_EMAIL`; 400 `VALIDATION_ERROR`.

### [TASK-008] POST /auth/login (2026-07-22)

```typescript
export class LoginDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsNotEmpty() password: string;
}
```

**Status Codes:** 200 → `AuthResponseDto`; 401 `INVALID_CREDENTIALS`; 403
`EMAIL_NOT_VERIFIED` | `ACCOUNT_DEACTIVATED`; 429 (Throttler, 5/60s per IP).

### [TASK-008] POST /auth/refresh, /auth/logout (2026-07-22)

`POST /auth/refresh` — `{ refreshToken: string }` → new `AuthResponseDto` pair (sliding 7-day
window, G-4). `POST /auth/logout` — revokes the presented refresh token, 204.

### [TASK-008] POST /auth/verify-email, /auth/password-reset/request|confirm (2026-07-22)

```typescript
export class VerifyEmailDto { @ApiProperty() @IsString() token: string; }
export class RequestPasswordResetDto { @ApiProperty() @IsEmail() email: string; }
export class ConfirmPasswordResetDto {
  @ApiProperty() @IsString() token: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) newPassword: string;
}
```

`POST /auth/password-reset/request` always returns 200 with a generic message, whether or not
the email exists (anti-enumeration, FR-004).

---

## Module: Users — Admin (`modules/users/`)

### [TASK-008] POST /admin/users (2026-07-22)

`@Roles(Role.SUPER_ADMIN)`

```typescript
export class CreateTrainerDto {
  @ApiProperty() @IsNotEmpty() businessName: string;
  @ApiProperty() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsNotEmpty() lastName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiPropertyOptional() @IsOptional() phone?: string;
}
```

**Status Codes:** 201 → `UserSummaryDto` (invite-setup email sent); 409 `DUPLICATE_EMAIL`; 403
(non-Super-Admin caller).

### [TASK-008] GET /admin/users (2026-07-22)

`@ApiQuery` for `page`, `pageSize`, `search`, `role`, `status`. Returns paginated
`UserSummaryDto[]` (id, name, email, role, status, lastLoginAt — never `passwordHash`, enforced
via `@Exclude()` on the entity-to-DTO mapper, not manual field-picking).

### [TASK-008] PATCH /admin/users/:id, POST /admin/users/:id/deactivate|reactivate|delete (2026-07-22)

```typescript
export class EditUserDto extends PartialType(
  OmitType(CreateTrainerDto, ['email'] as const)
) {}

export class DeleteUserDto {
  @ApiPropertyOptional() @IsOptional() @MaxLength(500)
  reason?: string;
}
```

`/deactivate` and `/reactivate` take no body, 200 → updated `UserSummaryDto`. `/delete` → 200 with
the anonymized `UserSummaryDto` (name now "Deleted User"); 409 if already `DELETED`.

---

## Module: Impersonation (`modules/impersonation/`)

### [TASK-008] POST /admin/impersonation/:userId/start (2026-07-22)

`@Roles(Role.SUPER_ADMIN)`. No body. Sets the impersonation token pair on a **second cookie**
(`impersonation_session`), distinct from the admin's own session cookie.

**Response:** `{ impersonatedUser: UserSummaryDto, startedAt: string }`.
**Status Codes:** 200; 403 `CANNOT_IMPERSONATE_SUPER_ADMIN`; 404 (unknown `userId`).

### [TASK-008] POST /admin/impersonation/exit, GET /admin/impersonation/history (2026-07-22)

`/exit` — clears only the impersonation cookie, closes the open `ImpersonationLog` row, 204.
`/history` — `@Roles(Role.SUPER_ADMIN)`, paginated:

```typescript
export class ImpersonationLogDto {
  @Expose() adminName: string;
  @Expose() targetName: string;
  @Expose() startedAt: string;
  @Expose() endedAt: string | null;
  @Expose() durationSeconds: number | null;
}
```

---

## Module: Profile (`modules/profile/`)

### [TASK-008] GET/PATCH /profile/me, POST /profile/me/photo (2026-07-22)

No `:id` — always derives the caller from the JWT.

```typescript
export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @MaxLength(100) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @MaxLength(100) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\+?[0-9\s-()]{7,20}$/) phone?: string;
  @ApiPropertyOptional() @IsOptional() @MaxLength(200) school?: string;
  // Role-specific, all optional, only honored for the matching role server-side:
  @ApiPropertyOptional() @IsOptional() bio?: string;
  @ApiPropertyOptional() @IsOptional() jerseyNumber?: string;
  @ApiPropertyOptional() @IsOptional() emergencyContact?: string;
}
```

`email`, `role`, `skillLevel`, `createdAt` are never accepted by this DTO — sending them is
silently dropped by `class-validator`'s whitelist, not a 400 (matches this endpoint's "read-only
means absent from the writable contract" convention). Photo upload: `multipart/form-data`, PNG/
JPG only, 400 `VALIDATION_ERROR` otherwise.

---

## Module: ShareLink (`modules/sharelink/`)

### [TASK-008] POST /sharelinks/static, POST /sharelinks/coach-invite (2026-07-22)

`@Roles(Role.TRAINER)`. `/static` — no body, returns `{ code: string, url: string }` (unlimited
use, no expiry). `/coach-invite`:

```typescript
export class CoachInviteDto {
  @ApiProperty() @IsEmail() targetEmail: string;
  @ApiPropertyOptional() @IsOptional() message?: string;
}
```

→ `{ code, url, expiresAt, targetEmail }` (single-use, 7-day expiry).

### [TASK-008] GET /join/:code, POST /join/:code/register (2026-07-22)

`@Public()`. `GET` resolves the code and returns what the frontend needs to render (trainer name,
link type, or — for a logged-in child session — a `blocked: true` flag per FR-026, triggering the
parent-notification email as a side effect of this same call, not a separate endpoint).

```typescript
export class RegisterViaLinkDto extends RegisterDto {
  @ApiPropertyOptional({ description: 'Existing-account family selection: userId + child ids to associate' })
  @IsOptional() @IsArray()
  associateMemberIds?: string[];
}
```

**Status Codes:** 200/201; 400 `SHARELINK_EXPIRED` | `SHARELINK_EXHAUSTED` |
`SHARELINK_TYPE_MISMATCH`; 404 `SHARELINK_NOT_FOUND`.

---

## Module: Player Profile (`modules/player-profile/`)

### [TASK-008] GET /players, POST /players/child (2026-07-22)

```typescript
export class CreateChildProfileDto {
  @ApiProperty() @IsNotEmpty() @MaxLength(100) displayName: string;
  @ApiProperty() @IsDateString() birthDate: string;
  @ApiProperty() @IsString() gender: string;
  @ApiPropertyOptional() @IsOptional() school?: string;
  @ApiPropertyOptional({ description: 'Trainer ids to associate immediately, per single/multi-trainer prompt' })
  @IsOptional() @IsArray()
  associateTrainerIds?: string[];
}
```

**Validation:** age derived from `birthDate` must be 1–18 (`VALIDATION_ERROR` otherwise).
**Response** includes `duplicateWarning?: boolean` (non-blocking, per FR-023).

### [TASK-008] POST /players/:id/trainers, DELETE /players/:id/trainers/:trainerId (2026-07-22)

```typescript
export class AddTrainerAssociationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() shareLinkCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() trainerId?: string;
  // exactly one of the two must be present — enforced in the service, not the DTO
}
```

`DELETE` returns `{ cancelledUpcomingRsvps: true }` as an explicit signal (actual RSVP
cancellation is Epic-02's concern — this response field just tells the frontend to show that
confirmation copy). 404 if the association doesn't belong to the caller's family.

---

## Module: Purchase Approval (`modules/purchase-approval/`)

### [TASK-008] GET /purchase-approvals, POST /purchase-approvals/:id/approve|deny (2026-07-22)

```typescript
export class DenyApprovalDto {
  @ApiPropertyOptional() @IsOptional() @MaxLength(500) parentNotes?: string;
}
```

`GET` — parent-scoped list (`parentUserId` from JWT), each item includes `status`, computed
`isExpired` (lazy check on read, G-... no scheduler). `/approve` — 200, processes payment
(Epic-05 stub call) and flips status; `/deny` — 200, notifies child. 409
`APPROVAL_ALREADY_RESOLVED` if not `PENDING`; 403 if caller isn't the request's `parentUserId`.

---

## Module: Availability (`modules/availability/`)

### [TASK-008] GET/PUT /availability/me, GET /availability/player/:id (2026-07-22)

```typescript
export class AvailabilitySlotDto {
  @ApiProperty({ minimum: 0, maximum: 6 }) @IsInt() @Min(0) @Max(6) dayOfWeek: number;
  @ApiProperty({ example: '17:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime: string;
  @ApiProperty({ example: '20:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isAvailable?: boolean;
}

export class SetAvailabilityDto {
  @ApiPropertyOptional({ description: 'Player profile id, for a parent setting a child\'s availability' })
  @IsOptional() @IsString()
  ownerProfileId?: string;

  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => AvailabilitySlotDto)
  slots: AvailabilitySlotDto[];
}
```

`PUT` fully replaces the slot set for the resolved owner (self, or `ownerProfileId` if the
caller is that child's parent — 403 otherwise). `GET /availability/player/:id` is the
trainer-facing view — `@Roles(Role.TRAINER)`, scoped to the caller's own roster (404 if the
player isn't in the caller's org, not a cross-trainer 200).

---

## Module: Coach Profile (`modules/coach-profile/`)

### [TASK-008] PUT /coach/profile (2026-07-22)

```typescript
export class UpdateCoachProfileDto {
  @ApiPropertyOptional() @IsOptional() @MaxLength(2000) bio?: string;
  @ApiPropertyOptional() @IsOptional() credentials?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() certifications?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() publicVisible?: boolean;
}
```

### [TASK-008] GET /coach/public/:slug (2026-07-22)

`@Public()`. Returns bio/credentials/certifications/photo only if `publicVisible = true` **and**
the underlying `User.status = ACTIVE`. **Uniform 404** for not-found, not-public, and
deactivated/deleted — same response shape and timing-insensitive lookup, no distinguishing signal
(anti-enumeration).

### [TASK-008] POST /coach/:id/conflict-check (2026-07-22, stub ahead of Epic-02)

```typescript
export class ConflictCheckDto {
  @ApiPropertyOptional({ description: 'Nullable until Epic-02\'s Event entity exists' })
  @IsOptional() @IsString() eventId?: string;
  @ApiProperty({ minimum: 0, maximum: 6 }) @IsInt() dayOfWeek: number;
  @ApiProperty() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime: string;
  @ApiProperty() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime: string;
}

export class OverrideConflictDto extends ConflictCheckDto {
  @ApiProperty() @IsNotEmpty() @MaxLength(500) reason: string;
}
```

`POST /coach/:id/conflict-check` → `{ conflict: boolean }`. A second action,
`POST /coach/:id/override`, takes `OverrideConflictDto`, writes `CoachAvailabilityOverride`, 201 —
never blocks the caller even when `conflict: true`.

---

## Module: Trainer Roster (`modules/trainer-roster/`)

### [TASK-008] GET /trainer/roster, GET /trainer/players/availability (2026-07-22)

`@Roles(Role.TRAINER)`, both strictly `trainerId`-scoped from JWT. `/roster` → paginated players
+ coaches with availability-summary strings (FR-032). `/players/availability?dayOfWeek=&time=` →
filtered player list matching that slot.

---

## Module: Branding (`modules/branding/`)

### [TASK-008] GET/PUT /trainer/branding (2026-07-22)

```typescript
export class UpdateBrandingDto {
  @ApiPropertyOptional({ pattern: '^#[0-9A-Fa-f]{6}$' })
  @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColorHex?: string;
}
```

Logo upload is a separate `multipart/form-data` route,
`POST /trainer/branding/logo` — content-sniffs the actual bytes (not just declared MIME),
**rejects SVG explicitly** (G-5), max 2MB, resizes >200×200 via `sharp`. `GET /trainer/branding`
is readable by any authenticated user in that trainer's org (players/coaches too), not just the
trainer, so the shared `AppHeader` can render it.

---

## Module: Camp Conversion (stub, G-2) (`modules/camp-conversion/`)

### [TASK-008] POST /camp-conversion/draft (2026-07-22, stub ahead of Epic-08)

```typescript
export class CampPrefillDraftDto {
  @ApiProperty() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsNotEmpty() lastName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() trainerId: string;
  @ApiPropertyOptional() @IsOptional() playerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() playerBirthDate?: string;
  @ApiPropertyOptional() @IsOptional() playerGender?: string;
}
```

→ `{ draftToken: string, expiresAt: string }` (24h expiry, matches the email-verification
pattern). `GET /auth/register?draftToken=...` (extends Task B1's contract from
`writing-plans-plan.md`) resolves the draft to pre-fill `RegisterDto`'s fields client-side;
consuming it auto-associates with `trainerId`, reusing the same association code path as
`POST /join/:code/register`.

---

## Bruno Collection

Not generated as a separate file for this pass — every endpoint above is fully specified
(method, path, DTO, status codes) to generate one directly from this doc once real
implementation begins; a Bruno collection built now, against no running server, would just be
this same information restated in a different format.

---

## Next Steps

**Next by flow:** `/frontend-design` `[TASK-008 context]` — design the UI from this API spec.

**Alternatives:**
- `/git-worktrees` `[TASK-008 context]` — skip UI design, create the isolated workspace called
  for in `writing-plans-plan.md`'s execution handoff.
- `/coder` `[TASK-008 context]` — implement the API directly (not recommended without a worktree
  — see the warning in `writing-plans-plan.md`).
- `/test-generator` `[TASK-008 context]` — generate API integration tests first.
