'use client';

import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { billingInfoContent } from '@/config/infoconfig';
import { useActiveTenant } from '@/lib/session-context';

export default function BillingPage() {
  const { activeMembership, hasMemberships, isTenantLoading } = useActiveTenant();
  const activeBusiness = activeMembership?.tenant.name;

  return (
    <PageContainer
      isLoading={isTenantLoading}
      access={isTenantLoading || hasMemberships}
      accessFallback={
        <div className='flex min-h-[400px] items-center justify-center'>
          <div className='space-y-2 text-center'>
            <h2 className='text-2xl font-semibold'>No hay una inmobiliaria seleccionada</h2>
            <p className='text-muted-foreground'>
              Creá o seleccioná una inmobiliaria para ver esta sección.
            </p>
          </div>
        </div>
      }
      infoContent={billingInfoContent}
      pageTitle='Facturación y planes'
      pageDescription={`Administrá la suscripción de ${activeBusiness ?? 'tu inmobiliaria'}`}
    >
      <div className='space-y-6'>
        <Alert>
          <Icons.info className='h-4 w-4' />
          <AlertDescription>
            La gestión de planes se conectará en una próxima etapa. Esta pantalla mantiene el
            espacio visual mientras se completa esa integración.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Planes disponibles</CardTitle>
            <CardDescription>Próximamente vas a poder elegir el plan desde acá.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-muted-foreground rounded-lg border p-6 text-sm'>
              La facturación todavía no está disponible en esta versión.
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
