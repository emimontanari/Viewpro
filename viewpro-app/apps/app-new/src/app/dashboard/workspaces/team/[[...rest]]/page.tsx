'use client';

import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { teamInfoContent } from '@/config/infoconfig';

export default function TeamPage() {
  return (
    <PageContainer
      pageTitle='Equipo'
      pageDescription='Administrá miembros, roles y seguridad.'
      infoContent={teamInfoContent}
    >
      <Card>
        <CardHeader>
          <CardTitle>Gestión de equipo</CardTitle>
          <CardDescription>Esta funcionalidad se conectará en una próxima etapa.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='text-muted-foreground rounded-lg border p-6 text-sm'>
            La administración de miembros todavía no está disponible en esta versión.
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
