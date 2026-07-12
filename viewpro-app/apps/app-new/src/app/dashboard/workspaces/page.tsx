'use client';

import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { workspacesInfoContent } from '@/config/infoconfig';
import { useSession } from '@/lib/session-context';
import { getMembershipRoleLabel } from '@/lib/session';

export default function WorkspacesPage() {
  const { isLoading, session } = useSession();
  const memberships = session?.memberships ?? [];

  return (
    <PageContainer
      isLoading={isLoading}
      pageTitle='Inmobiliarias'
      pageDescription='Administrá las inmobiliarias disponibles para tu cuenta'
      infoContent={workspacesInfoContent}
    >
      <Card>
        <CardHeader>
          <CardTitle>Tus inmobiliarias</CardTitle>
          <CardDescription>Seleccioná una desde el menú lateral para trabajar con ella.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          {memberships.length ? (
            memberships.map((membership) => (
              <div key={membership.id} className='flex items-center gap-3 rounded-lg border p-4'>
                <div className='bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-lg'>
                  <Icons.galleryVerticalEnd className='size-4' />
                </div>
                <div className='min-w-0'>
                  <p className='truncate font-medium'>{membership.tenant.name}</p>
                  <p className='text-muted-foreground text-sm'>{getMembershipRoleLabel(membership.role)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className='text-muted-foreground rounded-lg border p-6 text-sm'>
              Todavía no hay inmobiliarias asociadas a tu cuenta.
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
