import { SetMetadata } from '@nestjs/common';

export const BLOCK_CHILD_ACCOUNTS_KEY = 'blockChildAccounts';

/** Marks a route as off-limits to a child session (JWT with parentUserId set). */
export const BlockChildAccounts = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(BLOCK_CHILD_ACCOUNTS_KEY, true);
