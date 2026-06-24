import PageContainer from '@/components/layout/page-container';
import { AdminTenantManagementPage } from '@/features/admin/components/admin-tenant-management-page';
import { BRAND } from '@/lib/brand/brand';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: BRAND.metadata.adminTitle
};

export default function AdminPage() {
  return (
    <PageContainer
      pageTitle={BRAND.metadata.adminTitle}
      pageDescription='Consola global para operar tenants sin usar el contexto de una inmobiliaria.'
    >
      <AdminTenantManagementPage />
    </PageContainer>
  );
}
