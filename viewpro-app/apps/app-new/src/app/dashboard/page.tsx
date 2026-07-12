import PageContainer from '@/components/layout/page-container';
import { OperationalHomepage } from '@/features/dashboard/components/operational-homepage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard: Inicio'
};

export default function Dashboard() {
  return (
    <PageContainer
      pageTitle='Inicio'
      pageDescription='Resumen operativo para trabajar el día de tu inmobiliaria.'
    >
      <OperationalHomepage />
    </PageContainer>
  );
}
