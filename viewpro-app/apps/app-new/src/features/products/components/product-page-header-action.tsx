'use client';

import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { canManagePropertyEngagements } from '@/lib/session';
import { useActiveTenant } from '@/lib/session-context';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function ProductPageHeaderAction() {
  const { activeMembership, isTenantLoading } = useActiveTenant();

  if (isTenantLoading || !canManagePropertyEngagements(activeMembership)) {
    return null;
  }

  return (
    <Link href='/dashboard/product/new' className={cn(buttonVariants(), 'text-xs md:text-sm')}>
      <Icons.add className='mr-2 h-4 w-4' /> Nueva propiedad
    </Link>
  );
}
