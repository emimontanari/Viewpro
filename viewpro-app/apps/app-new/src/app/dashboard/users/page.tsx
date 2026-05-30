import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getUsers } from '@/features/users/api/service';
import { TeamMembersList } from '@/features/users/components/team-members-list';
import { SELECTED_TENANT_COOKIE } from '@/lib/tenant-selection';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'Dashboard: Users'
};

export default async function UsersPage() {
  const team = await getUsers({}, { headers: await getTeamRequestHeaders() });

  return (
    <PageContainer
      pageTitle='Users'
      pageDescription='Read-only team members for the selected tenant.'
    >
      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>
            This list is backed by real tenant memberships. Invitations and role changes are planned
            for a later Stage 22 slice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMembersList members={team.items} />
        </CardContent>
      </Card>
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
