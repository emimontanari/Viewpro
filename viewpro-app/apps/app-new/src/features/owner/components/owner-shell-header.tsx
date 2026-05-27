'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getUserDisplayName } from '@/lib/session';
import { useSession } from '@/lib/session-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function OwnerShellHeader() {
  const { session, signOut } = useSession();
  const router = useRouter();
  const user = session?.user;
  const userLabel = getUserDisplayName(user) || user?.email || 'Propietario';

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/sign-in');
    router.refresh();
  };

  return (
    <header className='sticky top-0 z-20 border-b bg-background/90 backdrop-blur'>
      <div className='mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8'>
        <Link href='/owner' className='group flex min-w-0 items-center gap-3'>
          <span className='flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-sm transition-transform group-hover:scale-105'>
            VP
          </span>
          <span className='min-w-0'>
            <span className='block truncate text-lg font-semibold leading-tight tracking-tight'>
              ViewPro
            </span>
            <span className='block truncate text-sm text-muted-foreground group-hover:text-foreground'>
              Portal propietario
            </span>
          </span>
        </Link>

        <div className='flex shrink-0 items-center gap-2'>
          <OwnerNotificationButton />
          <div className='hidden min-w-0 text-right text-sm md:block'>
            <p className='truncate font-medium'>{userLabel}</p>
            {user?.email ? <p className='truncate text-muted-foreground'>{user.email}</p> : null}
          </div>
          <Button type='button' variant='outline' size='sm' onClick={handleSignOut}>
            <Icons.logout className='size-4 md:hidden' aria-hidden='true' />
            <span className='hidden md:inline'>Salir</span>
            <span className='sr-only md:hidden'>Salir</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

function OwnerNotificationButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type='button' variant='ghost' size='icon' className='relative rounded-full'>
          <Icons.notification className='size-5' aria-hidden='true' />
          <span className='sr-only'>Notificaciones</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-[min(360px,calc(100vw-2rem))] p-4' sideOffset={10}>
        <div className='space-y-2'>
          <div className='flex items-center gap-2'>
            <span className='flex size-9 items-center justify-center rounded-full bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200'>
              <Icons.notification className='size-4' aria-hidden='true' />
            </span>
            <div>
              <h2 className='text-sm font-semibold'>Notificaciones</h2>
              <p className='text-xs text-muted-foreground'>Sin novedades nuevas</p>
            </div>
          </div>
          <p className='text-sm text-muted-foreground'>
            Los avances disponibles se muestran en el seguimiento de cada propiedad.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
