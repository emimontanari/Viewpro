import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import Link from 'next/link';

/**
 * Where a dual-context identity chooses which portal to enter.
 *
 * One person can legitimately be both a seller in an agency and the owner of a
 * property. Routing used to consider memberships first, so any membership kept
 * the dashboard and the owner portal was never offered — and the dashboard
 * sidebar carries no link to it either (#326).
 *
 * Both destinations are literals owned by this component: the chooser is not a
 * place to introduce a new redirect surface. Choosing a portal grants nothing —
 * each side is still guarded by its own backend authorization.
 */
export function PortalChooserView() {
  return (
    <main className='flex min-h-svh items-center justify-center p-6'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <h1 className='text-2xl font-bold'>¿Dónde querés entrar?</h1>
          <CardDescription>
            Tu cuenta trabaja en una inmobiliaria y también sigue propiedades como propietario.
            Podés cambiar de portal cuando quieras.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <Link
            href='/dashboard'
            className='hover:bg-accent focus-visible:ring-ring rounded-lg border p-4 focus-visible:ring-2 focus-visible:outline-none'
          >
            <span className='block font-medium'>Trabajar en la inmobiliaria</span>
            <span className='text-muted-foreground block text-sm'>
              Propiedades, seguimiento y equipo.
            </span>
          </Link>
          <Link
            href='/owner'
            className='hover:bg-accent focus-visible:ring-ring rounded-lg border p-4 focus-visible:ring-2 focus-visible:outline-none'
          >
            <span className='block font-medium'>Ver mis propiedades</span>
            <span className='text-muted-foreground block text-sm'>
              El estado de las propiedades de las que sos propietario.
            </span>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
