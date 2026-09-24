# Design: User Authentication

## Architecture Decision

**Chosen approach:** JWT with refresh token rotation

**Why:** Stateless authentication scales better than sessions. Refresh rotation prevents token theft replay.

## Component Design

```
AuthModule
├── AuthController     — login, register, refresh endpoints
├── AuthService        — business logic, token generation
├── AuthGuard          — route protection middleware
├── UserRepository     — user CRUD operations
└── TokenService       — JWT sign/verify, refresh rotation
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /auth/register | Create new user |
| POST | /auth/login | Authenticate, return tokens |
| POST | /auth/refresh | Rotate refresh token |
| POST | /auth/logout | Invalidate refresh token |

## Security Considerations

- Passwords hashed with bcrypt (cost factor 12)
- Refresh tokens stored hashed in DB
- Rate limiting on login endpoint (10 req/min per IP)
