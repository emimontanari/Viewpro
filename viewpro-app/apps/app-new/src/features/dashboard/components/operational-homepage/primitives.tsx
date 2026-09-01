/**
 * Shared presentational primitives. No data fetching: every value arrives
 * as a prop, so a change to how the dashboard loads cannot reach them.
 */

import Link from 'next/link';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ROW_ACTION_CLASS } from './constants';

export function KpiCard({
  helper,
  icon: Icon,
  isLoading,
  label,
  value
}: {
  helper: string;
  icon: typeof Icons.product;
  isLoading: boolean;
  label: string;
  value: number;
}) {
  return (
    <Card className='py-0'>
      <CardContent className='flex items-start gap-4 p-5'>
        <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'>
          <Icon className='size-5' />
        </div>
        <div className='min-w-0 space-y-1'>
          <p className='text-sm font-medium text-muted-foreground'>{label}</p>
          {isLoading ? (
            <div className='h-8 w-16 animate-pulse rounded bg-muted' />
          ) : (
            <p className='text-3xl font-semibold tracking-tight'>{value}</p>
          )}
          <p className='text-sm text-muted-foreground'>{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyPanel({
  description,
  icon: Icon,
  title
}: {
  description: string;
  icon: typeof Icons.product;
  title: string;
}) {
  return (
    <div className='rounded-2xl border border-dashed bg-muted/20 p-6 text-center'>
      <div className='mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground'>
        <Icon className='size-5' />
      </div>
      <p className='font-medium'>{title}</p>
      <p className='mx-auto mt-1 max-w-md text-sm text-muted-foreground'>{description}</p>
    </div>
  );
}

export function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className='space-y-3' aria-label='Cargando resumen operativo'>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className='space-y-3 rounded-2xl border p-3'>
          <div className='h-4 w-24 animate-pulse rounded bg-muted' />
          <div className='h-5 w-2/3 animate-pulse rounded bg-muted' />
          <div className='h-4 w-full animate-pulse rounded bg-muted' />
        </div>
      ))}
    </div>
  );
}

export function DashboardRowActionLink({
  ariaLabel,
  href,
  label = 'Abrir'
}: {
  ariaLabel: string;
  href: string;
  label?: string;
}) {
  return (
    <Button asChild variant='outline' size='sm' className={cn('shrink-0', ROW_ACTION_CLASS)}>
      <Link href={href} aria-label={ariaLabel}>
        <span className='sm:sr-only'>{label}</span>
        <Icons.externalLink className='size-4' aria-hidden='true' />
      </Link>
    </Button>
  );
}
