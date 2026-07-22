import { Metadata } from 'next';
import { Suspense } from 'react';
import ResetPasswordViewPage from '@/features/auth/components/reset-password-view';

export const metadata: Metadata = {
  title: 'Nueva contraseña',
  description: 'Elegí una contraseña nueva para tu cuenta.'
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordViewPage />
    </Suspense>
  );
}
