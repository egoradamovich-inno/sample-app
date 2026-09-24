import { PrismaClient, Role, UserStatus } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Same password for every seeded account — dev/demo only, never used outside a local DB.
const SEED_PASSWORD = 'Qwerty!';

async function hashPassword(): Promise<string> {
  return bcrypt.hash(SEED_PASSWORD, 10);
}

async function main(): Promise<void> {
  const passwordHash = await hashPassword();

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: { firstName: 'Sam', lastName: 'Admin' },
      },
    },
  });

  const trainer = await prisma.user.upsert({
    where: { email: 'trainer@example.com' },
    update: {},
    create: {
      email: 'trainer@example.com',
      passwordHash,
      role: Role.TRAINER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: { firstName: 'Taylor', lastName: 'Trainer' },
      },
      trainerProfile: {
        create: {
          businessName: 'Ironclad Training Co.',
          address: '123 Field House Way',
          website: 'https://ironclad-training.example.com',
          description: 'Youth strength & conditioning.',
          branding: {
            create: { primaryColorHex: '#D77757' },
          },
        },
      },
    },
    include: { trainerProfile: true },
  });
  const trainerProfile =
    trainer.trainerProfile ??
    (await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: trainer.id },
    }));

  const coach = await prisma.user.upsert({
    where: { email: 'coach@example.com' },
    update: {},
    create: {
      email: 'coach@example.com',
      passwordHash,
      role: Role.COACH,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: { firstName: 'Casey', lastName: 'Coach' },
      },
      coachProfile: {
        create: {
          trainerId: trainer.id,
          bio: 'Former college athlete, 8 years coaching youth sports.',
          credentials: 'CPR/AED, USA Coaching Certified',
          certifications: ['CPR/AED', 'USA Coaching Level 2'],
          publicVisible: true,
          publicSlug: 'casey-coach',
        },
      },
    },
  });

  // Self-registered adult player — PlayerProfile.parentUserId self-references
  // the player's own userId, mirroring registerNewUser() in
  // player-registration.service.ts (an adult player is its own "family root").
  const player = await prisma.user.upsert({
    where: { email: 'player@example.com' },
    update: {},
    create: {
      email: 'player@example.com',
      passwordHash,
      role: Role.PLAYER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: { firstName: 'Jamie', lastName: 'Player' },
      },
    },
  });
  const playerProfile = await prisma.playerProfile.upsert({
    where: { userId: player.id },
    update: {},
    create: {
      userId: player.id,
      parentUserId: player.id,
      displayName: 'Jamie Player',
      isChild: false,
      skillLevel: 'Intermediate',
    },
  });

  // Roster the adult player with the seeded trainer so trainer-scoped views
  // (roster, best-times grid) have at least one row to show.
  await prisma.trainerPlayerAssociation.upsert({
    where: {
      trainerId_playerProfileId: {
        trainerId: trainer.id,
        playerProfileId: playerProfile.id,
      },
    },
    update: {},
    create: {
      trainerId: trainer.id,
      playerProfileId: playerProfile.id,
      status: 'ACTIVE',
    },
  });

  // Child login under the same family, exercising the parent/child boundary
  // (childUser has its own login; PlayerProfile.parentUserId points at the
  // adult player, not at itself) — see ChildAccountGuard / child-account
  // provisioning flow.
  const child = await prisma.user.upsert({
    where: { email: 'child.player@example.com' },
    update: {},
    create: {
      email: 'child.player@example.com',
      passwordHash,
      role: Role.PLAYER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      parentUserId: player.id,
      profile: {
        create: { firstName: 'Riley', lastName: 'Player' },
      },
    },
  });
  await prisma.playerProfile.upsert({
    where: { userId: child.id },
    update: {},
    create: {
      userId: child.id,
      parentUserId: player.id,
      displayName: 'Riley Player',
      isChild: true,
    },
  });

  console.log('Seed complete. All accounts use the password:', SEED_PASSWORD);
  console.log('  SUPER_ADMIN  admin@example.com');
  console.log('  TRAINER      trainer@example.com', `(trainerProfileId=${trainerProfile.id})`);
  console.log('  COACH        coach@example.com');
  console.log('  PLAYER       player@example.com  (adult, rostered with trainer above)');
  console.log('  PLAYER       child.player@example.com  (child login, parent=player@example.com)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
