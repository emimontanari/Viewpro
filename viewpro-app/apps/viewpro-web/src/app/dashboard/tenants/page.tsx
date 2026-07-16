'use client';

// PR1 (WU-1) — thin route. Reachable only by direct URL until T-18 (WU-2)
// adds the nav-config.ts entry.
import PageContainer from '@/components/layout/page-container';
import { TenantsManagementPage } from '@/features/tenants/components/tenants-management-page';

export default function TenantsPage() {
  return (
    <PageContainer
      pageTitle='Inmobiliarias'
      pageDescription='Gestioná el estado y los límites de cada inmobiliaria de la plataforma ViewPro.'
    >
      <TenantsManagementPage />
    </PageContainer>
  );
}
