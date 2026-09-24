# Implementation Plan: User Authentication

## Tasks

### Task 1: Create User Entity
**Files:** `backend/src/users/entities/user.entity.ts`, migration file
**Steps:**
1. Create User entity with fields: id, email, passwordHash, isLocked, failedAttempts, lockedUntil
2. Generate migration: `npx nx run backend:migration:generate -- -n CreateUser`
3. Run migration: `npx nx run backend:migration:run`
**Verify:** Migration runs without errors, table exists in DB

### Task 2: Implement Registration
**Files:** `backend/src/auth/auth.controller.ts`, `auth.service.ts`, `dto/register.dto.ts`
**Steps:**
1. Create RegisterDto with class-validator decorators
2. Implement AuthService.register() — hash password, save user
3. Add POST /auth/register endpoint
**Verify:** `curl -X POST localhost:3000/auth/register -d '{"email":"test@test.com","password":"Test1234"}'` returns 201

### Task 3: Implement Login
**Files:** `backend/src/auth/auth.service.ts`, `dto/login.dto.ts`, `token.service.ts`
**Steps:**
1. Create LoginDto
2. Implement TokenService — sign JWT, create refresh token
3. Implement AuthService.login() — verify password, generate tokens
4. Add POST /auth/login endpoint
**Verify:** Login returns `{ accessToken, refreshToken }`, token decodes correctly

### Task 4: Add Auth Guard
**Files:** `backend/src/auth/auth.guard.ts`
**Steps:**
1. Create JwtAuthGuard extending NestJS AuthGuard
2. Apply to protected routes
**Verify:** Protected endpoint returns 401 without token, 200 with valid token

### Task 5: Write Tests
**Files:** `backend/src/auth/__tests__/`
**Steps:**
1. Unit tests for AuthService (register, login, refresh)
2. Unit tests for TokenService
3. E2E test for full auth flow
**Verify:** All tests pass, coverage > 80%
