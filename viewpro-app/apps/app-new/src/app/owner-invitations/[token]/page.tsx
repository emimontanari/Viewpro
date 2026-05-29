import type { Metadata } from 'next';
import { OwnerInvitationAcceptanceView } from '@/features/owner-invitations/components/owner-invitation-acceptance-view';

type PageProps = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: 'Aceptar invitación | ViewPro',
  description: 'Aceptá tu invitación para acceder al portal de propietarios de ViewPro.',
  robots: {
    follow: false,
    index: false
  }
};

export default async function OwnerInvitationPage({ params }: PageProps) {
  const { token } = await params;

  return <OwnerInvitationAcceptanceView token={token} />;
}
