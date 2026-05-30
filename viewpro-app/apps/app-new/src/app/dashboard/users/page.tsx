import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getUsers } from '@/features/users/api/service';
import { TeamMembersList } from '@/features/users/components/team-members-list';

export const metadata = {
  title: 'Dashboard: Users'
};

export default async function UsersPage() {
  const team = await getUsers();

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
