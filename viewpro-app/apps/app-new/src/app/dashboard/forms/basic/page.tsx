import PageContainer from '@/components/layout/page-container';
import { BasicFormClient } from './basic-form-client';

export const metadata = {
  title: 'Dashboard: Basic Form'
};

export default function Page() {
  return (
    <PageContainer
      pageTitle='Basic Form'
      pageDescription='A comprehensive form demo with all field types.'
    >
      <BasicFormClient />
    </PageContainer>
  );
}
