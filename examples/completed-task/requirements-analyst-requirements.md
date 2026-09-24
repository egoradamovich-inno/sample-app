# Requirements: User Authentication

## Functional Requirements

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| FR-1 | Users can register with email/password | HIGH | User story US-001 |
| FR-2 | Users can log in and receive JWT token | HIGH | User story US-002 |
| FR-3 | JWT tokens expire after 15 minutes | MEDIUM | Security policy |
| FR-4 | Refresh tokens valid for 7 days | MEDIUM | Security policy |

## Business Rules

- Email must be unique across all users
- Password must be at least 8 characters with 1 uppercase, 1 number
- Failed login attempts: lock account after 5 attempts for 15 minutes

## Task Breakdown

1. Create User entity and migration
2. Implement registration endpoint with validation
3. Implement login endpoint with JWT generation
4. Add refresh token rotation
5. Add account lockout logic

## Gap Analysis

- No requirements for OAuth/social login — confirm if needed
- No mention of email verification — recommend adding
