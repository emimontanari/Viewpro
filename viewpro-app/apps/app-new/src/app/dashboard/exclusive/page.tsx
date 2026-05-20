'use client';

import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import Link from 'next/link';

export default function ExclusivePage() {
  return (
    <PageContainer>
      <div className='flex h-full items-center justify-center'>
        <Alert>
          <Icons.lock className='h-5 w-5 text-yellow-600' />
          <AlertDescription>
            <div className='mb-1 text-lg font-semibold'>Plan requerido</div>
            <div className='text-muted-foreground'>
              Esta sección se habilitará según el plan contratado. Podés revisar novedades en&nbsp;
              <Link className='underline' href='/dashboard/billing'>
                Facturación y planes
              </Link>
              .
            </div>
          </AlertDescription>
        </Alert>
      </div>
      <div className='mt-6 space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Área especial</CardTitle>
            <CardDescription>Contenido reservado para futuras funciones de planes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-lg'>Próximamente.</div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
