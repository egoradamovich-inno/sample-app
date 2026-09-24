import {
  createMockPrismaService,
  getMockCallArg,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { ChildAccountService } from './child-account.service';

const parentUserId = 'parent-1';
const childProfileId = 'child-pp-1';

describe('ChildAccountService.provisionChildLogin', () => {
  let service: ChildAccountService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new ChildAccountService(prisma as never);
    prisma.playerProfile.findFirst.mockResolvedValue({
      id: childProfileId,
      parentUserId,
      isChild: true,
      userId: null,
      displayName: 'Alex Smith',
    });
    prisma.user.create.mockResolvedValue({ id: 'child-user-1' });
  });

  it('should reject when the child profile does not belong to the caller', async () => {
    prisma.playerProfile.findFirst.mockResolvedValue(null);
    await expect(
      service.provisionChildLogin(
        parentUserId,
        childProfileId,
        {
          email: 'kid@x.com',
          password: 'Passw0rd!',
        },
        false,
      ),
    ).rejects.toThrow();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('should reject when the child already has a login provisioned', async () => {
    prisma.playerProfile.findFirst.mockResolvedValue({
      id: childProfileId,
      parentUserId,
      isChild: true,
      userId: 'already-exists',
      displayName: 'Alex Smith',
    });

    await expect(
      service.provisionChildLogin(
        parentUserId,
        childProfileId,
        {
          email: 'kid@x.com',
          password: 'Passw0rd!',
        },
        false,
      ),
    ).rejects.toThrow();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('should reject when the caller is a child account', async () => {
    await expect(
      service.provisionChildLogin(
        parentUserId,
        childProfileId,
        {
          email: 'kid@x.com',
          password: 'Passw0rd!',
        },
        true,
      ),
    ).rejects.toThrow('not available to a child account');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('should create a real second User row with parentUserId set, and a Profile row', async () => {
    await service.provisionChildLogin(
      parentUserId,
      childProfileId,
      {
        email: 'kid@x.com',
        password: 'Passw0rd!',
      },
      false,
    );

    const createArgs = getMockCallArg<{
      data: {
        email: string;
        parentUserId: string;
        profile: { create: { firstName: string; lastName: string } };
      };
    }>(prisma.user.create);
    expect(createArgs.data.email).toBe('kid@x.com');
    expect(createArgs.data.parentUserId).toBe(parentUserId);
    expect(createArgs.data.profile.create.firstName).toBe('Alex');
  });

  it('should link the new user to the existing PlayerProfile via userId', async () => {
    await service.provisionChildLogin(
      parentUserId,
      childProfileId,
      {
        email: 'kid@x.com',
        password: 'Passw0rd!',
      },
      false,
    );

    expect(prisma.playerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: childProfileId },
        data: { userId: 'child-user-1' },
      }),
    );
  });
});
