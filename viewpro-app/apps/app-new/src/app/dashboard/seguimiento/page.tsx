import PageContainer from '@/components/layout/page-container';
import { ActivityMonitor } from '@/features/activity/components/activity-monitor';

export const metadata = {
  title: 'Dashboard: Seguimiento'
};

export default function Page() {
  return (
    <PageContainer
      pageTitle='Seguimiento'
      pageDescription='Últimas actualizaciones y propiedades que necesitan atención.'
    >
      <ActivityMonitor />
    </PageContainer>
  );
}
