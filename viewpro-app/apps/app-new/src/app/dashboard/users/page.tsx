import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Dashboard: Users'
};

export default function UsersPage() {
  return (
    <PageContainer
      pageTitle='Users'
      pageDescription='User management will be connected once the team backend contract is available.'
    >
      <Card>
        <CardHeader>
          <CardTitle>User management pending</CardTitle>
          <CardDescription>
            The backend does not yet expose production endpoints to list, invite, or update team members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='text-muted-foreground rounded-lg border p-6 text-sm'>
            This page no longer uses demo data. When the team backend contract is implemented, it will connect to real backend endpoints.
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
