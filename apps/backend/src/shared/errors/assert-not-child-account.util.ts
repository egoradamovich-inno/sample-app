import { AppException } from './app-exception';

/**
 * Service-layer backstop against child-account access, mirrored at every
 * route @BlockChildAccounts() also guards. The guard already blocks a child
 * session from reaching these services via HTTP, but a service must not
 * trust that — it has to hold even if a decorator is misapplied, removed,
 * or the method is invoked from a non-HTTP caller.
 */
export function assertNotChildAccount(isChildAccount: boolean): void {
  if (isChildAccount) {
    throw new AppException(
      'CHILD_ACCOUNT_RESTRICTED',
      'This action is not available to a child account',
      403,
    );
  }
}
