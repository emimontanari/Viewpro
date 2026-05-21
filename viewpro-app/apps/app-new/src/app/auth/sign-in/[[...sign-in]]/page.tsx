import { Metadata } from 'next';
import { Suspense } from 'react';
import SignInViewPage from '@/features/auth/components/sign-in-view';

export const metadata: Metadata = {
  title: 'Authentication | Sign In',
  description: 'Sign In page for authentication.'
};

export default async function Page() {
  return (
    <Suspense fallback={null}>
      <SignInViewPage />
    </Suspense>
  );
}
