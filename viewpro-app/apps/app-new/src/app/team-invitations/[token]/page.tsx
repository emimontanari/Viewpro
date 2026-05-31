import type { Metadata } from 'next';
import { TeamInvitationAcceptanceView } from '@/features/team-invitations/components/team-invitation-acceptance-view';

type PageProps = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: 'Aceptar invitación de equipo | ViewPro',
  description: 'Aceptá tu invitación para sumarte a una inmobiliaria en ViewPro.',
  robots: {
    follow: false,
    index: false
  }
};

export default async function TeamInvitationPage({ params }: PageProps) {
  const { token } = await params;

  return <TeamInvitationAcceptanceView token={token} />;
}
