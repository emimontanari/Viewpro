'use client';

import FormCardSkeleton from '@/components/form-card-skeleton';
import dynamic from 'next/dynamic';

const DemoForm = dynamic(() => import('@/components/forms/demo-form'), {
  loading: () => <FormCardSkeleton />,
  ssr: false
});

export function BasicFormClient() {
  return <DemoForm />;
}
