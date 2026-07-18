'use client';

import PageContainer from '@/components/layout/page-container';
import { AuditFeedPage } from '@/features/audit/components/audit-feed-page';

export default function AuditPage() {
  return (
    <PageContainer
      pageTitle='Auditoría'
      pageDescription='Historial global de cambios en la plataforma ViewPro.'
    >
      <AuditFeedPage />
    </PageContainer>
  );
}
