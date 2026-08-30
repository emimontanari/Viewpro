import type { NavigationAccessPolicy, NavGroup } from '@/types';

export type NavigationAccessContext = {
  resolved: boolean;
  membership: { role: string; permissions: string[]; tenantStatus: string | null } | null;
};

/**
 * The tenant states in which the product may be operated.
 *
 * Mirrors `TenantMembershipGuard` on the API, which refuses exactly SUSPENDED
 * and CANCELLED. Anything unrecognised is refused too: a status this build has
 * never heard of is a reason to hide work, not to assume it is allowed.
 *
 * The status already travels in the /auth/me payload. It was simply dropped
 * before the policy could see it, so a suspended agency kept its whole sidebar
 * and every click behind it failed at the API.
 */
const OPERATIONAL_TENANT_STATUSES = new Set(['ACTIVE', 'TRIAL']);

export function isTenantOperational(status: string | null | undefined): boolean {
  return !!status && OPERATIONAL_TENANT_STATUSES.has(status);
}

export function canAccessNavigation(policy: NavigationAccessPolicy | undefined, { resolved, membership }: NavigationAccessContext) {
  return !policy || (!!resolved && !!membership &&
    isTenantOperational(membership.tenantStatus) &&
    (!policy.roles || policy.roles.includes(membership.role)) &&
    (policy.permissions?.every((permission) => membership.permissions.includes(permission)) ?? true));
}

export function filterNavigationGroups(groups: NavGroup[], context: NavigationAccessContext) {
  return groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessNavigation(item.access, context)).map((item) => ({
      ...item,
      items: item.items?.filter((child) => canAccessNavigation(child.access, context)) ?? []
    }))
  })).filter((group) => group.items.length > 0);
}

/** What the session knows about the membership a navigation decision is made for. */
export type NavigationMembershipSource = {
  role: string;
  permissions: string[];
  tenant?: { status?: string | null } | null;
} | null;

/**
 * Build the access context from the session, in one place.
 *
 * Two components built this by hand and one of them silently dropped the
 * tenant status, so workspace administration stayed available inside a
 * suspended agency. A third caller getting it wrong the same way is now a
 * compile error rather than a quiet permission.
 */
export function toNavigationAccessContext(
  membership: NavigationMembershipSource,
  isTenantLoading: boolean
): NavigationAccessContext {
  return {
    resolved: !isTenantLoading,
    membership: membership
      ? {
          role: membership.role,
          permissions: membership.permissions,
          // Optional on purpose: a payload without a tenant must fall to the
          // fail-closed path, not throw while rendering the sidebar.
          tenantStatus: membership.tenant?.status ?? null
        }
      : null
  };
}
