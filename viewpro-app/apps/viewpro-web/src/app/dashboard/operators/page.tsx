'use client';

// platform-operator-management (A4, PR2) — thin route, mirrors
// /dashboard/tenants/page.tsx. Reachable via direct URL for any operator; the
// nav entry is hidden for non-OWNER sessions (UX only) and the server-side
// 403 PERMISSION_DENIED is the real enforcement.
import PageContainer from '@/components/layout/page-container';
import { OperatorsManagementPage } from '@/features/operators/components/operators-management-page';

export default function OperatorsPage() {
  return (
    <PageContainer
      pageTitle='Operadores'
      pageDescription='Gestioná las cuentas de operador de la plataforma ViewPro: roles, estado y creación.'
    >
      <OperatorsManagementPage />
    </PageContainer>
  );
}
