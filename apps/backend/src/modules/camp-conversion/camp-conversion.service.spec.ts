import { PlayerProfileService } from '../player-profile/player-profile.service';
import { TrainerAssociationService } from '../player-profile/trainer-association.service';
import { CampConversionService, MAX_DRAFTS } from './camp-conversion.service';

const payload = {
  firstName: 'Jamie',
  lastName: 'Parent',
  email: 'jamie@x.com',
  trainerId: 'trainer-1',
  playerName: 'Kid Parent',
};

function makeService(): {
  service: CampConversionService;
  playerProfileService: { ensureSelfProfile: jest.Mock };
  trainerAssociationService: { addTrainerAssociation: jest.Mock };
} {
  const playerProfileService = {
    ensureSelfProfile: jest.fn().mockResolvedValue({ id: 'player-profile-1' }),
  };
  const trainerAssociationService = {
    addTrainerAssociation: jest.fn().mockResolvedValue(undefined),
  };
  const service = new CampConversionService(
    playerProfileService as unknown as PlayerProfileService,
    trainerAssociationService as unknown as TrainerAssociationService,
  );
  return { service, playerProfileService, trainerAssociationService };
}

describe('CampConversionService.createPrefillDraft', () => {
  let service: CampConversionService;

  beforeEach(() => {
    service = makeService().service;
  });

  it('should return a draftToken and an expiresAt 24 hours out', () => {
    const before = Date.now();
    const result = service.createPrefillDraft(payload);
    const expiresAtMs = new Date(result.expiresAt).getTime();

    expect(result.draftToken).toBeTruthy();
    expect(expiresAtMs - before).toBeGreaterThanOrEqual(
      24 * 60 * 60 * 1000 - 1000,
    );
    expect(expiresAtMs - before).toBeLessThanOrEqual(
      24 * 60 * 60 * 1000 + 1000,
    );
  });

  it('should generate a distinct token on each call', () => {
    const first = service.createPrefillDraft(payload);
    const second = service.createPrefillDraft(payload);
    expect(first.draftToken).not.toBe(second.draftToken);
  });

  it('should sweep expired entries during create, not just on getDraft', () => {
    const drafts = (
      service as unknown as {
        drafts: Map<string, { payload: unknown; expiresAt: Date }>;
      }
    ).drafts;
    drafts.set('stale-token', {
      payload,
      expiresAt: new Date(Date.now() - 1000),
    });

    service.createPrefillDraft(payload);

    expect(drafts.has('stale-token')).toBe(false);
  });

  it('should evict the oldest draft once the store is at MAX_DRAFTS capacity', () => {
    const drafts = (
      service as unknown as {
        drafts: Map<string, { payload: unknown; expiresAt: Date }>;
      }
    ).drafts;
    const farFuture = new Date(Date.now() + 60 * 60 * 1000);
    for (let i = 0; i < MAX_DRAFTS; i += 1) {
      drafts.set(`token-${i}`, { payload, expiresAt: farFuture });
    }

    service.createPrefillDraft(payload);

    expect(drafts.size).toBe(MAX_DRAFTS);
    expect(drafts.has('token-0')).toBe(false);
    expect(drafts.has('token-1')).toBe(true);
  });
});

describe('CampConversionService.getDraft', () => {
  let service: CampConversionService;

  beforeEach(() => {
    service = makeService().service;
  });

  it('should return the stored payload for a valid token', () => {
    const { draftToken } = service.createPrefillDraft(payload);
    const draft = service.getDraft(draftToken);
    expect(draft?.email).toBe('jamie@x.com');
    expect(draft?.trainerId).toBe('trainer-1');
  });

  it('should return null for an unknown token', () => {
    expect(service.getDraft('unknown-token')).toBeNull();
  });

  it('should return null and evict an expired draft', () => {
    const { draftToken } = service.createPrefillDraft(payload);
    // Simulate expiry by manipulating the internal clock via a past-dated draft.
    (
      service as unknown as { drafts: Map<string, { expiresAt: Date }> }
    ).drafts.set(draftToken, {
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(service.getDraft(draftToken)).toBeNull();
  });
});

describe('CampConversionService.consumeDraft', () => {
  it('associates the new account with the trainer named in the draft, reusing TrainerAssociationService', async () => {
    const { service, playerProfileService, trainerAssociationService } =
      makeService();
    const { draftToken } = service.createPrefillDraft(payload);

    await service.consumeDraft(draftToken, 'new-user-1');

    expect(playerProfileService.ensureSelfProfile).toHaveBeenCalledWith(
      'new-user-1',
      'Kid Parent',
    );
    expect(
      trainerAssociationService.addTrainerAssociation,
    ).toHaveBeenCalledWith(
      'new-user-1',
      'player-profile-1',
      { trainerId: 'trainer-1' },
      false,
    );
  });

  it('falls back to firstName + lastName for displayName when no playerName was given', async () => {
    const { service, playerProfileService } = makeService();
    const { draftToken } = service.createPrefillDraft({
      firstName: 'Jamie',
      lastName: 'Parent',
      email: 'jamie@x.com',
      trainerId: 'trainer-1',
    });

    await service.consumeDraft(draftToken, 'new-user-1');

    expect(playerProfileService.ensureSelfProfile).toHaveBeenCalledWith(
      'new-user-1',
      'Jamie Parent',
    );
  });

  it('invalidates the draft so it cannot be consumed a second time', async () => {
    const { service } = makeService();
    const { draftToken } = service.createPrefillDraft(payload);

    await service.consumeDraft(draftToken, 'new-user-1');

    await expect(
      service.consumeDraft(draftToken, 'someone-else'),
    ).rejects.toThrow('was not found');
  });

  it('rejects consuming an unknown token', async () => {
    const { service } = makeService();
    await expect(
      service.consumeDraft('unknown-token', 'new-user-1'),
    ).rejects.toThrow();
  });

  it('rejects consuming an expired token and does not attempt any association', async () => {
    const { service, playerProfileService, trainerAssociationService } =
      makeService();
    const { draftToken } = service.createPrefillDraft(payload);
    (
      service as unknown as { drafts: Map<string, { expiresAt: Date }> }
    ).drafts.set(draftToken, { expiresAt: new Date(Date.now() - 1000) });

    await expect(
      service.consumeDraft(draftToken, 'new-user-1'),
    ).rejects.toThrow();
    expect(playerProfileService.ensureSelfProfile).not.toHaveBeenCalled();
    expect(
      trainerAssociationService.addTrainerAssociation,
    ).not.toHaveBeenCalled();
  });
});
