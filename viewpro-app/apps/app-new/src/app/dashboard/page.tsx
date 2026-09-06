import PageContainer from '@/components/layout/page-container';
import { OperationalHomepage } from '@/features/dashboard/components/operational-homepage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard: Inicio'
};

export default function Dashboard() {
  return (
    <PageContainer>
      <OperationalHomepage />
    </PageContainer>
  );
}
