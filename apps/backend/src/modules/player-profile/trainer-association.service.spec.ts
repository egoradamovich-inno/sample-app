import { ShareLinkType } from '../../../generated/prisma/enums';
import {
  createMockPrismaService,
  MockPrismaService,
} from '../../shared/testing/prisma-mock.util';
import { PlayerProfileService } from './player-profile.service';
import { TrainerAssociationService } from './trainer-association.service';

const parentUserId = 'parent-1';
const playerProfileId = 'pp-1';

describe('TrainerAssociationService.addTrainerAssociation', () => {
  let service: TrainerAssociationService;
  let prisma: MockPrismaService;
  let playerProfileService: PlayerProfileService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    playerProfileService = new PlayerProfileService(prisma as never);
    service = new TrainerAssociationService(
      prisma as never,
      playerProfileService,
    );
    prisma.playerProfile.findFirst.mockResolvedValue({
      id: playerProfileId,
      parentUserId,
    });
    prisma.playerProfile.findUnique.mockResolvedValue({
      id: playerProfileId,
      displayName: 'Alex',
      birthDate: null,
      isChild: true,
    });
    prisma.trainerPlayerAssociation.findMany.mockResolvedValue([]);
    prisma.trainerPlayerAssociation.findFirst.mockResolvedValue(null);
  });

  it('should reject when the player profile does not belong to the caller', async () => {
    prisma.playerProfile.findFirst.mockResolvedValue(null);

    await expect(
      service.addTrainerAssociation(
        parentUserId,
        playerProfileId,
        { trainerId: 'trainer-1' },
        false,
      ),
    ).rejects.toThrow();
    expect(prisma.trainerPlayerAssociation.create).not.toHaveBeenCalled();
  });

  it('should resolve trainerId directly when provided', async () => {
    await service.addTrainerAssociation(
      parentUserId,
      playerProfileId,
      { trainerId: 'trainer-1' },
      false,
    );

    expect(prisma.trainerPlayerAssociation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { trainerId: 'trainer-1', playerProfileId },
      }),
    );
  });

  it('should resolve trainerId from a ShareLink code when trainerId is not given', async () => {
    prisma.shareLink.findUnique.mockResolvedValue({
      trainerId: 'trainer-from-link',
      type: ShareLinkType.STATIC,
    });

    await service.addTrainerAssociation(
      parentUserId,
      playerProfileId,
      { shareLinkCode: 'abc123' },
      false,
    );

    expect(prisma.trainerPlayerAssociation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { trainerId: 'trainer-from-link', playerProfileId },
      }),
    );
  });

  it('should be idempotent when an ACTIVE association already exists', async () => {
    prisma.trainerPlayerAssociation.findFirst.mockResolvedValue({
      id: 'assoc-1',
      status: 'ACTIVE',
    });

    await service.addTrainerAssociation(
      parentUserId,
      playerProfileId,
      { trainerId: 'trainer-1' },
      false,
    );

    expect(prisma.trainerPlayerAssociation.create).not.toHaveBeenCalled();
  });

  it('should reject when the caller is a child account', async () => {
    await expect(
      service.addTrainerAssociation(
        parentUserId,
        playerProfileId,
        { trainerId: 'trainer-1' },
        true,
      ),
    ).rejects.toThrow('not available to a child account');
    expect(prisma.trainerPlayerAssociation.create).not.toHaveBeenCalled();
  });
});

describe('TrainerAssociationService.removeTrainerAssociation', () => {
  let service: TrainerAssociationService;
  let prisma: MockPrismaService;
  let playerProfileService: PlayerProfileService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    playerProfileService = new PlayerProfileService(prisma as never);
    service = new TrainerAssociationService(
      prisma as never,
      playerProfileService,
    );
    prisma.playerProfile.findFirst.mockResolvedValue({
      id: playerProfileId,
      parentUserId,
    });
  });

  it('should soft-delete the association (status=REMOVED, row kept)', async () => {
    prisma.trainerPlayerAssociation.findFirst.mockResolvedValue({
      id: 'assoc-1',
      trainerId: 'trainer-1',
      playerProfileId,
    });

    const result = await service.removeTrainerAssociation(
      parentUserId,
      playerProfileId,
      'trainer-1',
      false,
    );

    expect(prisma.trainerPlayerAssociation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'assoc-1' },
        data: { status: 'REMOVED' },
      }),
    );
    expect(prisma.trainerPlayerAssociation.delete).not.toHaveBeenCalled();
    expect(result.cancelledUpcomingRsvps).toBe(true);
  });

  it('should 404 when the association does not belong to the caller', async () => {
    prisma.playerProfile.findFirst.mockResolvedValue(null);
    await expect(
      service.removeTrainerAssociation(
        parentUserId,
        playerProfileId,
        'trainer-1',
        false,
      ),
    ).rejects.toThrow();
  });

  it('should reject when the caller is a child account', async () => {
    prisma.trainerPlayerAssociation.findFirst.mockResolvedValue({
      id: 'assoc-1',
      trainerId: 'trainer-1',
      playerProfileId,
    });

    await expect(
      service.removeTrainerAssociation(
        parentUserId,
        playerProfileId,
        'trainer-1',
        true,
      ),
    ).rejects.toThrow('not available to a child account');
    expect(prisma.trainerPlayerAssociation.update).not.toHaveBeenCalled();
  });
});
