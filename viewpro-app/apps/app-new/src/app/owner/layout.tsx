import { OwnerShellHeader } from '@/features/owner/components/owner-shell-header';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portal propietario',
  description: 'Seguimiento de propiedades para propietarios',
  robots: {
    index: false,
    follow: false
  }
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='min-h-screen bg-muted/20'>
      <OwnerShellHeader />
      <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8'>
        {children}
      </main>
    </div>
  );
}
