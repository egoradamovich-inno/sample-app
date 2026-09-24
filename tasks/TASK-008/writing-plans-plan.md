# Epic-01: User Management & Authentication — Implementation Plan

**Task:** TASK-008

> **For Claude:** The isolated workspace already exists — `.worktrees/TASK-008` (branch
> `feature/TASK-008`), off `main`/`origin/main` (`552f7eb`, pre-Epic-01, no `apps/` at all).
> `using-git-worktrees` already scaffolded and committed (`4baeac5`) a working monorepo there:
> npm workspaces root, NestJS CLI project in `apps/backend` (Prisma already initialized —
> `prisma/schema.prisma` + `prisma.config.ts` exist, generator is the newer `prisma-client`
> client with `output = "../generated/prisma"`, **not** the classic `prisma-client-js` — import
> `PrismaClient` from the generated path, not `@prisma/client`), and a Vite React+TS project in
> `apps/frontend` (Tailwind v4 wired to the real Field House Ledger tokens in `src/index.css`,
> Vitest + RTL, `axios`, `react-router-dom`). Backend build/lint/test and frontend build/lint/test
> all verified clean on that scaffold commit. Implement with the `coder` skill (backend) and
> `coder-frontend` skill (frontend) in parallel per phase, working directly in that worktree —
> **do not** re-create a worktree or re-scaffold the projects.
>
> **DTOs and endpoints below are illustrative of the test-driving logic** — the authoritative
> field-level shape (Swagger decorators, exact validators, exact error codes) is
> `tasks/TASK-008/api-designer-spec.md`; reconcile the two when they'd otherwise diverge, api-
> designer-spec.md wins. Component names/visual specs below match
> `tasks/TASK-008/frontend-design-spec.md`; module boundaries and transaction-boundary choices
> match `tasks/TASK-008/architect-architecture.md`.

**Goal:** Build the full Epic-01 user-management/authentication system — 4-role RBAC, JWT auth,
multi-tenant trainer scoping, ShareLink-based onboarding, parent/child accounts, impersonation,
GDPR-compliant soft delete/deletion — as one holistic implementation covering all 14 user stories.

**Architecture:** NestJS backend (Controller → Service → Prisma, one module per domain) + React/
Vite/Tailwind frontend (plain `useState`/`useEffect`, no state-management library), per
`tasks/TASK-008/architect-architecture.md`. Three global guards (`JwtAuthGuard` → `RolesGuard` →
`ChildAccountGuard`) plus `ThrottlerGuard`; application-level `trainerId` scoping derived from the
JWT.

**Tech Stack:** NestJS 11, Prisma 6.19 (new `prisma-client` generator) + PostgreSQL, Passport.js
(`@nestjs/passport` + `@nestjs/jwt`, JWT strategy), `bcrypt`, `sharp` (image resize),
`class-validator`/`class-transformer`, `@nestjs/swagger` 11.2, `@nestjs/throttler`, Jest (unit) +
Jest e2e (real Postgres); React 19 + Vite 8 + Tailwind v4, Vitest 4 + RTL, `axios`,
`react-router-dom`.

**Note on granularity below:** foundational and trickier tasks (schema, guards, token issuance,
race-safe ShareLink generation, GDPR anonymization, impersonation cookie handoff) get full
TDD code. Repetitive CRUD-shaped tasks give the exact file, method signature/DTO shape, and the
concrete test cases to write — apply the same write-test → fail → implement → pass → commit
discipline to each. Every commit is scoped to one task; commit messages follow this repo's
`type(scope): summary` convention.

---

## Phase A — Foundation

### Task A1: Prisma schema — all Epic-01 models

**Files:**
- Modify: `apps/backend/prisma/schema.prisma` (already exists from scaffolding — replace its
  default placeholder content, **keep the existing `generator`/`datasource` blocks unchanged**)
- Create: `apps/backend/prisma/migrations/20260101000000_init_epic01/migration.sql`
  (hand-authored SQL, matching this repo's convention of hand-written migrations with
  `-- CreateTable`/`-- AlterTable` comment headers)

**Step 1: Write the schema** (append models below the existing `generator`/`datasource` blocks —
do not change `provider = "prisma-client"` or `output = "../generated/prisma"`, that's the real
scaffolded generator config)

```prisma
enum Role {
  SUPER_ADMIN
  TRAINER
  COACH
  PLAYER
}

enum UserStatus {
  ACTIVE
  INACTIVE
  DELETED
}

enum ShareLinkType {
  STATIC
  UNIQUE
}

enum AvailabilityOwnerType {
  COACH
  PLAYER
}

enum ApprovalStatus {
  PENDING
  APPROVED
  DENIED
  EXPIRED
}

enum PaymentType {
  USD
  TOKEN
}

model User {
  id               String    @id @default(uuid())
  email            String    @unique
  passwordHash     String
  role             Role
  status           UserStatus @default(ACTIVE)
  emailVerified    Boolean   @default(false)
  parentUserId     String?
  parent           User?     @relation("ParentChild", fields: [parentUserId], references: [id])
  children         User[]    @relation("ParentChild")
  lastLoginAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  profile            Profile?
  trainerProfile      TrainerProfile?
  coachProfile        CoachProfile?
  playerProfile       PlayerProfile?
  refreshTokens       RefreshToken[]
  emailVerifications  EmailVerificationToken[]
  passwordResets      PasswordResetToken[]
  shareLinksCreated   ShareLink[] @relation("ShareLinkCreatedBy")
  impersonationsAsAdmin  ImpersonationLog[] @relation("ImpersonationAdmin")
  impersonationsAsTarget ImpersonationLog[] @relation("ImpersonationTarget")
}

model Profile {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  firstName String
  lastName  String
  phone     String?
  photoUrl  String?
  school    String?
  updatedAt DateTime @updatedAt
}

model TrainerProfile {
  id           String   @id @default(uuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id])
  businessName String
  address      String?
  website      String?
  description  String?
  branding     Branding?
}

model Branding {
  id               String         @id @default(uuid())
  trainerProfileId String         @unique
  trainerProfile   TrainerProfile @relation(fields: [trainerProfileId], references: [id])
  logoUrl          String?
  primaryColorHex  String?
  updatedAt        DateTime       @updatedAt
}

model CoachProfile {
  id              String   @id @default(uuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  trainerId       String
  bio             String?
  credentials     String?
  certifications  String[]
  publicVisible   Boolean  @default(false)
  publicSlug      String?  @unique
  joinedAt        DateTime @default(now())
}

model PlayerProfile {
  id                String   @id @default(uuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])
  displayName       String
  birthDate         DateTime?
  gender            String?
  skillLevel        String?
  school            String?
  jerseyNumber      String?
  isChild           Boolean  @default(false)
  emergencyContact  String?
  tokenAutoApprove  Boolean  @default(false)

  associations      TrainerPlayerAssociation[]
  approvals         ChildPurchaseApproval[] @relation("ChildApprovals")
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tokenHash String
  expiresAt DateTime
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())
}

model EmailVerificationToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
}

model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
}

model ShareLink {
  id            String        @id @default(uuid())
  code          String        @unique
  type          ShareLinkType
  trainerId     String
  createdById   String
  createdBy     User          @relation("ShareLinkCreatedBy", fields: [createdById], references: [id])
  targetEmail   String?
  expiresAt     DateTime?
  maxUses       Int?
  useCount      Int           @default(0)
  active        Boolean       @default(true)
  createdAt     DateTime      @default(now())

  associations  TrainerPlayerAssociation[]
}

model TrainerPlayerAssociation {
  id              String        @id @default(uuid())
  trainerId       String
  playerProfileId String
  playerProfile   PlayerProfile @relation(fields: [playerProfileId], references: [id])
  shareLinkId     String?
  shareLink       ShareLink?    @relation(fields: [shareLinkId], references: [id])
  connectedAt     DateTime      @default(now())
  status          String        @default("ACTIVE")

  @@unique([trainerId, playerProfileId])
}

model Availability {
  id          String                @id @default(uuid())
  ownerType   AvailabilityOwnerType
  ownerId     String
  dayOfWeek   Int
  startTime   String
  endTime     String
  isAvailable Boolean               @default(true)
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt
}

model CoachAvailabilityOverride {
  id            String   @id @default(uuid())
  eventId       String?
  coachId       String
  trainerId     String
  reason        String
  overriddenBy  String
  createdAt     DateTime @default(now())
}

model ImpersonationLog {
  id            String    @id @default(uuid())
  adminId       String
  admin         User      @relation("ImpersonationAdmin", fields: [adminId], references: [id])
  targetUserId  String
  target        User      @relation("ImpersonationTarget", fields: [targetUserId], references: [id])
  startedAt     DateTime  @default(now())
  endedAt       DateTime?
  durationSeconds Int?
}

model ChildPurchaseApproval {
  id              String          @id @default(uuid())
  childProfileId  String
  childProfile    PlayerProfile   @relation("ChildApprovals", fields: [childProfileId], references: [id])
  parentUserId    String
  eventOrPurchaseRef String
  amount          Decimal         @db.Decimal(10, 2)
  paymentType     PaymentType
  status          ApprovalStatus  @default(PENDING)
  requestedAt     DateTime        @default(now())
  respondedAt     DateTime?
  expiresAt       DateTime
  parentNotes     String?
}

model UserDeletionLog {
  id                 String   @id @default(uuid())
  originalUserId     String
  originalEmailBackup String
  deletedById        String
  reason             String?
  deletedAt          DateTime @default(now())
}
```

**Step 2: Write the migration SQL** (mirrors the schema, hand-authored with
`-- CreateTable` comment headers per `specs/docs-generator-implementation.md`'s convention;
generate a draft with `npx prisma migrate diff --from-empty --to-schema-datamodel
prisma/schema.prisma --script` and hand-verify before saving as `migration.sql`, rather than
running `prisma migrate dev` directly against a shared dev DB).

**Step 3: `npx prisma generate`**

Run: `cd apps/backend && npx prisma generate`
Expected: client generated into `apps/backend/generated/prisma` — required immediately, or every
enum import (`Role`, `UserStatus`, …) silently becomes `undefined`.

**Step 4: Commit**

```bash
git add apps/backend/prisma
git commit -m "feat(db): add Epic-01 Prisma schema and initial migration"
```

---

### Task A1b: `PrismaService` — injectable client wrapper

**Files:**
- Create: `apps/backend/src/shared/prisma/prisma.service.ts`, `prisma.module.ts`
- Test: `prisma.service.spec.ts`

**Why this task exists:** every service in every later task injects `PrismaService` — it has to
exist before any of them can be TDD'd, and the generated client lives at a non-default import
path (`../generated/prisma`, not `@prisma/client`) because of this scaffold's generator config.

**Step 1: Failing test**

```typescript
describe('PrismaService', () => {
  it('should connect on module init and disconnect on module destroy', async () => {
    const service = new PrismaService();
    const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
    const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);
    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalled();
    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalled();
  });
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

Export `PrismaModule` as `@Global()` so every feature module can inject `PrismaService` without
re-importing it individually — matches this repo's shared-infra convention.

**Step 4: Run — expect PASS**

**Step 5: Commit:** `git commit -m "feat(shared): add PrismaService wrapping the generated client"`

---

### Task A2: Shared error handling — `AppException` + global filter

**Files:**
- Create: `apps/backend/src/shared/errors/app-exception.ts`
- Create: `apps/backend/src/shared/errors/app-exception.filter.ts`
- Test: `apps/backend/src/shared/errors/app-exception.filter.spec.ts`

**Step 1: Write the failing test**

```typescript
describe('AppExceptionFilter', () => {
  it('should serialize an AppException with errorCode and details', () => {
    const filter = new AppExceptionFilter();
    const exception = new AppException('DUPLICATE_EMAIL', 'Email already in use', 409, { field: 'email' });
    const host = createMockArgumentsHost();
    filter.catch(exception, host);
    expect(getJsonResponse(host)).toEqual({
      errorCode: 'DUPLICATE_EMAIL',
      message: 'Email already in use',
      details: { field: 'email' },
    });
  });
});
```

**Step 2: Run — expect FAIL** (`AppException`/`AppExceptionFilter` undefined)

**Step 3: Implement**

```typescript
// app-exception.ts
export class AppException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ errorCode, message, details }, status);
  }
}
```

Global filter catches `AppException` first, falls back to Nest's standard exceptions — single
global filter, no per-controller try/catch. Error codes match the catalog in
`tasks/TASK-008/api-designer-spec.md`.

**Step 4: Run — expect PASS**

**Step 5: Commit**

```bash
git add apps/backend/src/shared/errors
git commit -m "feat(shared): add AppException and global exception filter"
```

---

### Task A3: `EmailService` (log-only stub) + `StorageService` interface

**Files:**
- Create: `apps/backend/src/shared/email/email.service.ts`, `email.module.ts`
- Create: `apps/backend/src/shared/storage/storage.service.ts` (interface),
  `local-disk.storage.ts` (impl, using `sharp` for resize/thumbnail)
- Test: `email.service.spec.ts`, `local-disk.storage.spec.ts`

**Contract:**

```typescript
export interface SendEmailInput { to: string; subject: string; body: string; }
export class EmailService { send(input: SendEmailInput): Promise<void>; }

export interface StorageService {
  savePhoto(buffer: Buffer, userId: string): Promise<{ url: string; thumbnailUrl: string }>;
  saveLogo(buffer: Buffer, trainerId: string): Promise<{ url: string }>;
  delete(url: string): Promise<void>;
}
```

**Test cases:** `EmailService.send` logs `to`/`subject`/`body` and resolves; `LocalDiskStorage`
content-sniffs the actual bytes (not just declared MIME) and rejects non-PNG/JPG for `saveLogo`
(G-5 — SVG explicitly rejected even if mislabeled), resizes photos to a thumbnail via `sharp`,
and `delete` is idempotent on a missing file.

**Commit:** `git commit -m "feat(shared): add log-only EmailService and local-disk StorageService"`

---

### Task A4: JWT/Passport setup + `Role` enum guards

**Files:**
- Create: `apps/backend/src/modules/auth/strategies/jwt.strategy.ts`
- Create: `apps/backend/src/shared/guards/jwt-auth.guard.ts`
- Create: `apps/backend/src/shared/guards/roles.guard.ts` + `@Roles()` decorator
- Create: `apps/backend/src/shared/guards/child-account.guard.ts` + `@BlockChildAccounts()`
- Create: `apps/backend/src/shared/decorators/public.decorator.ts`
- Test: one spec per guard

**Test cases per guard:**
- `JwtAuthGuard`: passes with a valid token attached to `req.user`; rejects expired/malformed
  tokens with 401; allows through when `@Public()` metadata is present.
- `RolesGuard`: allows when `req.user.role` is in the route's `@Roles(...)` list; 403 otherwise;
  allows when no `@Roles()` metadata is set (public-to-any-authenticated-role route).
- `ChildAccountGuard`: 403s with `CHILD_ACCOUNT_RESTRICTED` when `req.user.parentUserId` is set
  and the route carries `@BlockChildAccounts()`; passes through otherwise.

Register all three as global `APP_GUARD`s in `app.module.ts`, in the order
`JwtAuthGuard` → `RolesGuard` → `ChildAccountGuard` (this order matters — see
`architect-architecture.md`'s guard-chain rationale), plus `@nestjs/throttler`'s `ThrottlerGuard`.

**Commit:** `git commit -m "feat(auth): add JWT strategy and RBAC/child-account guards"`

---

## Phase B — Core Authentication

### Task B1: `AuthService.register` + bcrypt hashing

**Files:**
- Create: `apps/backend/src/modules/auth/auth.service.ts`, `auth.module.ts`
- Create: `apps/backend/src/modules/auth/dto/register.dto.ts` (Swagger-decorated shape:
  `tasks/TASK-008/api-designer-spec.md` → `RegisterDto`)
- Test: `auth.service.spec.ts`

**Step 1: Failing tests**

```typescript
describe('AuthService.register', () => {
  it('should hash the password before storing', async () => {
    const user = await service.register({ email: 'a@x.com', password: 'Passw0rd!', firstName: 'A', lastName: 'B' });
    expect(user.passwordHash).not.toBe('Passw0rd!');
    expect(await bcrypt.compare('Passw0rd!', user.passwordHash)).toBe(true);
  });

  it('should throw DuplicateEmailException when email already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: '1' } as any);
    await expect(service.register({ email: 'a@x.com', password: 'x', firstName: 'A', lastName: 'B' }))
      .rejects.toThrow(DuplicateEmailException);
  });

  it('should create an unverified user and issue an EmailVerificationToken', async () => {
    const user = await service.register({ email: 'a@x.com', password: 'Passw0rd!', firstName: 'A', lastName: 'B' });
    expect(user.emailVerified).toBe(false);
    expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
  });
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement** `register()`: check uniqueness, `bcrypt.hash(password, 12)`, create `User`
+ `Profile` in a transaction, issue an `EmailVerificationToken` (24h expiry), send verification
email via `EmailService`.

**Step 4: Run — expect PASS**

**Step 5: Commit:** `git commit -m "feat(auth): add registration with bcrypt hashing and email verification"`

---

### Task B2: Email verification flow (G-1 — required before login)

**Files:**
- Create: `apps/backend/src/modules/auth/verification.service.ts`
- Modify: `auth.controller.ts` — `POST /auth/verify-email`
- Test: `verification.service.spec.ts`

**Test cases:** valid unexpired token marks `user.emailVerified = true` and marks the token
used; expired token throws `VerificationTokenExpiredException`; already-used token throws the
same; unknown token throws `VerificationTokenInvalidException`.

**Commit:** `git commit -m "feat(auth): add email verification endpoint"`

---

### Task B3: `TokenService` — 15-min access / 7-day sliding refresh (G-4)

**Files:**
- Create: `apps/backend/src/modules/auth/token.service.ts`
- Test: `token.service.spec.ts`

**Step 1: Failing tests**

```typescript
describe('TokenService.issuePair', () => {
  it('should issue an access token that expires in 15 minutes', () => {
    const { accessToken } = service.issuePair(user);
    const decoded = jwt.decode(accessToken) as any;
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });

  it('should persist a refresh token hash expiring 7 days out', async () => {
    await service.issuePair(user);
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: user.id }) }),
    );
  });

  it('should include impersonatedBy in the access token payload when provided', () => {
    const { accessToken } = service.issuePair(user, { impersonatedBy: 'admin-1' });
    expect((jwt.decode(accessToken) as any).impersonatedBy).toBe('admin-1');
  });

  it('should cap the refresh token to 1 hour when refreshTtlOverride is set', async () => {
    await service.issuePair(user, { impersonatedBy: 'admin-1', refreshTtlOverride: '1h' });
    const call = prisma.refreshToken.create.mock.calls[0][0];
    const ttlMs = call.data.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it('should slide the refresh token forward on refresh', async () => {
    const oldToken = await makeRefreshToken(userId, daysFromNow(7));
    const { refreshToken: newRaw } = await service.refresh(oldToken.raw);
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: oldToken.id }, data: expect.objectContaining({ revoked: true }) }),
    );
  });
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement** `issuePair(user, opts?: { impersonatedBy?: string; refreshTtlOverride?:
string })`: signs a 15-minute JWT access token (payload: `sub`, `role`, `parentUserId`, optional
`impersonatedBy`); generates a random refresh token, stores only its hash with
`expiresAt = now + (opts.refreshTtlOverride ?? 7d)`; `refresh(rawToken)` looks up by hash, checks
`!revoked && expiresAt > now`, revokes the old row, issues a new pair (sliding window — unless
the original pair was impersonation-scoped, which never slides past its 1h cap).

**Step 4: Run — expect PASS**

**Step 5: Commit:** `git commit -m "feat(auth): add TokenService with 15min access / 7-day sliding refresh"`

---

### Task B4: `AuthService.login` / `logout` / `POST /auth/refresh`

**Files:**
- Modify: `auth.service.ts`; Modify: `auth.controller.ts`
- Test: extend `auth.service.spec.ts`

**Test cases:** correct credentials + verified email → token pair issued, `lastLoginAt` updated;
unverified email → 403 `EMAIL_NOT_VERIFIED` (G-1); wrong password / unknown email → identical
generic 401 (no enumeration signal); `INACTIVE`/`DELETED` status → 403 `ACCOUNT_DEACTIVATED`;
`logout` revokes the presented refresh token.

**Commit:** `git commit -m "feat(auth): add login, logout, and refresh endpoints"`

---

### Task B5: Password reset flow

**Files:**
- Create: `apps/backend/src/modules/auth/password-reset.service.ts`
- Modify: `auth.controller.ts` — `POST /auth/password-reset/request`, `/confirm`
- Test: `password-reset.service.spec.ts`

**Test cases:** `request()` for an existing email creates a 1h-expiry token and emails a link;
`request()` for a non-existent email returns the same generic success response (no enumeration);
`confirm()` with a valid token updates `passwordHash` and marks the token used; expired/used/
unknown token throws a clear `AppException`.

**Commit:** `git commit -m "feat(auth): add password reset request/confirm flow"`

---

### Task B6: Rate limiting on login (FR-007)

**Files:**
- Modify: `auth.controller.ts` — `@Throttle({ default: { limit: 5, ttl: 60_000 } })` on `POST /auth/login`
- Test: `auth.e2e-spec.ts` (e2e — real Postgres, real HTTP)

**Test case:** 6th login attempt from the same IP within 60s returns 429.

**Commit:** `git commit -m "feat(auth): rate-limit login endpoint"`

---

## Phase C — Super Admin User Management

### Task C1: `UserAdminService.createTrainer` (US-01.01)

**Files:**
- Create: `apps/backend/src/modules/users/user-admin.service.ts`, `.module.ts`, `.controller.ts`
- Create: `dto/create-trainer.dto.ts`
- Test: `user-admin.service.spec.ts`

**Test cases:** creates `User(role=TRAINER)` + `Profile` + `TrainerProfile` in one transaction;
issues an invite-setup link (never a plaintext temp password over email); sends invite email;
throws `DuplicateEmailException` on existing email; only a `SUPER_ADMIN`-role caller can hit the
endpoint (`@Roles(Role.SUPER_ADMIN)`).

**Commit:** `git commit -m "feat(users): add Super Admin create-trainer flow"`

---

### Task C2: `listUsers` — paginated, tool-specific search

**Files:** Modify `user-admin.service.ts`; Test: extend spec

**Contract:** `listUsers({ page, pageSize, search?, role?, status? }): Promise<{ items: UserSummary[]; total: number }>`.
**Test cases:** paginates correctly at page boundaries; `search` matches name/email
case-insensitively; filters combine (role + status + search) with AND semantics; empty result
set returns `{ items: [], total: 0 }`, not an error.

**Commit:** `git commit -m "feat(users): add paginated user directory with search/filter"`

---

### Task C3: `editUser`, `deactivateUser`/`reactivateUser` (US-01.12)

**Files:** Modify `user-admin.service.ts`; Test: extend spec

**Test cases:** `editUser` updates allowed `Profile` fields only, ignores/rejects role or email
changes from this endpoint; `deactivateUser` sets `status = INACTIVE`, does not touch any other
table (history stays intact); `deactivateUser` on an already-`DELETED` user throws (no
resurrection path); `reactivateUser` sets `status = ACTIVE` only from `INACTIVE` (not from
`DELETED` — deletion is permanent per BR-012).

**Commit:** `git commit -m "feat(users): add edit/deactivate/reactivate for Super Admin"`

---

### Task C4: `deleteUser` — GDPR anonymization (US-01.13)

**Files:** Modify `user-admin.service.ts`; Test: extend spec

**Step 1: Failing tests**

```typescript
describe('UserAdminService.deleteUser', () => {
  it('should anonymize name, email, and phone while preserving the row', async () => {
    await service.deleteUser(userId, { deletedBy: adminId, reason: 'GDPR request' });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: userId },
      data: expect.objectContaining({ email: `deleted_${userId}@example.com`, status: 'DELETED' }),
    }));
    expect(prisma.profile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ firstName: 'Deleted', lastName: 'User', phone: null, photoUrl: null }),
    }));
  });

  it('should write a UserDeletionLog with the original email backed up', async () => {
    await service.deleteUser(userId, { deletedBy: adminId, reason: 'GDPR request' });
    expect(prisma.userDeletionLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ originalUserId: userId, deletedById: adminId }),
    }));
  });

  it('should reject re-deleting an already-DELETED user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: userId, status: 'DELETED' } as any);
    await expect(service.deleteUser(userId, { deletedBy: adminId })).rejects.toThrow(AppException);
  });
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**: read the user first (backup original email into `UserDeletionLog` before
overwriting it), reject if already `DELETED`, run the anonymize-update + log-insert in one
transaction, delete the stored photo file via `StorageService.delete` if present.

**Step 4: Run — expect PASS**

**Step 5: Commit:** `git commit -m "feat(users): add GDPR-compliant delete/anonymize"`

---

### Task C5: `ImpersonationService` — start/exit, dual-cookie, audit log (US-01.07)

**Files:**
- Create: `apps/backend/src/modules/impersonation/impersonation.service.ts`, `.module.ts`,
  `.controller.ts`
- Create: `apps/backend/src/modules/impersonation/guards/impersonation-session.guard.ts`
- Test: `impersonation.service.spec.ts`, `impersonation-session.guard.spec.ts`

**Step 1: Failing tests**

```typescript
describe('ImpersonationService.start', () => {
  it('should reject impersonating another Super Admin', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'x', role: 'SUPER_ADMIN' } as any);
    await expect(service.start(adminId, 'x')).rejects.toThrow(CannotImpersonateSuperAdminException);
  });

  it('should issue a token pair with impersonatedBy set and a 1-hour cap', async () => {
    const result = await service.start(adminId, targetUserId);
    const decoded = jwt.decode(result.accessToken) as any;
    expect(decoded.impersonatedBy).toBe(adminId);
    expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(60 * 60);
  });

  it('should write an ImpersonationLog row with startedAt set and endedAt null', async () => {
    await service.start(adminId, targetUserId);
    expect(prisma.impersonationLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ adminId, targetUserId }),
    }));
  });
});

describe('ImpersonationService.exit', () => {
  it('should set endedAt and durationSeconds on the open log row', async () => {
    await service.exit(logId);
    expect(prisma.impersonationLog.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: logId },
      data: expect.objectContaining({ endedAt: expect.any(Date), durationSeconds: expect.any(Number) }),
    }));
  });
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**: `start()` validates target isn't `SUPER_ADMIN`, issues a token pair via
`TokenService.issuePair(target, { impersonatedBy: adminId, refreshTtlOverride: '1h' })` (Task
B3's cap), writes the open `ImpersonationLog` row. The controller sets the impersonation token
pair on a **second, dedicated cookie name** (e.g. `impersonation_session`) distinct from the
admin's own session cookie, so the admin's real session is never overwritten — exiting just
clears the second cookie and restores the first. `exit()` closes the log row. A
logout-while-impersonating path must also close any still-open log row (don't leave a
permanently-open audit entry).

**Step 4: Run — expect PASS**

**Step 5: Commit:** `git commit -m "feat(impersonation): add start/exit with dual-cookie handoff and audit log"`

---

### Task C6: Impersonation history endpoint

**Files:** Modify `impersonation.controller.ts`, `.service.ts`; Test: extend spec

**Contract:** `GET /admin/impersonation/history` — paginated, `SUPER_ADMIN`-only, returns
admin/target names, start/end/duration.

**Commit:** `git commit -m "feat(impersonation): add audit history endpoint"`

---

## Phase D — Self-Service Profile

### Task D1: `ProfileService.getOwnProfile` / `updateOwnProfile` (US-01.11)

**Files:**
- Create: `apps/backend/src/modules/profile/profile.service.ts`, `.module.ts`, `.controller.ts`
- Test: `profile.service.spec.ts`

**Test cases:** returns the caller's own profile merged with role-specific fields (never
accepts an `:id` path param — derives from JWT, per this repo's established self-only
convention); `updateOwnProfile` accepts only whitelisted editable fields per role (rejects
`email`, `role`, `skillLevel` changes with 400, not silently ignoring them via
`class-validator`'s whitelist + `forbidNonWhitelisted`); phone-format validation via a
`class-validator` custom decorator.

**Commit:** `git commit -m "feat(profile): add self-service profile get/update"`

---

### Task D2: Profile photo upload

**Files:** Modify `profile.controller.ts` (Multer route); Test: extend spec

**Test cases:** accepts PNG/JPG under a size cap, generates a thumbnail via
`StorageService.savePhoto`, updates `Profile.photoUrl`; deletes the old photo file on replace
(no orphaned files); rejects disallowed MIME types with 400.

**Commit:** `git commit -m "feat(profile): add photo upload with thumbnail generation"`

---

## Phase E — ShareLink / Invitation System

### Task E1: `ShareLinkService.generateStaticLink` (retry-on-P2002)

**Files:**
- Create: `apps/backend/src/modules/sharelink/sharelink.service.ts`, `.module.ts`
- Test: `sharelink.service.spec.ts`

**Step 1: Failing tests**

```typescript
describe('ShareLinkService.generateStaticLink', () => {
  it('should create an unlimited-use, no-expiry STATIC link for the calling trainer', async () => {
    const link = await service.generateStaticLink(trainerId);
    expect(link.type).toBe('STATIC');
    expect(link.expiresAt).toBeNull();
    expect(link.maxUses).toBeNull();
  });

  it('should retry code generation on a unique-constraint collision, not check-then-insert', async () => {
    prisma.shareLink.create
      .mockRejectedValueOnce(prismaP2002Error())
      .mockResolvedValueOnce(fakeLink);
    const link = await service.generateStaticLink(trainerId);
    expect(prisma.shareLink.create).toHaveBeenCalledTimes(2);
    expect(link).toEqual(fakeLink);
  });
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**: generate a URL-safe random code, attempt `create`, catch Prisma `P2002` and
retry with a fresh code (bounded retry count) rather than checking existence first — this repo's
established pattern for unique-code generation races.

**Step 4: Run — expect PASS**

**Step 5: Commit:** `git commit -m "feat(sharelink): add static link generation with retry-on-collision"`

---

### Task E2: `generateUniqueLink` — coach invite (US-01.08)

**Files:** Modify `sharelink.service.ts`; Create `coach-invite.service.ts`; Test: extend + new spec

**Test cases:** single-use, 7-day-expiry `UNIQUE` link targeting a specific email; same
retry-on-P2002 pattern; `resendExpired` deactivates the superseded link before issuing a new one
(no two simultaneously-active links for the same pending invite).

**Commit:** `git commit -m "feat(sharelink): add coach-invite unique-link generation and resend"`

---

### Task E3: `GET /join/:code` + `POST /join/:code/register`

**Files:** Create `sharelink.controller.ts`, `player-registration.controller.ts`,
`player-registration.service.ts`; Test: `player-registration.service.spec.ts` +
`register-via-link.e2e-spec.ts`

**Test cases:**
- Unknown/expired/exhausted code → clear, distinct `AppException` per case (FR-018), never a
  generic 500.
- **New user** registering via a `STATIC` link: creates `User` + `PlayerProfile` +
  `TrainerPlayerAssociation` in one transaction, sends confirmation email.
- **Existing, logged-in user** clicking a *second* trainer's link: creates the association only
  (no duplicate `User` row) — assert exactly one `User` row exists for that email afterward.
- **Existing parent with children** clicking a new link: response includes a
  family-selection prompt (parent + each child); only member IDs the caller explicitly submits
  get new `TrainerPlayerAssociation` rows.
- A `STATIC` link accepted by the coach-only accept path (or vice versa) is rejected —
  `type` is checked explicitly, not inferred.
- A logged-in **child session** hitting `GET /join/:code` gets a `blocked: true` response and
  triggers the parent-notification email as a side effect of this same call (FR-026) — no
  association is created regardless of what's submitted afterward.

**Commit:** `git commit -m "feat(sharelink): add registration/association resolution for new and existing users"`

---

### Task E4: Coach accept flow + single-trainer constraint (FR-019)

**Files:** Modify `coach-invite.service.ts`; Test: extend spec

**Test cases:** accepting creates `CoachProfile(trainerId=...)` for a new user, or — for an
existing user already active under a *different* trainer — rejects with
`CoachAlreadyActiveElsewhereException` (re-checked **inside** the same transaction as the write,
not as a separate earlier read, to close the check-then-act race window); accepting under the
*same* trainer twice is idempotent, not a duplicate-row error.

**Commit:** `git commit -m "feat(sharelink): enforce single-trainer constraint on coach accept"`

---

## Phase F — Player/Parent Features

### Task F1: `PlayerProfileService.createChildProfile` (US-01.03)

**Files:**
- Create: `apps/backend/src/modules/player-profile/player-profile.service.ts`, `.module.ts`,
  `.controller.ts`
- Test: `player-profile.service.spec.ts`

**Test cases:** validates age 1–18 (derived from `birthDate`), required name/gender; creates a
child `PlayerProfile` linked to the parent (not a separate `User` row at creation time — see
Task F3 for the optional separate-login provisioning step); single-trainer parent → response
signals a Yes/No prompt is needed; multi-trainer parent → response signals a checklist is
needed; explicit "no association" leaves the child trainer-less; a same-name/age child within
the family triggers a non-blocking `duplicateWarning: true` flag in the response, not a
rejection.

**Commit:** `git commit -m "feat(player-profile): add child profile creation with trainer-selection prompt"`

---

### Task F2: `TrainerAssociationService.addChildToTrainer` / `removeChildFromTrainer` (US-01.04)

**Files:**
- Create: `apps/backend/src/modules/player-profile/trainer-association.service.ts`
- Test: `trainer-association.service.spec.ts`

**Test cases:** `addChildToTrainer` accepts either a raw ShareLink code or a trainerId already in
the parent's "My Trainers" set; `removeChildFromTrainer` soft-deletes the
`TrainerPlayerAssociation` (`status = 'REMOVED'`, row kept, not hard-deleted) and the response
signals that upcoming RSVPs need cancelling (actual RSVP cancellation is Epic-02's concern —
this service only emits the signal/event, doesn't reach into Epic-02's tables).

**Commit:** `git commit -m "feat(player-profile): add child-trainer association add/remove"`

---

### Task F3: `ChildAccountService.provisionChildLogin` (US-01.06)

**Files:**
- Create: `apps/backend/src/modules/player-profile/child-account.service.ts`
- Test: `child-account.service.spec.ts`

**Test cases:** creates a real second `User` row with `parentUserId` set and `role = PLAYER`,
linked to the existing child `PlayerProfile`; the child's `Profile` row is created too (assert
it exists post-provision — a real prior bug class in this problem space is forgetting this row);
the child account inherits no independent contact info (email may be a parent-managed alias);
`@BlockChildAccounts()`-guarded routes reject a child JWT even if the child somehow has a valid
token for that route.

**Commit:** `git commit -m "feat(player-profile): add child login provisioning as a real second User row"`

---

### Task F4: `PurchaseApprovalService` (US-01.05)

**Files:**
- Create: `apps/backend/src/modules/purchase-approval/purchase-approval.service.ts`, `.module.ts`,
  `.controller.ts`
- Test: `purchase-approval.service.spec.ts`

**Step 1: Failing tests**

```typescript
describe('PurchaseApprovalService.createApprovalRequest', () => {
  it('should always require approval for USD payments', async () => {
    const req = await service.createApprovalRequest({ childProfileId, paymentType: 'USD', amount: 20 });
    expect(req.status).toBe('PENDING');
  });

  it('should require approval for token spend by default (tokenAutoApprove=false)', async () => {
    prisma.playerProfile.findUnique.mockResolvedValue({ id: childProfileId, tokenAutoApprove: false } as any);
    const req = await service.createApprovalRequest({ childProfileId, paymentType: 'TOKEN', amount: 5 });
    expect(req.status).toBe('PENDING');
  });

  it('should auto-process token spend when tokenAutoApprove=true, sending an informational notification', async () => {
    prisma.playerProfile.findUnique.mockResolvedValue({ id: childProfileId, tokenAutoApprove: true } as any);
    const result = await service.createApprovalRequest({ childProfileId, paymentType: 'TOKEN', amount: 5 });
    expect(result.status).toBe('APPROVED');
    expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining('processed') }));
  });

  it('should set expiresAt 48 hours out', async () => {
    const req = await service.createApprovalRequest({ childProfileId, paymentType: 'USD', amount: 20 });
    expect(req.expiresAt.getTime() - req.requestedAt.getTime()).toBe(48 * 60 * 60 * 1000);
  });
});

describe('PurchaseApprovalService.expireStale', () => {
  it('should auto-deny and notify the child for requests past expiresAt with no response', async () => {
    prisma.childPurchaseApproval.findMany.mockResolvedValue([staleRequest]);
    await service.expireStale();
    expect(prisma.childPurchaseApproval.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'EXPIRED' }),
    }));
  });
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**: check `PlayerProfile.tokenAutoApprove` only for `TOKEN` payments (`USD`
always goes to `PENDING`); `approve`/`deny` require the caller to be the request's
`parentUserId`; expiry check runs lazily on read (no scheduler — matches this project's chosen
convention for every expiry, not a new cron dependency).

**Step 4: Run — expect PASS**

**Step 5: Commit:** `git commit -m "feat(purchase-approval): add child-purchase approval workflow with per-child token setting"`

---

### Task F5: `AvailabilityService` — player "Best Times" (US-01.09)

**Files:**
- Create: `apps/backend/src/modules/availability/availability.service.ts`, `.module.ts`,
  `.controller.ts`
- Test: `availability.service.spec.ts`

**Test cases:** `setAvailability(ownerType='PLAYER', ownerId, slots[])` replaces the full set for
that owner in a transaction (delete-then-insert, not additive-merge — the UI saves the whole grid
each time); a parent setting a child's availability passes the child's `PlayerProfile.id` as
`ownerId`, distinct from their own (403 if the child doesn't belong to the caller's family);
`getAvailabilitySummary(playerId)` returns a human-readable string like `"Mon 5-8pm, Wed 6-9pm"`
for the trainer roster view; `filterByAvailability(trainerId, dayOfWeek, time)` returns only
players available at that slot, scoped to that trainer's own roster.

**Commit:** `git commit -m "feat(availability): add player Best Times set/summary/filter"`

---

## Phase G — Coach Features

### Task G1: Coach "My Times" (reuses `AvailabilityService`, `ownerType='COACH'`) (US-01.10)

**Files:** Modify `availability.controller.ts` — coach-facing route; Test: extend e2e

**Test cases:** a coach can save multiple time ranges per day (e.g. Monday 4–6pm AND 7–9pm) —
assert the stored `Availability` rows are two distinct rows for the same `dayOfWeek`, not one
merged/overwritten row.

**Commit:** `git commit -m "feat(availability): expose My Times for coaches"`

---

### Task G2: `CoachAvailabilityOverrideService` — conflict check + override (stub, G-3)

**Files:**
- Create: `apps/backend/src/modules/coach-profile/coach-availability-override.service.ts`
- Create: `POST /coach/:id/conflict-check`, `POST /coach/:id/override` (stub controllers —
  `eventId` optional/nullable until Epic-02 exists)
- Test: `coach-availability-override.service.spec.ts`

**Test cases:** `checkConflict(coachId, dayOfWeek, startTime, endTime)` returns
`{ conflict: boolean }` by comparing against the coach's stored `Availability`; `recordOverride`
requires a non-empty `reason` string (rejects empty/whitespace-only with 400) and writes
`coachId`, `trainerId`, `overriddenBy`, `reason`, `timestamp`; the coach is never blocked from
being assigned — this only logs, it never throws to prevent the assignment itself.

**Commit:** `git commit -m "feat(coach-profile): add availability-conflict check and override logging (stub ahead of Epic-02)"`

---

### Task G3: `CoachProfileService` — public profile (FR-031)

**Files:**
- Create: `apps/backend/src/modules/coach-profile/coach-profile.service.ts`, `.controller.ts`
- Test: `coach-profile.service.spec.ts`

**Test cases:** `updatePublicProfile` sets bio/credentials/certifications/`publicVisible`;
`publicSlug` is lazily generated on first `publicVisible=true` (human-readable, retry-on-P2002
for collisions — same pattern as ShareLink codes); `GET /coach/public/:slug` returns a **uniform
404** for "slug doesn't exist," "profile exists but not public," and "coach's `User.status !==
'ACTIVE'`" (gate on real user status, not a vestigial profile-level flag, so a deactivated/
deleted coach's public page disappears immediately) — anti-enumeration, no way to distinguish
the three cases from the response.

**Commit:** `git commit -m "feat(coach-profile): add public profile with anti-enumeration slug lookup"`

---

## Phase H — Trainer Features

### Task H1: `TrainerRosterService` — planning view (FR-032, FR-034)

**Files:**
- Create: `apps/backend/src/modules/trainer-roster/trainer-roster.service.ts`, `.controller.ts`
- Test: `trainer-roster.service.spec.ts`

**Test cases:** `listOwnPlayers(trainerId)`/`listOwnCoaches(trainerId)` scope strictly to the
caller's `trainerId` from the JWT — a second trainer's players never appear, verified by a test
asserting the query's `where` clause includes `trainerId`, not just that the mock returns the
right rows (a mocked-response-only test wouldn't catch a missing `WHERE` clause); availability
filter (`GET /trainer/players/availability?day=&time=`) delegates to
`AvailabilityService.filterByAvailability`.

**Commit:** `git commit -m "feat(trainer-roster): add own-org player/coach roster with availability filter"`

---

### Task H2: `BrandingService` — logo + color (US-01.14, G-5)

**Files:**
- Create: `apps/backend/src/modules/branding/branding.service.ts`, `.controller.ts`
- Test: `branding.service.spec.ts`

**Test cases:** `uploadLogo` accepts only PNG/JPG (content-sniffs the actual bytes, not just the
declared MIME type — closes the extension-spoofing gap — and rejects SVG explicitly per G-5);
rejects files over 2MB; resizes to the recommended 200×200 via `sharp` if larger;
`setPrimaryColor` validates hex-code format; `getBranding` is publicly readable (any user in
that trainer's org, not just the trainer) so the header can render it for players/coaches too.

**Commit:** `git commit -m "feat(branding): add logo upload (PNG/JPG only) and primary color selection"`

---

## Phase I — Camp-to-User Conversion Stub (G-2)

### Task I1: `CampConversionService.createPrefillDraft` (stub)

**Files:**
- Create: `apps/backend/src/modules/camp-conversion/camp-conversion.service.ts`, `.controller.ts`
- Test: `camp-conversion.service.spec.ts`

**Contract:** `createPrefillDraft(payload: CampSubmissionPrefill): Promise<{ draftToken: string }>`
— accepts a generic prefill shape (name, email, player name/age/gender — the fields Epic-08's
eventual submission is expected to carry), stores it keyed by a short-lived `draftToken`, and
`GET /auth/register?draftToken=...` (extends Task B1's registration form contract) pre-fills the
registration form from it. **Test cases:** draft expires after 24h (matching the
email-verification token pattern) if never consumed; consuming a draft auto-associates the
resulting account with the trainer named in the payload, reusing Task E3's existing
new-user-registration + association code path rather than duplicating it.

**Commit:** `git commit -m "feat(camp-conversion): add stub prefill-draft integration point for Epic-08"`

---

## Phase J — Frontend

### Task J1: API client + endpoint modules

**Files:**
- Create: `apps/frontend/src/api/client.ts` (axios wrapper, attaches access token, refreshes on
  401 once then retries)
- Create: one file per backend module under `apps/frontend/src/api/endpoints/` (`auth.ts`,
  `admin-users.ts`, `admin-impersonation.ts`, `profile.ts`, `sharelinks.ts`,
  `player-profiles.ts`, `purchase-approvals.ts`, `availability.ts`, `coach.ts`,
  `trainer-roster.ts`, `branding.ts`)
- Test: `client.test.tsx` (Vitest) — 401 triggers exactly one refresh-then-retry, not an
  infinite loop

**Commit:** `git commit -m "feat(frontend): add API client and endpoint modules"`

---

### Task J2: Auth pages

**Files:**
- Create: `apps/frontend/src/pages/LoginPage.tsx`, `RegisterPage.tsx` (player/parent + optional
  child block), `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `VerifyEmailPage.tsx`
- Test: one `.test.tsx` per page

**Design ref:** `tasks/TASK-008/frontend-design-spec.md` → "Auth pages" section (single-column
max-480px, `EMAIL_NOT_VERIFIED` gets its own recoverable-action banner, child sub-form reuses
`UserCreateModal`'s 150ms slide-open pattern).

**Test cases:** `LoginPage` shows the specific "verify your email" banner (with a resend action)
when the API returns `EMAIL_NOT_VERIFIED` — not a generic error; `RegisterPage` renders the child
sub-form only when "I'm registering my child" is toggled; `ResetPasswordPage` shows an actionable
message on an expired-token response with a link back to request a new one; forgot-password
success copy is identical regardless of whether the email existed.

**Commit:** `git commit -m "feat(frontend): add auth pages (login, register, password reset, verify email)"`

---

### Task J3: Role-based dashboard routing

**Files:**
- Create: `apps/frontend/src/routes/PrivateRoute.tsx`, `RoleDashboardRedirect.tsx`
- Modify: `App.tsx`
- Test: `RoleDashboardRedirect.test.tsx`

**Test cases:** each of the 4 roles redirects to its own first substantive page (Admin → Users
list; Trainer → Roster; Coach → My Times; Player/Parent → Player Profiles — no separate
"dashboard home" concept, per `frontend-design-spec.md`); an unauthenticated visit to any private
route redirects to `/login`, preserving the intended destination for post-login redirect.

**Commit:** `git commit -m "feat(frontend): add role-based dashboard routing"`

---

### Task J4: Super Admin pages

**Files:**
- Create: `apps/frontend/src/pages/admin/UsersListPage.tsx` (`LedgerTable`, search/filter/
  paginate, Create-User modal, Deactivate/Delete confirm modals), `ImpersonateConfirmModal.tsx`,
  `ImpersonationBanner.tsx` (sticky, `--color-alert` fill), `ImpersonationHistoryPage.tsx`
- Test: one `.test.tsx` per component/page

**Design ref:** `frontend-design-spec.md` → "Admin" section — `--color-alert` is reserved for
impersonation only, everywhere else uses `--color-cinder`.

**Test cases:** `UsersListPage`'s Deactivate/Delete confirm modals show the exact spec-mandated
warning copy (US-01.12/US-01.13); `ImpersonationBanner` renders only when the access token
decodes an `impersonatedBy` claim, and its "Exit" button clears only the impersonation cookie
(assert the admin's own session cookie is untouched — integration test against the mocked
API layer, not just a unit render).

**Commit:** `git commit -m "feat(frontend): add Super Admin users list, impersonation banner, and history page"`

---

### Task J5: Profile edit page (role-aware)

**Files:** Create `apps/frontend/src/pages/ProfileEditPage.tsx`; Test: `.test.tsx`

**Test cases:** renders the correct field set per `user.role` (Player: school/jersey/photo;
Coach: bio/credentials/certifications/public-profile `Switch`; Trainer: business name/org
details); email/role/skillLevel/created-date fields render as static `text-label` rows, never as
editable or disabled inputs.

**Commit:** `git commit -m "feat(frontend): add role-aware profile edit page"`

---

### Task J6: ShareLink pages

**Files:**
- Create: `apps/frontend/src/pages/trainer/ShareLinkGenerationModal.tsx`,
  `CoachInvitationStatusList.tsx`, `pages/JoinLandingPage.tsx`
- Test: one `.test.tsx` per component

**Test cases:** `JoinLandingPage` shows the family-selection checklist (Self + each child)
exactly when the API response signals it's needed, with "Self" pre-checked by default;
`CoachInvitationStatusList` shows Pending/Accepted/Expired with a Resend action visible only on
Expired; a logged-in child hitting the landing page sees the "ask your parent" message, not a
registration form.

**Commit:** `git commit -m "feat(frontend): add ShareLink generation, invite status, and join landing pages"`

---

### Task J7: Player/Parent pages

**Files:**
- Create: `apps/frontend/src/pages/player/PlayerProfilesPage.tsx` (list + Add-Child modal +
  family/trainer-associations panel), `nav/ContextSwitcher.tsx` (Locker Nameplate Flip; parent
  "Me"+children ↔ trainer variant; child variant with no "Me" section),
  `PendingApprovalsPage.tsx`, `BestTimesPage.tsx` (availability grid, per-child via the switcher)
- Test: one `.test.tsx` per component, plus an integration test proving `PlayerProfilesPage`
  actually wires the Add-Child modal → submit → refetch flow together (not just that each
  child component renders in isolation)

**Test cases:** `ContextSwitcher` renders the child variant (trainer list only, no "Me") when
the logged-in user's own `parentUserId` is set; `PendingApprovalsPage` shows Approve/Deny actions
only to the `parentUserId` on the request, never to the child.

**Commit:** `git commit -m "feat(frontend): add player/parent profiles, context switcher, approvals, Best Times pages"`

---

### Task J8: Coach pages

**Files:**
- Create: `apps/frontend/src/pages/coach/MyTimesPage.tsx`, `CoachPublicProfilePage.tsx`
  (deliberately outside the authenticated app shell — a real public page)
- Test: one `.test.tsx` per page

**Test cases:** `MyTimesPage` supports adding a second time range to the same day without
clearing the first; `CoachPublicProfilePage` renders the same not-found copy for a 404 slug
response regardless of the underlying reason (matches the API's uniform-404 contract).

**Commit:** `git commit -m "feat(frontend): add coach My Times and public profile pages"`

---

### Task J9: Trainer pages

**Files:**
- Create: `apps/frontend/src/pages/trainer/TrainerRosterPage.tsx` (availability filter),
  `TrainerBrandingPage.tsx` (logo upload w/ client-side `.svg` rejection + preview, color picker
  w/ live preview, reset-to-default), `layout/AppHeader.tsx` + `BrandingProvider.tsx`
- Test: one `.test.tsx` per page/component

**Test cases:** `TrainerBrandingPage` rejects an `.svg` file client-side with a clear message
before ever hitting the API (defense in depth alongside the backend's own rejection);
`BrandingProvider` re-fetches and updates the header live when branding changes, without a full
page reload; a multi-trainer player's active context never leaks one trainer's `primaryColorHex`
into another trainer's context.

**Commit:** `git commit -m "feat(frontend): add trainer roster and branding pages with persistent app shell"`

---

## Phase K — Cross-Cutting Testing & Hardening

### Task K1: E2E — full ShareLink registration flows

**Files:** Create `apps/backend/test/register-via-link.e2e-spec.ts`,
`family-child-profiles-and-associations.e2e-spec.ts`

**Covers:** new-account registration; existing-account second-trainer association; multi-trainer
family selection; add/remove child-trainer association by code and by id. Mint JWTs via
`TokenService.issuePair()` directly for any spec touching more than 5 distinct logins, to avoid
tripping the 5/60s login throttle across many test users.

**Commit:** `git commit -m "test(e2e): cover ShareLink registration and family-association flows"`

---

### Task K2: E2E — admin lifecycle, impersonation, coach invite

**Files:** Create `apps/backend/test/admin-users-lifecycle.e2e-spec.ts`,
`impersonation.e2e-spec.ts`, `coach-invite-concurrency.e2e-spec.ts`

**Covers:** create-trainer → deactivate → reactivate → delete/anonymize preserving historical
joins; Super-Admin impersonate → exit, including the dual-cookie assertion (admin's own cookie
unchanged) and the self/nested-impersonation rejection; concurrent coach-invite-accept race
against the single-trainer constraint (real Postgres row-locking, not a mocked race).

**Commit:** `git commit -m "test(e2e): cover admin lifecycle, impersonation, and coach-invite concurrency"`

---

### Task K3: Security tests — cross-trainer isolation, child-session blocking

**Files:** Create `apps/backend/test/multi-tenancy-isolation.e2e-spec.ts`,
`child-account-guard.e2e-spec.ts`

**Covers:** Trainer A's token can never read Trainer B's roster/branding/ShareLinks (assert 403/
404, not just "empty list" — verify seeded data actually exists for Trainer B first, so an empty
result can't coincidentally look like correct scoping); every `@BlockChildAccounts()` route
returns 403 `CHILD_ACCOUNT_RESTRICTED` for a real child JWT, checked at the API level directly.

**Commit:** `git commit -m "test(security): cover multi-tenancy isolation and child-account route blocking"`

---

### Task K4: Performance — pagination + concurrent ShareLink load

**Files:** Create `apps/backend/test/user-list-pagination.e2e-spec.ts` (seed 10k users, assert
<3s), `sharelink-concurrent-registration.e2e-spec.ts` (100 concurrent registrations against one
STATIC link, assert no duplicate/lost associations and <2s per request)

**Commit:** `git commit -m "test(perf): cover 10k-user pagination and concurrent ShareLink registration"`

---

### Task K5: Accessibility pass

**Files:** Extend existing `.test.tsx` files with keyboard-navigation assertions for:
registration form, child-profile modal, availability grids (Best Times + My Times), branding
page — WCAG 2.1 AA per `frontend-design-spec.md`'s responsive/a11y notes.

**Commit:** `git commit -m "test(a11y): add keyboard-navigation and contrast checks for new forms"`

---

## Execution Handoff

**Plan complete and saved to `tasks/TASK-008/writing-plans-plan.md`.** The isolated workspace
already exists and is verified clean:

- **Path:** `.worktrees/TASK-008`
- **Branch:** `feature/TASK-008`
- **Scaffold commit:** `4baeac5` (backend build/lint/unit-test and frontend build/lint/test all
  passing)

Ready to start implementation directly in that worktree:

- `/coder` `[TASK-008 context]` — backend, starting at Task A1 (Prisma schema is the one file
  already scaffolded but needs its real content).
- `/coder-frontend` `[TASK-008 context]` — frontend, starting at Task J1, run in parallel with
  backend since Phase J only depends on API *contracts* (already fixed in `api-designer-spec.md`),
  not on the backend actually being implemented yet.
