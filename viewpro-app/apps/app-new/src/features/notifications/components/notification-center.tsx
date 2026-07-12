'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { NotificationCard } from '@/components/ui/notification-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  markAllOwnerNotificationsRead,
  markOwnerNotificationRead
} from '@/features/owner/api/notifications';
import {
  ownerKeys,
  ownerNotificationsOptions,
  ownerUnreadNotificationsCountOptions
} from '@/features/owner/api/queries';
import { useActiveTenant } from '@/lib/session-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import {
  notificationKeys,
  notificationsOptions,
  unreadNotificationsCountOptions
} from '../api/queries';
import { markAllNotificationsRead, markNotificationRead } from '../api/service';
import type { DashboardNotification } from '../api/types';

const MAX_VISIBLE = 5;
const OPEN_ACTION_ID = 'open-notification-link';

export function NotificationCenter() {
  const pathname = usePathname();
  const isOwnerPortal = pathname.startsWith('/owner');

  if (isOwnerPortal) {
    return <OwnerNotificationCenter />;
  }

  return <DashboardNotificationCenter />;
}

function OwnerNotificationCenter() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const listQuery = useQuery(ownerNotificationsOptions({ page: 1, pageSize: MAX_VISIBLE }));
  const unreadCountQuery = useQuery(ownerUnreadNotificationsCountOptions());

  const invalidateNotificationQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ownerKeys.notifications({ page: 1, pageSize: MAX_VISIBLE })
      }),
      queryClient.invalidateQueries({ queryKey: ownerKeys.unreadNotificationsCount() })
    ]);
  };

  const markOneReadMutation = useMutation({
    mutationFn: (notificationId: string) => markOwnerNotificationRead(notificationId),
    onSuccess: invalidateNotificationQueries
  });
  const markAllReadMutation = useMutation({
    mutationFn: () => markAllOwnerNotificationsRead(),
    onSuccess: invalidateNotificationQueries
  });

  const notifications = listQuery.data?.items.slice(0, MAX_VISIBLE) ?? [];
  const count = unreadCountQuery.data?.unreadCount ?? 0;

  const handleAction = (notificationId: string, actionId: string) => {
    if (actionId !== OPEN_ACTION_ID) {
      return;
    }

    const notification = notifications.find((item) => item.id === notificationId);
    const safeHref = getSafeOwnerHref(notification?.linkHref ?? null);

    if (!safeHref) {
      return;
    }

    markOneReadMutation.mutate(notificationId);
    router.push(safeHref);
  };

  return (
    <NotificationPopover
      count={count}
      emptyCopy='Sin novedades nuevas'
      getActions={getOwnerNotificationActions}
      heading='Notificaciones'
      isLoading={listQuery.isLoading || unreadCountQuery.isLoading}
      markAllDisabled={markAllReadMutation.isPending}
      markOneDisabled={markOneReadMutation.isPending}
      notifications={notifications}
      onAction={handleAction}
      onMarkAllAsRead={() => markAllReadMutation.mutate()}
      onMarkAsRead={(id) => markOneReadMutation.mutate(id)}
    />
  );
}

function DashboardNotificationCenter() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeTenantId, isTenantLoading } = useActiveTenant();
  const shouldFetchNotifications = Boolean(activeTenantId) && !isTenantLoading;
  const listQuery = useQuery({
    ...notificationsOptions({ page: 1, pageSize: MAX_VISIBLE, tenantId: activeTenantId }),
    enabled: shouldFetchNotifications
  });
  const unreadCountQuery = useQuery({
    ...unreadNotificationsCountOptions(activeTenantId),
    enabled: shouldFetchNotifications
  });

  const invalidateNotificationQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: notificationKeys.list({
          page: 1,
          pageSize: MAX_VISIBLE,
          tenantId: activeTenantId
        })
      }),
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(activeTenantId) })
    ]);
  };

  const markOneReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: invalidateNotificationQueries
  });
  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: invalidateNotificationQueries
  });

  const notifications = listQuery.data?.items.slice(0, MAX_VISIBLE) ?? [];
  const count = unreadCountQuery.data?.unreadCount ?? 0;

  const handleAction = (notificationId: string, actionId: string) => {
    if (actionId !== OPEN_ACTION_ID) {
      return;
    }

    const notification = notifications.find((item) => item.id === notificationId);
    const safeHref = getSafeDashboardHref(notification?.linkHref ?? null);

    if (!safeHref) {
      return;
    }

    markOneReadMutation.mutate(notificationId);
    router.push(safeHref);
  };

  return (
    <NotificationPopover
      count={count}
      emptyCopy='Todavía no hay notificaciones'
      heading='Notificaciones'
      isLoading={listQuery.isLoading || unreadCountQuery.isLoading || isTenantLoading}
      markAllDisabled={markAllReadMutation.isPending}
      markOneDisabled={markOneReadMutation.isPending}
      notifications={notifications}
      onAction={handleAction}
      onMarkAllAsRead={() => markAllReadMutation.mutate()}
      onMarkAsRead={(id) => markOneReadMutation.mutate(id)}
    />
  );
}

type NotificationAction = {
  id: string;
  label: string;
  type: 'redirect';
  style: 'primary';
};

type NotificationPopoverProps = {
  count: number;
  emptyCopy: string;
  heading: string;
  getActions?: (notification: DashboardNotification) => NotificationAction[];
  isLoading?: boolean;
  markAllDisabled?: boolean;
  markOneDisabled?: boolean;
  notifications: DashboardNotification[];
  onAction?: (notificationId: string, actionId: string) => void;
  onMarkAllAsRead?: () => void;
  onMarkAsRead?: (id: string) => void;
};

function NotificationPopover({
  count,
  emptyCopy,
  heading,
  getActions = getDashboardNotificationActions,
  isLoading = false,
  markAllDisabled = false,
  markOneDisabled = false,
  notifications,
  onAction,
  onMarkAllAsRead,
  onMarkAsRead
}: NotificationPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label='Notificaciones'
          variant='ghost'
          size='icon'
          className='relative size-11'
        >
          <Icons.notification className='h-4 w-4' />
          {count > 0 && (
            <span className='bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium'>
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='end'
        collisionPadding={16}
        className='w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-popover/95 p-0 shadow-sm backdrop-blur sm:w-[380px] sm:max-w-[380px]'
        sideOffset={8}
      >
        <div className='flex items-center justify-between gap-4 px-4 py-3'>
          <h4 className='min-w-0 text-sm font-semibold'>{heading}</h4>
          {count > 0 && onMarkAllAsRead ? (
            <Button
              variant='ghost'
              size='sm'
              className='min-h-11 shrink-0 px-2 text-xs text-primary hover:text-primary/90'
              disabled={markAllDisabled}
              onClick={onMarkAllAsRead}
            >
              Marcar todas como leídas
            </Button>
          ) : null}
        </div>
        <Separator />
        <ScrollArea className='max-h-[min(65vh,28rem)] overflow-hidden'>
          {isLoading ? (
            <NotificationMessage copy='Cargando notificaciones…' />
          ) : notifications.length === 0 ? (
            <NotificationMessage copy={emptyCopy} />
          ) : (
            <div className='bg-muted/30 p-2'>
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  id={notification.id}
                  title={notification.title}
                  body={notification.body ?? ''}
                  status={notification.readAt ? 'read' : 'unread'}
                  createdAt={notification.createdAt}
                  actions={getActions(notification)}
                  onMarkAsRead={markOneDisabled ? undefined : onMarkAsRead}
                  onAction={onAction}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NotificationMessage({ copy }: { copy: string }) {
  return (
    <div className='flex flex-col items-center justify-center px-6 py-12 text-center'>
      <Icons.notification className='mb-2 h-8 w-8 text-foreground/35' />
      <p className='text-sm text-foreground/70'>{copy}</p>
    </div>
  );
}

function getDashboardNotificationActions(notification: DashboardNotification) {
  if (!getSafeDashboardHref(notification.linkHref)) {
    return [];
  }

  return [
    {
      id: OPEN_ACTION_ID,
      label: 'Abrir',
      type: 'redirect' as const,
      style: 'primary' as const
    }
  ];
}

function getOwnerNotificationActions(notification: DashboardNotification) {
  if (!getSafeOwnerHref(notification.linkHref)) {
    return [];
  }

  return [
    {
      id: OPEN_ACTION_ID,
      label: 'Abrir',
      type: 'redirect' as const,
      style: 'primary' as const
    }
  ];
}

function getSafeDashboardHref(linkHref: string | null) {
  return getSafeRelativeHref(linkHref, '/dashboard');
}

function getSafeOwnerHref(linkHref: string | null) {
  return getSafeRelativeHref(linkHref, '/owner');
}

function getSafeRelativeHref(linkHref: string | null, allowedPrefix: '/dashboard' | '/owner') {
  if (!linkHref || linkHref.startsWith('//') || !linkHref.startsWith(allowedPrefix)) {
    return null;
  }

  try {
    const url = new URL(linkHref, 'https://viewpro.local');

    if (url.origin !== 'https://viewpro.local' || !url.pathname.startsWith(allowedPrefix)) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
