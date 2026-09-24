import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AppException } from '../../shared/errors/app-exception';
import { PlayerProfileService } from '../player-profile/player-profile.service';
import { TrainerAssociationService } from '../player-profile/trainer-association.service';
import {
  CampPrefillDraftDto,
  CampPrefillDraftResponseDto,
} from './dto/camp-prefill-draft.dto';

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
// Hard cap on the in-memory store — this is an unauthenticated (@Public())
// endpoint, so nothing but this cap stops a flood of create calls from
// growing the Map without bound between sweeps.
export const MAX_DRAFTS = 10_000;

interface DraftEntry {
  payload: CampPrefillDraftDto;
  expiresAt: Date;
}

/**
 * Stub integration point for Epic-08 (camp/evaluation-form conversion),
 * per G-2: nothing produces real input for this yet, so this stores drafts
 * in-memory rather than adding a Prisma model/migration for a feature epic
 * that doesn't exist. Swap for real persistence once Epic-08 defines the
 * actual submission entity and trigger.
 */
@Injectable()
export class CampConversionService {
  private readonly drafts = new Map<string, DraftEntry>();

  constructor(
    private readonly playerProfileService: PlayerProfileService,
    private readonly trainerAssociationService: TrainerAssociationService,
  ) {}

  createPrefillDraft(
    payload: CampPrefillDraftDto,
  ): CampPrefillDraftResponseDto {
    this.evictExpired();
    if (this.drafts.size >= MAX_DRAFTS) {
      // Map iterates in insertion order, so the first key is the oldest
      // entry — evict it to make room rather than growing further.
      const oldestToken: string | undefined = Array.from(this.drafts.keys())[0];
      if (oldestToken !== undefined) {
        this.drafts.delete(oldestToken);
      }
    }

    const draftToken = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + DRAFT_TTL_MS);
    this.drafts.set(draftToken, { payload, expiresAt });

    const dto = new CampPrefillDraftResponseDto();
    dto.draftToken = draftToken;
    dto.expiresAt = expiresAt.toISOString();
    return dto;
  }

  getDraft(draftToken: string): CampPrefillDraftDto | null {
    const entry = this.drafts.get(draftToken);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= new Date()) {
      this.drafts.delete(draftToken);
      return null;
    }
    return entry.payload;
  }

  /**
   * Consumes a draft as part of a successful registration
   * (`AuthController.register`, when the client supplies `draftToken`):
   * fetches the draft and invalidates it in the same synchronous step (no
   * `await` between the lookup and the `delete`), so a token can never be
   * consumed twice even under a concurrent replay, then associates the
   * newly created account with the trainer named in the draft — reusing
   * `TrainerAssociationService.addTrainerAssociation` (Task F2) rather than
   * re-implementing ownership checks / idempotent activation.
   */
  async consumeDraft(draftToken: string, newUserId: string): Promise<void> {
    const entry = this.drafts.get(draftToken);
    if (!entry || entry.expiresAt <= new Date()) {
      this.drafts.delete(draftToken);
      throw new AppException(
        'DRAFT_NOT_FOUND',
        'This registration draft was not found, has expired, or was already used',
        404,
      );
    }
    this.drafts.delete(draftToken);

    const { payload } = entry;
    const displayName =
      payload.playerName ?? `${payload.firstName} ${payload.lastName}`;

    const profile = await this.playerProfileService.ensureSelfProfile(
      newUserId,
      displayName,
    );

    await this.trainerAssociationService.addTrainerAssociation(
      newUserId,
      profile.id,
      { trainerId: payload.trainerId },
      false,
    );
  }

  /** Opportunistic cleanup, run on every create — this is a low-traffic
   * stub endpoint, so there's no need for a scheduled/timer-based sweep. */
  private evictExpired(): void {
    const now = new Date();
    for (const [token, entry] of this.drafts) {
      if (entry.expiresAt <= now) {
        this.drafts.delete(token);
      }
    }
  }
}
