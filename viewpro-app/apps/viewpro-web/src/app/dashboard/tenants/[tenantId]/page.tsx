import PageContainer from '@/components/layout/page-container';
import { TenantDetailSkeleton } from '@/features/tenants/components/tenant-detail-skeleton';
import { TenantDetailViewPage } from '@/features/tenants/components/tenant-detail-view-page';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: Detalle de inmobiliaria'
};

type PageProps = { params: Promise<{ tenantId: string }> };

// Thin route (platform-tenant-tracking, D9) — mirrors app-new's
// /dashboard/product/[productId]/page.tsx Suspense/skeleton split. Breadcrumb
// back to "Inmobiliarias" is automatic (useBreadcrumbs' generic fallback maps
// the "tenants" segment label, header.tsx always renders <Breadcrumbs/>).
export default async function TenantDetailPage(props: PageProps) {
  const params = await props.params;

  return (
    <PageContainer
      pageTitle='Detalle de la inmobiliaria'
      pageDescription='Actividad y métricas de la inmobiliaria seleccionada.'
    >
      <Suspense fallback={<TenantDetailSkeleton />}>
        <TenantDetailViewPage tenantId={params.tenantId} />
      </Suspense>
    </PageContainer>
  );
}
