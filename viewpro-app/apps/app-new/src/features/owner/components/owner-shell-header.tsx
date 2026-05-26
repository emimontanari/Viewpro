'use client';

import { Button } from '@/components/ui/button';
import { getUserDisplayName } from '@/lib/session';
import { useSession } from '@/lib/session-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function OwnerShellHeader() {
  const { session, signOut } = useSession();
  const router = useRouter();
  const user = session?.user;
  const userLabel = getUserDisplayName(user) || user?.email || 'Propietario';

  return (
    <header className='sticky top-0 z-20 border-b bg-background/90 backdrop-blur'>
      <div className='mx-auto flex min-h-16 w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8'>
        <Link href='/owner' className='group min-w-0 space-y-0.5'>
          <div className='flex items-center gap-2'>
            <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm'>
              VP
            </span>
            <span className='text-lg font-semibold tracking-tight'>ViewPro</span>
          </div>
          <p className='text-sm text-muted-foreground group-hover:text-foreground'>
            Portal propietario
          </p>
        </Link>

        <div className='flex min-w-0 items-center justify-between gap-3 sm:justify-end'>
          <div className='min-w-0 text-sm'>
            <p className='truncate font-medium'>{userLabel}</p>
            {user?.email ? <p className='truncate text-muted-foreground'>{user.email}</p> : null}
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={async () => {
              await signOut();
              router.push('/auth/sign-in');
              router.refresh();
            }}
          >
            Salir
          </Button>
        </div>
      </div>
    </header>
  );
}
