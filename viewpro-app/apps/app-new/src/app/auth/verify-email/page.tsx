import { Metadata } from 'next';
import { Suspense } from 'react';
import VerifyEmailViewPage from '@/features/auth/components/verify-email-view';

export const metadata: Metadata = {
  title: 'Verificar email',
  description: 'Verificá tu dirección de email.'
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailViewPage />
    </Suspense>
  );
}
