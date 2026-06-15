import PageContainer from '@/components/layout/page-container';
import { StatusChangeRequestsBandejaPage } from '@/features/status-change-requests/components/status-change-requests-bandeja-page';

export const metadata = {
  title: 'Dashboard: Solicitudes de cambio de estado'
};

export default function Page() {
  return (
    <PageContainer
      pageTitle='Solicitudes de cambio de estado'
      pageDescription='Revisá y gestioná las solicitudes de cambio de estado enviadas por los vendedores.'
    >
      <StatusChangeRequestsBandejaPage />
    </PageContainer>
  );
}
