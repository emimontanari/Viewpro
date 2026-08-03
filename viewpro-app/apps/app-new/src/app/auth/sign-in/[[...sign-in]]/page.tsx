import { Metadata } from 'next';
import { Suspense } from 'react';
import SignInViewPage from '@/features/auth/components/sign-in-view';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Ingresá a tu cuenta.'
};

export default async function Page() {
  return (
    <Suspense fallback={null}>
      <SignInViewPage />
    </Suspense>
  );
}
