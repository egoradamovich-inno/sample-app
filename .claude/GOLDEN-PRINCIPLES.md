# Golden Principles — Style Invariants

Taste as invariant. These are non-negotiable style rules for all generated code.

## Naming

- Files: `kebab-case` for all source files (`user-service.ts`, not `UserService.ts`)
- Classes: `PascalCase` (`UserService`, `CreateUserDto`)
- Functions/methods: `camelCase` (`findById`, `createUser`)
- Constants: `UPPER_SNAKE_CASE` (`MAX_RETRIES`, `API_BASE_URL`)
- Booleans: prefix with `is/has/can/should` (`isActive`, `hasPermission`)
- Event handlers: prefix with `handle` (`handleClick`, `handleSubmit`)

## TypeScript Strictness

- No `any` — use `unknown` + type guard if type is uncertain
- No `!` non-null assertion — handle null/undefined explicitly
- Explicit return types on exported functions
- Use `readonly` for data that shouldn't mutate
- Prefer `interface` for object shapes, `type` for unions/intersections

## Error Handling

- Throw domain-specific exceptions (`NotFoundException`, `ConflictException`)
- Never swallow errors with empty catch blocks
- Log errors with context (what operation, what input)
- At boundaries (controllers, API handlers): catch and return structured error response
- Internal code: let errors propagate to boundary handlers

## Imports

- Group: 1) framework/lib, 2) internal modules, 3) relative imports
- No barrel imports from index files (import directly from source)
- No circular imports — if needed, refactor to break the cycle

## Test Structure

- One `describe` per unit under test
- Test names: `should {expected behavior} when {condition}`
- Arrange-Act-Assert pattern (AAA)
- One assertion concept per test (multiple expects OK if testing same thing)
- No test interdependence — each test sets up its own state

## Code Organization

- One class per file (except small helpers tightly coupled to the main class)
- Max function length: ~30 lines — extract if longer
- Max file length: ~300 lines — split if longer
- Early returns over nested conditionals
- Prefer composition over inheritance
