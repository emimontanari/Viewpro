'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { navGroups } from '@/config/nav-config';
import type { DashboardSummaryRange } from '@/features/dashboard/api/types';
import { getUserDisplayName, type TenantMembership } from '@/lib/session';
import { filterNavigationGroups, toNavigationAccessContext } from '@/lib/navigation-access';
import { useActiveTenant, useSession } from '@/lib/session-context';
import {
  ManagerRecentActivity,
  ManagerShortcuts,
  ManagerSummary,
  ManagerTopProperties,
  ManagerTopSellers,
  ManagerUnavailablePanel
} from './operational-homepage/manager-sections';
import {
  MissingInmobiliariaState,
  OperationalHomepageSkeleton,
  UnsupportedDashboardRoleState
} from './operational-homepage/states';
import { formatArgentinaCalendarDate, getManagerShortcuts } from './operational-homepage/helpers';
import { useManagerSummary } from './operational-homepage/manager-home';
import {
  SellerOperationalHomepage,
  type SellerActivityState,
  type SellerProductsState
} from './operational-homepage/seller-home';
import { SellerHomeView, type SellerShortcut } from './operational-homepage/seller-sections';

export function OperationalHomepage({ nowMs }: { nowMs?: number }) {
  const { activeMembership, activeTenantId, isTenantLoading } = useActiveTenant();
  const { session } = useSession();

  if (isTenantLoading) {
    return <OperationalHomepageSkeleton />;
  }

  if (!activeTenantId || !activeMembership) {
    return <MissingInmobiliariaState />;
  }

  if (activeMembership.tenant.id !== activeTenantId) {
    return <OperationalHomepageSkeleton />;
  }

  const displayName = getUserDisplayName(session?.user).trim();

  if (isSellerMembership(activeMembership) && displayName) {
    return (
      <SellerOperationalHomepage activeTenantId={activeTenantId} membershipId={activeMembership.id}>
        {(states) => <SellerHomeContent activeMembership={activeMembership} displayName={displayName} {...states} />}
      </SellerOperationalHomepage>
    );
  }

  if (isManagerMembership(activeMembership) && displayName) {
    return (
      <ManagerOperationalHomepage
        activeMembership={activeMembership}
        activeTenantId={activeTenantId}
        displayName={displayName}
        now={new Date(nowMs ?? Date.now())}
      />
    );
  }

  return <UnsupportedDashboardRoleState />;
}

function ManagerOperationalHomepage({
  activeMembership,
  activeTenantId,
  displayName,
  now
}: {
  activeMembership: TenantMembership;
  activeTenantId: string;
  displayName: string;
  now: Date;
}) {
  const [selectedRange, setSelectedRange] = React.useState<DashboardSummaryRange>('7d');
  const [today] = React.useState(() => formatArgentinaCalendarDate(now));
  const summary = useManagerSummary({ range: selectedRange, tenantId: activeTenantId });
  const shortcuts = getManagerShortcuts(activeMembership, false);

  return (
    <section className='min-w-0 space-y-6'>
      <div className='overflow-hidden rounded-3xl border bg-card shadow-xs'>
        <div className='space-y-5 p-6 lg:p-8'>
          <Badge variant='outline' className='rounded-full bg-muted/40'>
            Panel de inmobiliaria
          </Badge>
          <div className='max-w-3xl space-y-3'>
            <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>Hola, {displayName}</h1>
            <p className='text-sm text-muted-foreground'>
              {activeMembership.tenant.name} · <time dateTime={today.dateTime}>{today.label}</time>
            </p>
            <p className='text-base text-muted-foreground md:text-lg'>
              Detectá qué gestiones se están moviendo, qué propiedades piden atención y quiénes
              están generando actividad para decidir por dónde empezar.
            </p>
          </div>
        </div>
      </div>

      {summary.status === 'ready' ? (
        <ManagerSummary data={summary.data} onRangeChange={setSelectedRange} range={selectedRange} />
      ) : summary.status === 'error' ? (
        <div role='alert'>
          <ManagerUnavailablePanel
            retry={summary.retry}
            retrying={summary.retrying}
            title='Resumen operativo no disponible'
          />
        </div>
      ) : (
        <div
          aria-label='Preparando resumen operativo'
          className='h-44 animate-pulse rounded-2xl bg-muted'
        />
      )}

      <ManagerRecentActivity range={selectedRange} summary={summary} />

          <div className='grid gap-5 xl:grid-cols-2'>
            <ManagerTopProperties range={selectedRange} summary={summary} />
            <ManagerTopSellers summary={summary} />
          </div>

          <ManagerShortcuts shortcuts={shortcuts} />
        </section>
  );
}

function SellerHomeContent({
  activeMembership,
  activity,
  displayName,
  products
}: {
  activeMembership: TenantMembership;
  activity: SellerActivityState;
  displayName: string;
  products: SellerProductsState;
}) {
  return (
    <section className='min-w-0 space-y-6'>
      <SellerHomeView
        activity={activity}
        displayName={displayName}
        products={products}
        shortcuts={getSellerShortcuts(activeMembership)}
        tenantName={activeMembership.tenant.name}
      />
    </section>
  );
}

function getSellerShortcuts(membership: TenantMembership): SellerShortcut[] {
  const accessibleItems = filterNavigationGroups(
    navGroups,
    toNavigationAccessContext(membership, false)
  ).flatMap((group) => group.items);

  return (['/dashboard/product', '/dashboard/seguimiento'] as const).flatMap((href) => {
    const item = accessibleItems.find((candidate) => candidate.url === href);
    if (!item || (item.icon !== 'product' && item.icon !== 'trendingUp')) return [];

    return [{ href, icon: item.icon, label: item.title }];
  });
}

function isSellerMembership(membership: TenantMembership) {
  return membership.role === 'AGENT';
}

function isManagerMembership(membership: TenantMembership) {
  return membership.role === 'MANAGER' || membership.role === 'PRINCIPAL_MANAGER';
}
