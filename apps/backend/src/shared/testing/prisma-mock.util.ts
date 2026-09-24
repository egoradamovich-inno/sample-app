/**
 * Builds a jest-mocked stand-in for PrismaService, covering every model
 * delegate used across this epic's services plus a `$transaction` that (by
 * default) just invokes the callback with the same mock — matching the
 * common "transaction callback receives a tx client" Prisma usage pattern.
 * Individual tests override whichever `mockResolvedValue`/`mockImplementation`
 * they need, or `toHaveBeenCalledWith(expect.objectContaining(...))` to
 * inspect call shape without pulling untyped values out of `.mock.calls`.
 */
export interface PrismaDelegateMock {
  findUnique: jest.Mock;
  findUniqueOrThrow: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
}

export interface MockPrismaService {
  user: PrismaDelegateMock;
  profile: PrismaDelegateMock;
  trainerProfile: PrismaDelegateMock;
  branding: PrismaDelegateMock;
  coachProfile: PrismaDelegateMock;
  playerProfile: PrismaDelegateMock;
  refreshToken: PrismaDelegateMock;
  emailVerificationToken: PrismaDelegateMock;
  passwordResetToken: PrismaDelegateMock;
  shareLink: PrismaDelegateMock;
  trainerPlayerAssociation: PrismaDelegateMock;
  availability: PrismaDelegateMock;
  coachAvailabilityOverride: PrismaDelegateMock;
  impersonationLog: PrismaDelegateMock;
  childPurchaseApproval: PrismaDelegateMock;
  userDeletionLog: PrismaDelegateMock;
  $transaction: jest.Mock;
}

function createDelegate(): PrismaDelegateMock {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  };
}

export function createMockPrismaService(): MockPrismaService {
  const mock: MockPrismaService = {
    user: createDelegate(),
    profile: createDelegate(),
    trainerProfile: createDelegate(),
    branding: createDelegate(),
    coachProfile: createDelegate(),
    playerProfile: createDelegate(),
    refreshToken: createDelegate(),
    emailVerificationToken: createDelegate(),
    passwordResetToken: createDelegate(),
    shareLink: createDelegate(),
    trainerPlayerAssociation: createDelegate(),
    availability: createDelegate(),
    coachAvailabilityOverride: createDelegate(),
    impersonationLog: createDelegate(),
    childPurchaseApproval: createDelegate(),
    userDeletionLog: createDelegate(),
    $transaction: jest.fn(),
  };

  mock.$transaction.mockImplementation((arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: MockPrismaService) => unknown)(mock);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return Promise.resolve(arg);
  });

  return mock;
}

/**
 * Type-safe extraction of a jest.fn() call argument, avoiding the
 * `no-unsafe-member-access` lint noise of indexing `.mock.calls` (typed
 * `any[][]` by default) directly in every spec.
 */
export function getMockCallArg<T>(
  mockFn: jest.Mock,
  callIndex = 0,
  argIndex = 0,
): T {
  const calls = mockFn.mock.calls as unknown[][];
  return calls[callIndex][argIndex] as T;
}

/**
 * Prisma's unique-constraint-violation error shape, for retry-on-P2002
 * tests. Pass `target` (the column(s) the violated unique index covers,
 * e.g. `['email']` or `['userId']`) for tests that need to assert
 * different handling per which constraint actually collided.
 */
export function prismaP2002Error(
  target?: string[],
): Error & { code: string; meta?: { target?: string[] } } {
  const error = new Error('Unique constraint failed') as Error & {
    code: string;
    meta?: { target?: string[] };
  };
  error.code = 'P2002';
  if (target) {
    error.meta = { target };
  }
  return error;
}

/**
 * Prisma's "record to update/delete not found" error shape, for tests
 * covering the record-doesn't-exist path of a bare `.update()`/`.delete()`.
 */
export function prismaP2025Error(): Error & { code: string } {
  const error = new Error(
    'An operation failed because it depends on one or more records that were required but not found.',
  ) as Error & { code: string };
  error.code = 'P2025';
  return error;
}
