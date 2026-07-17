import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import type { TenantDetailResponse } from '@/features/tenants/api/types';

type Props = { summary: TenantDetailResponse };

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-AR').format(value);
}

/**
 * Counts as stat cards for the tenant detail view (platform-tenant-tracking,
 * D9) — reuses the visual language of OverviewStatCards (Card/CardHeader/
 * CardTitle/CardContent, an Icon, a large tabular-nums figure). Always
 * rendered from the SAME `summary` object the initial query returned — the
 * activity "Cargar más" pagination never re-derives these counts (D11).
 */
export function TenantDetailStatCards({ summary }: Props) {
  const documentsSummary = [
    `Solicitados ${formatNumber(summary.documentEvents.requested)}`,
    `Subidos ${formatNumber(summary.documentEvents.uploaded)}`,
    `Aprobados ${formatNumber(summary.documentEvents.approved)}`,
    `Rechazados ${formatNumber(summary.documentEvents.rejected)}`
  ].join(' · ');

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      <Card className='@container/card'>
        <CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0'>
          <CardTitle className='text-muted-foreground text-sm font-medium'>
            Compromisos activos
          </CardTitle>
          <Icons.listDetails className='text-muted-foreground size-4 shrink-0' />
        </CardHeader>
        <CardContent>
          <p data-testid='stat-active-engagements' className='text-3xl font-bold tabular-nums'>
            {formatNumber(summary.activeEngagements)}
          </p>
        </CardContent>
      </Card>

      <Card className='@container/card'>
        <CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0'>
          <CardTitle className='text-muted-foreground text-sm font-medium'>
            Con actualización visible
          </CardTitle>
          <Icons.check className='text-muted-foreground size-4 shrink-0' />
        </CardHeader>
        <CardContent>
          <p data-testid='stat-engagements-with-update' className='text-3xl font-bold tabular-nums'>
            {formatNumber(summary.activeEngagementsWithOwnerVisibleUpdate)}
            <span className='text-muted-foreground ml-2 text-sm font-normal'>
              ({summary.activeEngagementUpdatePercentage}%)
            </span>
          </p>
        </CardContent>
      </Card>

      <Card className='@container/card'>
        <CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0'>
          <CardTitle className='text-muted-foreground text-sm font-medium'>Documentos</CardTitle>
          <Icons.page className='text-muted-foreground size-4 shrink-0' />
        </CardHeader>
        <CardContent>
          <p data-testid='stat-documents' className='text-muted-foreground text-sm'>
            {documentsSummary}
          </p>
        </CardContent>
      </Card>

      <Card className='@container/card'>
        <CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0'>
          <CardTitle className='text-muted-foreground text-sm font-medium'>
            Vistas de propietario
          </CardTitle>
          <Icons.info className='text-muted-foreground size-4 shrink-0' />
        </CardHeader>
        <CardContent>
          <p data-testid='stat-owner-views' className='text-3xl font-bold tabular-nums'>
            {formatNumber(summary.ownerViewedPropertyCount)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
