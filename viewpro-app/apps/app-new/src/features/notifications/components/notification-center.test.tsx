import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname, useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getOwnerNotifications,
  getOwnerUnreadNotificationCount,
  markAllOwnerNotificationsRead,
  markOwnerNotificationRead
} from '@/features/owner/api/notifications';
import { ownerKeys } from '@/features/owner/api/queries';
import { useActiveTenant } from '@/lib/session-context';
import { notificationKeys } from '../api/queries';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead
} from '../api/service';
import type { DashboardNotification, NotificationsResponse } from '../api/types';
import { NotificationCenter } from './notification-center';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn()
}));

vi.mock('@/lib/session-context', () => ({
  useActiveTenant: vi.fn()
}));

vi.mock('@/features/owner/api/notifications', () => ({
  getOwnerNotifications: vi.fn(),
  getOwnerUnreadNotificationCount: vi.fn(),
  markAllOwnerNotificationsRead: vi.fn(),
  markOwnerNotificationRead: vi.fn()
}));

vi.mock('../api/service', () => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn()
}));

const usePathnameMock = vi.mocked(usePathname);
const useRouterMock = vi.mocked(useRouter);
const useActiveTenantMock = vi.mocked(useActiveTenant);
const getNotificationsMock = vi.mocked(getNotifications);
const getUnreadNotificationCountMock = vi.mocked(getUnreadNotificationCount);
const markNotificationReadMock = vi.mocked(markNotificationRead);
const markAllNotificationsReadMock = vi.mocked(markAllNotificationsRead);
const getOwnerNotificationsMock = vi.mocked(getOwnerNotifications);
const getOwnerUnreadNotificationCountMock = vi.mocked(getOwnerUnreadNotificationCount);
const markOwnerNotificationReadMock = vi.mocked(markOwnerNotificationRead);
const markAllOwnerNotificationsReadMock = vi.mocked(markAllOwnerNotificationsRead);
const pushMock = vi.fn();

const activeTenantContext = {
  activeMembership: {
    id: 'membership-1',
    permissions: ['engagements:view:all'],
    role: 'MANAGER',
    tenant: {
      id: 'tenant-1',
      name: 'Costa Norte Propiedades',
      slug: 'costa-norte',
      status: 'ACTIVE'
    }
  },
  activeTenantId: 'tenant-1',
  hasMemberships: true,
  isTenantLoading: false,
  memberships: [],
  needsTenantSelection: false,
  selectedTenantId: 'tenant-1'
};

const unreadNotification: DashboardNotification = {
  id: 'notification-1',
  type: 'DOCUMENT_UPLOADED',
  surface: 'INTERNAL',
  title: 'Documento listo para revisar',
  body: 'El propietario subió una escritura.',
  linkHref: '/dashboard/product/engagement-1',
  readAt: null,
  createdAt: '2026-06-02T10:00:00.000Z',
  refs: {
    propertyEngagementId: 'engagement-1',
    propertyAssetId: null,
    documentRequestId: 'request-1',
    movementId: null
  }
};

const readNotification: DashboardNotification = {
  ...unreadNotification,
  id: 'notification-2',
  title: 'Movimiento registrado',
  body: null,
  linkHref: null,
  readAt: '2026-06-02T11:00:00.000Z'
};

const unreadOwnerNotification: DashboardNotification = {
  id: 'owner-notification-1',
  type: 'DOCUMENT_APPROVED',
  surface: 'OWNER',
  title: 'Documento aprobado',
  body: 'La inmobiliaria aprobó tu documento.',
  linkHref: '/owner/properties/property-1',
  readAt: null,
  createdAt: '2026-06-02T12:00:00.000Z',
  refs: {
    propertyEngagementId: 'engagement-1',
    propertyAssetId: 'property-1',
    documentRequestId: 'request-1',
    movementId: null
  }
};

const readOwnerNotification: DashboardNotification = {
  ...unreadOwnerNotification,
  id: 'owner-notification-2',
  title: 'Movimiento cargado',
  body: null,
  linkHref: null,
  readAt: '2026-06-02T13:00:00.000Z'
};

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    usePathnameMock.mockReturnValue('/dashboard');
    useRouterMock.mockReturnValue({ push: pushMock } as unknown as ReturnType<typeof useRouter>);
    useActiveTenantMock.mockReturnValue(activeTenantContext);
    getNotificationsMock.mockResolvedValue(
      notificationsResponse([unreadNotification, readNotification])
    );
    getUnreadNotificationCountMock.mockResolvedValue({ unreadCount: 2 });
    markNotificationReadMock.mockResolvedValue({
      ...unreadNotification,
      readAt: '2026-06-02T11:30:00.000Z'
    });
    markAllNotificationsReadMock.mockResolvedValue({ updatedCount: 2 });
    getOwnerNotificationsMock.mockResolvedValue(
      notificationsResponse([unreadOwnerNotification, readOwnerNotification])
    );
    getOwnerUnreadNotificationCountMock.mockResolvedValue({ unreadCount: 1 });
    markOwnerNotificationReadMock.mockResolvedValue({
      ...unreadOwnerNotification,
      readAt: '2026-06-02T13:30:00.000Z'
    });
    markAllOwnerNotificationsReadMock.mockResolvedValue({ updatedCount: 1 });
  });

  it('shows the dashboard unread badge and renders API notifications', async () => {
    const user = userEvent.setup();

    renderNotificationCenter();

    expect(await screen.findByText('2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('Documento listo para revisar')).toBeInTheDocument();
    expect(screen.getByText('El propietario subió una escritura.')).toBeInTheDocument();
    expect(screen.getByText('Movimiento registrado')).toBeInTheDocument();
    expect(screen.getByText('2 new')).toBeInTheDocument();
    expect(getNotificationsMock).toHaveBeenCalledWith({ page: 1, pageSize: 5 });
  });

  it('shows an honest dashboard empty state when the API returns no notifications', async () => {
    const user = userEvent.setup();
    getNotificationsMock.mockResolvedValueOnce(notificationsResponse([]));
    getUnreadNotificationCountMock.mockResolvedValueOnce({ unreadCount: 0 });

    renderNotificationCenter();

    await user.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
    expect(screen.queryByText('0 new')).not.toBeInTheDocument();
  });

  it('marks individual and all dashboard notifications read through the API', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderNotificationCenter();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    await user.click(await screen.findByRole('button', { name: 'Mark as read' }));

    await waitFor(() => {
      expect(markNotificationReadMock).toHaveBeenCalledWith('notification-1');
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: notificationKeys.list({ page: 1, pageSize: 5, tenantId: 'tenant-1' })
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: notificationKeys.unreadCount('tenant-1')
    });

    invalidateSpy.mockClear();

    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));

    await waitFor(() => {
      expect(markAllNotificationsReadMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: notificationKeys.list({ page: 1, pageSize: 5, tenantId: 'tenant-1' })
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: notificationKeys.unreadCount('tenant-1')
    });
  });

  it('uses safe backend dashboard links for notification actions', async () => {
    const user = userEvent.setup();

    renderNotificationCenter();

    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    await user.click(await screen.findByRole('button', { name: 'Abrir' }));

    await waitFor(() => {
      expect(markNotificationReadMock).toHaveBeenCalledWith('notification-1');
    });
    expect(pushMock).toHaveBeenCalledWith('/dashboard/product/engagement-1');
  });

  it('does not render actions for unsafe backend links', async () => {
    const user = userEvent.setup();
    getNotificationsMock.mockResolvedValueOnce(
      notificationsResponse([
        { ...unreadNotification, linkHref: 'https://evil.example/dashboard/product/engagement-1' },
        { ...readNotification, linkHref: '//evil.example/dashboard' },
        { ...readNotification, id: 'notification-3', linkHref: '/owner/properties/property-1' }
      ])
    );

    renderNotificationCenter();

    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Documento listo para revisar')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Abrir' })).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows owner unread badge and renders owner API notifications without dashboard fetches', async () => {
    const user = userEvent.setup();
    usePathnameMock.mockReturnValue('/owner/properties/property-1');

    renderNotificationCenter();

    expect(await screen.findByText('1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('Documento aprobado')).toBeInTheDocument();
    expect(screen.getByText('La inmobiliaria aprobó tu documento.')).toBeInTheDocument();
    expect(screen.getByText('Movimiento cargado')).toBeInTheDocument();
    expect(screen.getByText('1 new')).toBeInTheDocument();
    expect(getOwnerNotificationsMock).toHaveBeenCalledWith({ page: 1, pageSize: 5 });
    expect(useActiveTenantMock).not.toHaveBeenCalled();
    expect(getNotificationsMock).not.toHaveBeenCalled();
    expect(getUnreadNotificationCountMock).not.toHaveBeenCalled();
  });

  it('keeps the owner empty copy when the owner API returns no notifications', async () => {
    const user = userEvent.setup();
    usePathnameMock.mockReturnValue('/owner/properties/property-1');
    getOwnerNotificationsMock.mockResolvedValueOnce(notificationsResponse([]));
    getOwnerUnreadNotificationCountMock.mockResolvedValueOnce({ unreadCount: 0 });

    renderNotificationCenter();

    await user.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('Sin novedades nuevas')).toBeInTheDocument();
    expect(screen.queryByText('0 new')).not.toBeInTheDocument();
    expect(useActiveTenantMock).not.toHaveBeenCalled();
    expect(getNotificationsMock).not.toHaveBeenCalled();
    expect(getUnreadNotificationCountMock).not.toHaveBeenCalled();
  });

  it('marks individual and all owner notifications read through the owner API', async () => {
    const user = userEvent.setup();
    usePathnameMock.mockReturnValue('/owner/properties/property-1');
    const { queryClient } = renderNotificationCenter();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    await user.click(await screen.findByRole('button', { name: 'Mark as read' }));

    await waitFor(() => {
      expect(markOwnerNotificationReadMock).toHaveBeenCalledWith('owner-notification-1');
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ownerKeys.notifications({ page: 1, pageSize: 5 })
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ownerKeys.unreadNotificationsCount()
    });

    invalidateSpy.mockClear();

    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));

    await waitFor(() => {
      expect(markAllOwnerNotificationsReadMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ownerKeys.notifications({ page: 1, pageSize: 5 })
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ownerKeys.unreadNotificationsCount()
    });
    expect(markNotificationReadMock).not.toHaveBeenCalled();
    expect(markAllNotificationsReadMock).not.toHaveBeenCalled();
  });

  it('uses safe backend owner links for owner notification actions', async () => {
    const user = userEvent.setup();
    usePathnameMock.mockReturnValue('/owner/properties/property-1');

    renderNotificationCenter();

    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    await user.click(await screen.findByRole('button', { name: 'Abrir' }));

    await waitFor(() => {
      expect(markOwnerNotificationReadMock).toHaveBeenCalledWith('owner-notification-1');
    });
    expect(pushMock).toHaveBeenCalledWith('/owner/properties/property-1');
  });

  it('does not render owner actions for unsafe backend links', async () => {
    const user = userEvent.setup();
    usePathnameMock.mockReturnValue('/owner/properties/property-1');
    getOwnerNotificationsMock.mockResolvedValueOnce(
      notificationsResponse([
        { ...unreadOwnerNotification, linkHref: '/dashboard/product/engagement-1' },
        { ...readOwnerNotification, linkHref: 'https://evil.example/owner/properties/property-1' },
        { ...readOwnerNotification, id: 'owner-notification-3', linkHref: '//evil.example/owner' }
      ])
    );

    renderNotificationCenter();

    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Documento aprobado')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Abrir' })).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});

function renderNotificationCenter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <NotificationCenter />
    </QueryClientProvider>
  );

  return { queryClient };
}

function notificationsResponse(items: DashboardNotification[]): NotificationsResponse {
  return {
    items,
    page: 1,
    pageSize: 5,
    total: items.length
  };
}
