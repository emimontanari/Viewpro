export type NotificationSurface = 'INTERNAL' | 'OWNER';

export type NotificationType =
  | 'DOCUMENT_REQUESTED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'PROPERTY_STATUS_CHANGED'
  | 'MOVEMENT_CREATED';

export type DashboardNotification = {
  id: string;
  type: NotificationType;
  surface: NotificationSurface;
  title: string;
  body: string | null;
  linkHref: string | null;
  readAt: string | null;
  createdAt: string;
  refs: {
    propertyEngagementId: string | null;
    propertyAssetId: string | null;
    documentRequestId: string | null;
    movementId: string | null;
  };
};

export type NotificationFilters = {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
};

export type NotificationsResponse = {
  items: DashboardNotification[];
  total: number;
  page: number;
  pageSize: number;
};

export type UnreadNotificationsCountResponse = {
  unreadCount: number;
};

export type MarkAllNotificationsReadResponse = {
  updatedCount: number;
};
