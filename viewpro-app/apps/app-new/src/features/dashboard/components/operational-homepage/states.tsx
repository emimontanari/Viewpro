'use client';

/**
 * What the dashboard shows when it has nothing to show yet.
 */

import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

export function MissingInmobiliariaState() { return (
    <div className='rounded-3xl border bg-card p-8 text-center shadow-xs'>
      <div className='mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground'>
        <Icons.workspace className='size-6' />
      </div>
      <h1 className='text-2xl font-semibold'>Elegí una inmobiliaria para continuar</h1>
      <p className='mx-auto mt-2 max-w-xl text-sm text-muted-foreground'>
        Seleccioná una inmobiliaria desde el menú lateral para ver prioridades, propiedades y
        actividad reciente.
      </p>
      <Button asChild className='mt-5'>
        <Link href='/dashboard/workspaces'>Ir a inmobiliarias</Link>
      </Button>
    </div>
  );
}

export function OperationalHomepageSkeleton() { return (
    <section className='space-y-5' aria-label='Preparando inicio operativo'>
      <div className='h-64 animate-pulse rounded-3xl bg-muted' />
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className='h-36 animate-pulse rounded-2xl bg-muted' />
        ))}
      </div>
      <div className='grid gap-5 xl:grid-cols-2'>
        <div className='h-72 animate-pulse rounded-2xl bg-muted' />
        <div className='h-72 animate-pulse rounded-2xl bg-muted' />
      </div>
      <div className='grid gap-5 xl:grid-cols-2'>
        <div className='h-72 animate-pulse rounded-2xl bg-muted' />
        <div className='h-72 animate-pulse rounded-2xl bg-muted' />
      </div>
    </section>
  );
}
