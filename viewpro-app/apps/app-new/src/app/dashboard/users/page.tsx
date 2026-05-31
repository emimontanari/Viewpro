import PageContainer from '@/components/layout/page-container';
import { getUsers } from '@/features/users/api/service';
import { TeamManagementSection } from '@/features/users/components/team-management-section';
import { SELECTED_TENANT_COOKIE } from '@/lib/tenant-selection';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'Dashboard: Equipo'
};

export default async function UsersPage() {
  const team = await getUsers({}, { headers: await getTeamRequestHeaders() });

  return (
    <PageContainer pageTitle='Equipo' pageDescription='Miembros reales del tenant seleccionado.'>
      <TeamManagementSection members={team.items} />
    </PageContainer>
  );
}

async function getTeamRequestHeaders() {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const outgoingHeaders = new Headers();
  const cookieHeader = cookieStore.toString();
  const selectedTenantId =
    requestHeaders.get('x-tenant-id') ?? cookieStore.get(SELECTED_TENANT_COOKIE)?.value;

  if (cookieHeader) {
    outgoingHeaders.set('cookie', cookieHeader);
  }

  if (selectedTenantId) {
    outgoingHeaders.set('x-tenant-id', selectedTenantId);
  }

  return outgoingHeaders;
}
