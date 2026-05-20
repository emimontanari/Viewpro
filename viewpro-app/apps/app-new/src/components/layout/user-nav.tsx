'use client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { useSession } from '@/lib/session-context';
import { getUserDisplayName } from '@/lib/session';
import { useRouter } from 'next/navigation';
export function UserNav() {
  const { session, signOut } = useSession();
  const router = useRouter();
  const user = session?.user;
  if (user) {
    const fullName = getUserDisplayName(user);
    const avatarUser = {
      email: user.email,
      emailAddresses: [{ emailAddress: user.email }],
      fullName
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <UserAvatarProfile user={avatarUser} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' sideOffset={10} forceMount>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col space-y-1'>
              <p className='text-sm leading-none font-medium'>{fullName}</p>
              <p className='text-muted-foreground text-xs leading-none'>{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>Perfil</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/billing')}>Facturación</DropdownMenuItem>
              <DropdownMenuItem>Configuración</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/workspaces')}>Inmobiliarias</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await signOut();
              router.push('/auth/sign-in');
              router.refresh();
            }}
          >
            Salir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
}
