import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { InfoSidebar } from '@/components/layout/info-sidebar';
import { AdminAccessNotice } from '@/features/auth/components/admin-access-notice';
import { EmailVerificationBanner } from '@/features/auth/components/email-verification-banner';
import { InfobarProvider } from '@/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { BRAND } from '@/lib/brand/brand';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: BRAND.metadata.dashboardTitle,
  description: BRAND.metadata.defaultDescription,
  robots: {
    index: false,
    follow: false
  }
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Persisting the sidebar state in the cookie.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';
  return (
    <KBar>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <Suspense fallback={null}>
            <AdminAccessNotice />
          </Suspense>
          <EmailVerificationBanner />
          <InfobarProvider defaultOpen={false}>
            {children}
            <InfoSidebar side='right' />
          </InfobarProvider>
        </SidebarInset>
      </SidebarProvider>
    </KBar>
  );
}
