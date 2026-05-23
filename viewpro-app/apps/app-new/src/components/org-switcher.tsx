'use client';

import { Icons } from '@/components/icons';
import { useRouter } from 'next/navigation';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar';
import { getMembershipRoleLabel } from '@/lib/session';
import { useActiveTenant } from '@/lib/session-context';
import { setSelectedTenantId } from '@/lib/tenant-selection';

export function OrgSwitcher() {
  const { isMobile, state } = useSidebar();
  const router = useRouter();
  const { activeMembership, isTenantLoading, memberships } = useActiveTenant();

  const handleOrganizationSwitch = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    router.refresh();
  };

  if (isTenantLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size='lg' disabled>
            <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg'>
              <Icons.galleryVerticalEnd className='size-4' />
            </div>
            <div
              className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
                state === 'collapsed'
                  ? 'invisible max-w-0 overflow-hidden opacity-0'
                  : 'visible max-w-full opacity-100'
              }`}
            >
              <span className='truncate font-medium'>Cargando...</span>
              <span className='text-muted-foreground truncate text-xs'>Inmobiliarias</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!activeMembership) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size='lg'
            onClick={() => router.push('/dashboard/workspaces')}
            className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
          >
            <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg'>
              <Icons.add className='size-4' />
            </div>
            <div
              className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
                state === 'collapsed'
                  ? 'invisible max-w-0 overflow-hidden opacity-0'
                  : 'visible max-w-full opacity-100'
              }`}
            >
              <span className='truncate font-medium'>Crear inmobiliaria</span>
              <span className='text-muted-foreground truncate text-xs'>Empezar</span>
            </div>
            <Icons.chevronsUpDown
              className={`ml-auto transition-all duration-200 ease-in-out ${
                state === 'collapsed'
                  ? 'invisible max-w-0 opacity-0'
                  : 'visible max-w-full opacity-100'
              }`}
            />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg'>
                <Icons.galleryVerticalEnd className='size-4' />
              </div>
              <div
                className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
                  state === 'collapsed'
                    ? 'invisible max-w-0 overflow-hidden opacity-0'
                    : 'visible max-w-full opacity-100'
                }`}
              >
                <span className='truncate font-medium'>{activeMembership.tenant.name}</span>
                <span className='text-muted-foreground truncate text-xs'>
                  {getMembershipRoleLabel(activeMembership.role)}
                </span>
              </div>
              <Icons.chevronsUpDown
                className={`ml-auto transition-all duration-200 ease-in-out ${
                  state === 'collapsed'
                    ? 'invisible max-w-0 opacity-0'
                    : 'visible max-w-full opacity-100'
                }`}
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-muted-foreground text-xs'>
              Inmobiliarias
            </DropdownMenuLabel>
            {memberships.map((membership, index) => {
              const isActive = membership.tenant.id === activeMembership.tenant.id;
              return (
                <DropdownMenuItem
                  key={membership.id}
                  onClick={() => handleOrganizationSwitch(membership.tenant.id)}
                  className='gap-2 p-2'
                >
                  <div className='flex size-6 items-center justify-center overflow-hidden rounded-md border'>
                    <Icons.galleryVerticalEnd className='size-3.5 shrink-0' />
                  </div>
                  {membership.tenant.name}
                  {isActive ? <Icons.check className='ml-auto size-4' /> : null}
                  {!isActive ? <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut> : null}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='gap-2 p-2'
              onClick={() => router.push('/dashboard/workspaces')}
            >
              <div className='flex size-6 items-center justify-center rounded-md border bg-transparent'>
                <Icons.add className='size-4' />
              </div>
              <div className='text-muted-foreground font-medium'>Administrar inmobiliarias</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
