'use client';

import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/session-context';
import { getUserDisplayName, getUserStatusLabel } from '@/lib/session';

export default function ProfileViewPage() {
  const { isLoading, session } = useSession();
  const user = session?.user;

  return (
    <PageContainer isLoading={isLoading} pageTitle='Perfil' pageDescription='Datos de tu cuenta'>
      <Card>
        <CardHeader>
          <CardTitle>{user ? getUserDisplayName(user) : 'Perfil'}</CardTitle>
          <CardDescription>La edición de datos se conectará en una próxima etapa.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-2 text-sm'>
          <div>
            <span className='text-muted-foreground'>Email: </span>
            <span>{user?.email}</span>
          </div>
          <div>
            <span className='text-muted-foreground'>Estado: </span>
            <span>{getUserStatusLabel(user?.status)}</span>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
