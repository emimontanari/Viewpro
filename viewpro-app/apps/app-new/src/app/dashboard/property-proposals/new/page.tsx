'use client';

import PageContainer from '@/components/layout/page-container';
import { PropertyProposalForm } from '@/features/property-proposals/components/property-proposal-form';
import { sellerPropertyProposalAccess, usePropertyProposalAccess } from '@/lib/property-proposal-access';
import { useActiveTenant } from '@/lib/session-context';

export default function NewPropertyProposalPage() {
  const { isTenantLoading } = useActiveTenant();
  const { activeTenantId, enabled } = usePropertyProposalAccess(sellerPropertyProposalAccess);
  if (isTenantLoading) return <p aria-busy='true'>Cargando propuesta…</p>;
  if (!enabled || !activeTenantId) return <p>No tenés acceso a propuestas de propiedades.</p>;
  return <PageContainer pageTitle='Nueva propuesta de propiedad' pageDescription='Guardá un borrador o envialo a revisión.'><PropertyProposalForm tenantId={activeTenantId} /></PageContainer>;
}
