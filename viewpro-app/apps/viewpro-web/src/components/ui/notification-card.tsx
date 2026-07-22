'use client';

import type { FC } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type NotificationStatus = 'unread' | 'read' | 'archived';
export type ActionType = 'redirect' | 'api_call' | 'workflow' | 'modal';
export type ActionStyle = 'primary' | 'danger' | 'default';

export interface NotificationAction {
  id: string;
  label: string;
  type: ActionType;
  style?: ActionStyle;
  executed?: boolean;
}

export interface NotificationCardProps {
  id: string;
  title: string;
  body: string;
  status?: NotificationStatus;
  createdAt?: string | Date;
  actions?: NotificationAction[];
  onMarkAsRead?: (id: string) => void;
  onAction?: (notificationId: string, actionId: string, actionType: ActionType) => void;
  loadingActionId?: string;
  className?: string;
}

const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours} h`;
  if (diffDays < 7) return `${diffDays} d`;

  return d.toLocaleDateString('es-AR', {
    month: 'short',
    day: 'numeric'
  });
};

function getDisplayTitle(title: string) {
  if (title === 'Document uploaded') {
    return 'Documento subido';
  }

  return title;
}

export const NotificationCard: FC<NotificationCardProps> = ({
  id,
  title,
  body,
  status = 'unread',
  createdAt,
  actions = [],
  onMarkAsRead,
  onAction,
  loadingActionId,
  className
}) => {
  const isUnread = status === 'unread';
  const displayTitle = getDisplayTitle(title);
  const bodyCopy = body.trim();
  const primaryAction = actions.find((action) => !action.executed) ?? actions[0];
  const isPrimaryActionLoading = primaryAction ? loadingActionId === primaryAction.id : false;
  const accessibleRowLabel = bodyCopy ? `${displayTitle}: ${bodyCopy}` : displayTitle;
  const hasPrimaryAction = Boolean(primaryAction && onAction);

  return (
    <article className={cn('group border-b border-border/60 last:border-b-0', className)}>
      <div className='flex min-h-12 items-center gap-1'>
        {hasPrimaryAction && primaryAction ? (
          <button
            type='button'
            aria-label={accessibleRowLabel}
            className='flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50'
            disabled={isPrimaryActionLoading}
            onClick={() => onAction?.(id, primaryAction.id, primaryAction.type)}
          >
            <NotificationRowContent
              body={bodyCopy}
              createdAt={createdAt}
              isUnread={isUnread}
              title={displayTitle}
            />
          </button>
        ) : (
          <div className='flex min-h-12 min-w-0 flex-1 items-center gap-2 px-3 py-2'>
            <NotificationRowContent
              body={bodyCopy}
              createdAt={createdAt}
              isUnread={isUnread}
              title={displayTitle}
            />
          </div>
        )}

        {isUnread && onMarkAsRead ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label='Marcar como leída'
                className='size-11 shrink-0 text-muted-foreground opacity-100 transition-opacity hover:text-foreground [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100'
                onClick={() => onMarkAsRead(id)}
              >
                <Icons.check className='size-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent side='left'>Marcar como leída</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </article>
  );
};

function NotificationRowContent({
  body,
  createdAt,
  isUnread,
  title
}: {
  body: string;
  createdAt?: string | Date;
  isUnread: boolean;
  title: string;
}) {
  return (
    <>
      <span
        aria-hidden='true'
        className={cn(
          'mt-1.5 size-1.5 shrink-0 self-start rounded-full',
          isUnread ? 'bg-sky-500' : 'bg-transparent'
        )}
      />
      <span className='min-w-0 flex-1 space-y-0.5'>
        <span
          data-slot='notification-row-title'
          className='block truncate text-sm leading-tight font-semibold text-foreground'
        >
          {title}
        </span>
        {body ? (
          <span
            data-slot='notification-row-copy'
            className='block truncate text-xs leading-tight text-foreground/70'
          >
            {body}
          </span>
        ) : null}
      </span>
      {createdAt ? (
        <span
          className='shrink-0 self-start pt-0.5 text-xs text-muted-foreground'
          data-slot='notification-timestamp'
        >
          {formatDate(createdAt)}
        </span>
      ) : null}
    </>
  );
}
