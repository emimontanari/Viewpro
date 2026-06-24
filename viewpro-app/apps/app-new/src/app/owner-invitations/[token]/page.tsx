import { BRAND } from '@/lib/brand/brand';
import type { Metadata } from 'next';
import { OwnerInvitationAcceptanceView } from '@/features/owner-invitations/components/owner-invitation-acceptance-view';

type PageProps = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: BRAND.invitations.ownerTitle,
  description: BRAND.invitations.ownerDescription,
  robots: {
    follow: false,
    index: false
  }
};

export default async function OwnerInvitationPage({ params }: PageProps) {
  const { token } = await params;

  return <OwnerInvitationAcceptanceView token={token} />;
}
