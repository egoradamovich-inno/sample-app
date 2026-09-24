# Reference: Context Summary Format

Every agent must output this format when completing a skill.

---

## Context Summary

Implemented JWT authentication with refresh token rotation in `AuthModule`. Created registration and login endpoints with bcrypt password hashing, JWT access tokens (15min), and refresh token rotation (7 days). All 12 unit tests and 4 E2E tests pass. Lint clean. Build succeeds.

## Next Steps

**Next by flow:** `/code-reviewer Review the AuthModule implementation in backend/src/auth/ — JWT with refresh rotation, 4 endpoints, auth guard middleware`

**Alternatives:**
- `/test-generator Add edge case tests for token expiration and account lockout in backend/src/auth/`
- `/docs-generator Update API documentation for new auth endpoints`
