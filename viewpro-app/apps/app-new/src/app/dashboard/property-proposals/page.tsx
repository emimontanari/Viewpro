'use client';

import PageContainer from '@/components/layout/page-container';
import { PropertyProposalList } from '@/features/property-proposals/components/property-proposal-list';
import { sellerPropertyProposalAccess, usePropertyProposalAccess } from '@/lib/property-proposal-access';
import { useActiveTenant } from '@/lib/session-context';

export default function PropertyProposalsPage() {
  const { isTenantLoading } = useActiveTenant();
  const { activeTenantId, enabled } = usePropertyProposalAccess(sellerPropertyProposalAccess);

  if (isTenantLoading) return <p aria-busy='true'>Cargando propuestas…</p>;
  if (!enabled || !activeTenantId) return <p>No tenés acceso a propuestas de propiedades.</p>;

  return <PageContainer
    pageTitle='Propuestas de propiedades'
    pageDescription='Revisá el estado de tus propuestas.'
  >
    <PropertyProposalList tenantId={activeTenantId} enabled={enabled} />
  </PageContainer>;
}
