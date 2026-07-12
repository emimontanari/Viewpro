import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ownerNavGroups } from '@/config/nav-config';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'Portal propietario',
  description: 'Seguimiento de propiedades para propietarios',
  robots: {
    index: false,
    follow: false
  }
};

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';

  return (
    <KBar navGroupsConfig={ownerNavGroups}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar navGroupsConfig={ownerNavGroups} variant='owner' />
        <SidebarInset>
          <Header />
          <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8'>
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </KBar>
  );
}
