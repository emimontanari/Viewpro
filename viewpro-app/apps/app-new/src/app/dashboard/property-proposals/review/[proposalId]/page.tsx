'use client';

import { useParams } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { PropertyProposalReviewDetail } from '@/features/property-proposals/components/property-proposal-review-detail';
import {
  reviewerPropertyProposalAccess,
  usePropertyProposalAccess
} from '@/lib/property-proposal-access';
import { useActiveTenant } from '@/lib/session-context';

export default function PropertyProposalReviewPage() {
  const { proposalId } = useParams<{ proposalId?: string }>();
  const { isTenantLoading } = useActiveTenant();
  const { activeTenantId, enabled } = usePropertyProposalAccess(reviewerPropertyProposalAccess);

  if (isTenantLoading) return <p aria-busy='true'>Cargando propuesta…</p>;
  if (!enabled || !activeTenantId) return <p>No tenés acceso a la revisión de propuestas.</p>;
  if (!proposalId) return <p>No encontramos esta propuesta.</p>;

  return (
    <PageContainer pageTitle='Revisión de propuesta' pageDescription='Revisá los datos enviados y decidí sobre la ronda actual.'>
      <PropertyProposalReviewDetail tenantId={activeTenantId} proposalId={proposalId} enabled={enabled} />
    </PageContainer>
  );
}
