---
name: test-generator
description: Generate comprehensive tests (unit, integration, E2E) and run test suites with failure analysis. Use for writing tests, test coverage, running tests, and fixing failures. Triggers on "write test", "create test", "run tests", "fix test", "test coverage", "e2e test".
phase: execution
flow-next: documentation-generator
flow-alternatives: [systematic-debugger]
related: [code-reviewer, systematic-debugger]
---

# Test Generator

## Overview

Generate comprehensive tests (unit, integration, E2E) following project patterns and TDD principles.

## Generated File Naming Convention (MANDATORY)

**ANY documentation or markdown file created by this skill MUST be prefixed with `test-generator-`:**
- ✅ `test-generator-coverage-report.md`, `test-generator-strategy.md`
- ❌ `COVERAGE_REPORT.md`, `TEST_STRATEGY.md`

This applies to ALL generated documentation files — reports, summaries, strategies.
Test source files (`.spec.ts`, `.test.tsx`) follow standard project naming conventions and are exempt.

## Test Types Decision Tree

```
What are you testing?
        │
        ├── Single unit (handler, service, utility)?
        │   └── Unit Test
        │
        ├── Database/API interaction?
        │   └── Integration Test
        │
        └── User workflow across system?
            └── E2E Test
```

## Unit Tests

### Command Handler Test

```typescript
import { Test } from '@nestjs/testing';
import { CreateUserHandler } from './create-user.handler';
import { CreateUserCommand } from './create-user.command';
import { IUserUnitOfWork, UserUnitOfWorkKey } from '../../domain/interfaces';

describe('CreateUserHandler', () => {
  let handler: CreateUserHandler;
  let mockUnitOfWork: jest.Mocked<IUserUnitOfWork>;
  let mockUserRepo: jest.Mocked<IUserRepository>;

  beforeEach(async () => {
    mockUserRepo = {
      emailExists: jest.fn(),
      save: jest.fn(),
      findOneById: jest.fn(),
    };

    mockUnitOfWork = {
      getUserRepository: jest.fn().mockReturnValue(mockUserRepo),
      execute: jest.fn().mockImplementation((fn) => fn()),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreateUserHandler,
        { provide: UserUnitOfWorkKey, useValue: mockUnitOfWork },
      ],
    }).compile();

    handler = module.get(CreateUserHandler);
  });

  describe('handle', () => {
    it('should create user when email is unique', async () => {
      mockUserRepo.emailExists.mockResolvedValue(false);
      mockUserRepo.save.mockImplementation(async (user) => {
        user.id = 1;
      });

      const command = new CreateUserCommand({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      const result = await handler.handle(command);

      expect(result).toBe(1);
      expect(mockUserRepo.emailExists).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when email exists', async () => {
      mockUserRepo.emailExists.mockResolvedValue(true);

      const command = new CreateUserCommand({
        email: 'existing@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      await expect(handler.handle(command)).rejects.toThrow(ConflictException);
    });
  });
});
```

### Query Handler Test

```typescript
describe('GetUserHandler', () => {
  let handler: GetUserHandler;
  let mockUnitOfWork: jest.Mocked<IUserUnitOfWork>;

  beforeEach(async () => {
    // ... setup similar to command handler
  });

  it('should return user when found', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };
    mockUserRepo.findOneById.mockResolvedValue(mockUser);

    const result = await handler.handle(new GetUserQuery(1));

    expect(result).toEqual(mockUser);
  });

  it('should throw NotFoundException when user not found', async () => {
    mockUserRepo.findOneById.mockResolvedValue(null);

    await expect(handler.handle(new GetUserQuery(999)))
      .rejects.toThrow(NotFoundException);
  });
});
```

## Integration Tests

### Repository Test

```typescript
describe('UserRepository (Integration)', () => {
  let repository: UserRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    repository = new UserRepository(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true); // Reset DB
  });

  it('should save and find user', async () => {
    const user = new User();
    user.email = 'test@example.com';
    user.firstName = 'John';
    user.lastName = 'Doe';

    await repository.save(user);

    const found = await repository.findOneById(user.id.toString());
    expect(found).toBeDefined();
    expect(found?.email).toBe('test@example.com');
  });
});
```

## E2E Tests

### API Endpoint Test

```typescript
describe('UserController (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /users', () => {
    it('should create a new user', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.email).toBe('test@example.com');
        });
    });

    it('should return 400 for invalid email', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'invalid-email',
          firstName: 'John',
          lastName: 'Doe',
        })
        .expect(400);
    });
  });
});
```

## Test Commands

```bash
# Run all tests
npx nx test backend

# Run specific test file
npx nx test backend -- --testPathPattern=user.spec.ts

# Run with coverage
npx nx test backend -- --coverage

# Watch mode
npx nx test backend -- --watch

# Run E2E tests
npx nx e2e backend-e2e
```

## Test Organization

```
__tests__/
├── factories/     # Create test data
│   └── user.factory.ts
├── fakers/        # Generate random data
│   └── user.faker.ts
└── mocks/         # Mock implementations
    └── user-repository.mock.ts
```

### Factory Example

```typescript
// __tests__/factories/user.factory.ts
export function createMockUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = 1;
  user.email = 'test@example.com';
  user.firstName = 'John';
  user.lastName = 'Doe';
  return { ...user, ...overrides };
}
```

## Pre-Completion Verification

Run applicable checks from [DOD.md](../../DOD.md) (Standard tier):
- Run all generated tests — verify they pass
- Run lint on test files (if lint tooling exists)
- Verify test file naming follows project conventions
- If tests fail, fix or escalate to `/debugger`
- Include pass/fail evidence in Context Summary

## Quality Checklist

- [ ] Tests are independent (no shared state)
- [ ] Tests have descriptive names
- [ ] Each test tests one thing
- [ ] Edge cases covered
- [ ] Error cases covered
- [ ] Mocks used appropriately
- [ ] No flaky tests

---

## Next Steps

After tests are generated, STOP and present these options:

**Next by flow:** [[/debugger]] `[context]` - Debug any failing tests to find root cause. See [[moc-execution]] for phase context.

**Alternatives:**
- [[/docs-generator]] `[context]` - Update documentation if all tests pass.
- [[/finishing-branch]] `[context]` - Complete the branch if all tests pass.
- [[/coder]] `[context]` - Fix implementation issues found during testing.
