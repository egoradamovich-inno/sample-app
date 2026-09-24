# Reference: PR Description Format

Use this format when creating pull requests via `/finishing-branch`.

---

## Summary
- Implement JWT authentication with refresh token rotation
- Add registration, login, refresh, and logout endpoints
- Include auth guard middleware for protected routes

## Changes
- **New:** `AuthModule` with controller, service, guard, and token service
- **New:** `User` entity with migration
- **New:** DTOs with class-validator decorators
- **Modified:** `AppModule` to import `AuthModule`

## Test Plan
- [ ] Unit tests pass: `npx nx test backend -- --testPathPattern=auth`
- [ ] E2E tests pass: `npx nx e2e backend-e2e -- --testPathPattern=auth`
- [ ] Manual test: register -> login -> access protected route -> refresh -> logout
- [ ] Verify: expired token returns 401
- [ ] Verify: locked account after 5 failed attempts
