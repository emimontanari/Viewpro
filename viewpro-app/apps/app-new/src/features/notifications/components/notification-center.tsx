'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { NotificationCard } from '@/components/ui/notification-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  return (
    <NotificationPopover
      count={0}
      emptyCopy='Sin novedades nuevas'
      heading='Notificaciones'
      notifications={[]}
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
      emptyCopy='No notifications yet'
      heading='Notifications'
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

type NotificationPopoverProps = {
  count: number;
  emptyCopy: string;
  heading: string;
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
        <Button aria-label='Notifications' variant='ghost' size='icon' className='relative h-8 w-8'>
          <Icons.notification className='h-4 w-4' />
          {count > 0 && (
            <span className='bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium'>
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-[calc(100vw-2rem)] p-0 sm:w-[380px]' sideOffset={8}>
        <div className='flex items-center justify-between px-4 py-3'>
          <h4 className='text-sm font-semibold'>{heading}</h4>
          <div className='flex items-center gap-2'>
            {count > 0 && (
              <span className='bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs'>
                {count} new
              </span>
            )}
            {count > 0 && onMarkAllAsRead && (
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground h-auto px-2 py-1 text-xs'
                disabled={markAllDisabled}
                onClick={onMarkAllAsRead}
              >
                Mark all as read
              </Button>
            )}
          </div>
        </div>
        <Separator />
        <ScrollArea className='h-[400px]'>
          {isLoading ? (
            <NotificationMessage copy='Cargando notificaciones...' />
          ) : notifications.length === 0 ? (
            <NotificationMessage copy={emptyCopy} />
          ) : (
            <div className='flex flex-col gap-1 p-2'>
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  id={notification.id}
                  title={notification.title}
                  body={notification.body ?? ''}
                  status={notification.readAt ? 'read' : 'unread'}
                  createdAt={notification.createdAt}
                  actions={getNotificationActions(notification)}
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
    <div className='flex flex-col items-center justify-center py-12'>
      <Icons.notification className='text-muted-foreground/40 mb-2 h-8 w-8' />
      <p className='text-muted-foreground text-sm'>{copy}</p>
    </div>
  );
}

function getNotificationActions(notification: DashboardNotification) {
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

function getSafeDashboardHref(linkHref: string | null) {
  if (!linkHref || linkHref.startsWith('//') || !linkHref.startsWith('/dashboard')) {
    return null;
  }

  try {
    const url = new URL(linkHref, 'https://viewpro.local');

    if (url.origin !== 'https://viewpro.local' || !url.pathname.startsWith('/dashboard')) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
