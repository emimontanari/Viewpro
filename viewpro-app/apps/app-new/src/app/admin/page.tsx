import PageContainer from '@/components/layout/page-container';
import { AdminTenantManagementPage } from '@/features/admin/components/admin-tenant-management-page';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin ViewPro'
};

export default function AdminPage() {
  return (
    <PageContainer
      pageTitle='Admin ViewPro'
      pageDescription='Consola global para operar tenants sin usar el contexto de una inmobiliaria.'
    >
      <AdminTenantManagementPage />
    </PageContainer>
  );
}
