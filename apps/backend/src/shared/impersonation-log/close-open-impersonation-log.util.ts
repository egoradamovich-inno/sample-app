import { PrismaService } from '../prisma/prisma.service';

/**
 * Closes the still-open ImpersonationLog row (if any) for an admin/target
 * pair — a no-op when none is open. Lives as a standalone leaf utility
 * (not inside modules/impersonation) so both ImpersonationService (explicit
 * exit) and AuthService (logout while impersonating) can call it without
 * either module importing the other — mirrors this codebase's established
 * "extract the shared piece into its own leaf" convention for avoiding DI
 * cycles between modules/auth and modules/impersonation.
 */
export async function closeOpenImpersonationLog(
  prisma: PrismaService,
  adminId: string,
  targetUserId: string,
): Promise<void> {
  const openLog = (await prisma.impersonationLog.findFirst({
    where: { adminId, targetUserId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  })) as { id: string; startedAt: Date } | null;

  if (!openLog) {
    return;
  }

  const endedAt = new Date();
  const durationSeconds = Math.round(
    (endedAt.getTime() - openLog.startedAt.getTime()) / 1000,
  );

  await prisma.impersonationLog.update({
    where: { id: openLog.id },
    data: { endedAt, durationSeconds },
  });
}
