import type { NavigationAccessPolicy, NavGroup } from '@/types';

export type NavigationAccessContext = {
  resolved: boolean;
  membership: { role: string; permissions: string[] } | null;
};

export function canAccessNavigation(policy: NavigationAccessPolicy | undefined, { resolved, membership }: NavigationAccessContext) {
  return !policy || (!!resolved && !!membership &&
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
