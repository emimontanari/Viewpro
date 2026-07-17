import PageContainer from '@/components/layout/page-container';
import { TenantDetailHeader } from '@/features/tenants/components/tenant-detail-header';
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

  // The H1/subtitle now live inside the page CONTENT (TenantDetailHeader),
  // rendered outside Suspense so they persist across loading/error/success.
  // No pageTitle/pageDescription is passed so PageContainer renders no header
  // (avoids a duplicate title); PageContainer's behavior for other routes is
  // unchanged.
  return (
    <PageContainer>
      <TenantDetailHeader tenantId={params.tenantId} />
      <Suspense fallback={<TenantDetailSkeleton />}>
        <TenantDetailViewPage tenantId={params.tenantId} />
      </Suspense>
    </PageContainer>
  );
}
