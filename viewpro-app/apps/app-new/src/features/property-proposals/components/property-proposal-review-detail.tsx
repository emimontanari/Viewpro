'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { hasErrorCode } from '@/lib/bff-client';
import {
  cancelAndRemovePropertyProposalQueries,
  reviewerPropertyProposalDetailOptions,
  useApproveReviewerPropertyProposal,
  useRejectReviewerPropertyProposal
} from '../api/queries';
import { propertyProposalErrorCopy } from '../api/service';
import type { PropertyProposalFields } from '../api/types';
import { PropertyProposalHistory } from './property-proposal-history';
import { PropertyProposalStatusLabel } from './property-proposal-status-label';
import { PropertyProposalReviewRejectDialog } from './property-proposal-review-reject-dialog';

type Props = { tenantId: string; proposalId: string; enabled: boolean };
type StagedField = Exclude<keyof PropertyProposalFields, 'title'>;
const fields: readonly [StagedField, string][] = [
  ['addressLine', 'Dirección'], ['city', 'Ciudad'], ['province', 'Provincia'],
  ['propertyType', 'Tipo de propiedad'], ['operationType', 'Operación'],
  ['totalAreaSqm', 'Superficie total'], ['coveredAreaSqm', 'Superficie cubierta'],
  ['rooms', 'Ambientes'], ['bedrooms', 'Dormitorios'], ['bathrooms', 'Baños'],
  ['garages', 'Cocheras'], ['ageYears', 'Antigüedad'], ['orientation', 'Orientación'],
  ['ownerName', 'Nombre de propietario'], ['ownerEmail', 'Email de propietario'],
  ['publishedPriceCents', 'Precio publicado'], ['currency', 'Moneda']
];

export function PropertyProposalReviewDetail({ tenantId, proposalId, enabled }: Props) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [decisionError, setDecisionError] = useState<string>();
  const approveMutation = useApproveReviewerPropertyProposal(tenantId, proposalId);
  const rejectMutation = useRejectReviewerPropertyProposal(tenantId, proposalId);
  const pending = approveMutation.isPending || rejectMutation.isPending;
  useEffect(
    () => () => { void cancelAndRemovePropertyProposalQueries(queryClient, tenantId); },
    [queryClient, tenantId]
  );
  const { data, error, isPending } = useQuery({
    ...reviewerPropertyProposalDetailOptions(tenantId, proposalId),
    enabled: enabled && Boolean(tenantId) && Boolean(proposalId)
  });

  if (isPending) return <p aria-busy='true'>Cargando propuesta…</p>;
  if (hasErrorCode(error, 'PROPERTY_PROPOSAL_NOT_FOUND')) return <p>No encontramos esta propuesta.</p>;
  if (error) return <p role='alert'>No se pudo cargar la propuesta.</p>;
  if (!data) return <p>No encontramos esta propuesta.</p>;

  const currentReviewRoundId = data.currentReviewRoundId;
  const actionable = data.state === 'EN_REVISION' && Boolean(currentReviewRoundId);
  const canonicalEngagementId = data.state === 'APROBADA' ? data.canonicalEngagementId?.trim() : undefined;
  const proposerName = [data.proposedBy.firstName, data.proposedBy.lastName].filter(Boolean).join(' ');

  async function approveCurrentRound() {
    if (!actionable || !currentReviewRoundId || pending) return;
    setDecisionError(undefined);
    try {
      await approveMutation.mutateAsync({ reviewRoundId: currentReviewRoundId });
    } catch (mutationError) {
      setDecisionError(propertyProposalErrorCopy(mutationError, 'No se pudo aprobar la propuesta.'));
    }
  }

  async function rejectCurrentRound(reason: string) {
    if (!actionable || !currentReviewRoundId || pending) return;
    setDecisionError(undefined);
    try {
      await rejectMutation.mutateAsync({ reviewRoundId: currentReviewRoundId, reason });
      setRejecting(false);
    } catch (mutationError) {
      setDecisionError(propertyProposalErrorCopy(mutationError, 'No se pudo rechazar la propuesta.'));
    }
  }

  return (
    <section aria-labelledby='review-detail-title'>
      <header>
        <h2 id='review-detail-title'>{data.title}</h2>
        <PropertyProposalStatusLabel state={data.state} />
        <p>Propuesta de {proposerName}</p>
        {canonicalEngagementId ? (
          <Link href={`/dashboard/product/${encodeURIComponent(canonicalEngagementId)}`}>Ver propiedad aprobada</Link>
        ) : null}
      </header>
      {decisionError ? <p role='alert'>{decisionError}</p> : null}
      <section aria-labelledby='review-fields-title'>
        <h3 id='review-fields-title'>Datos enviados a revisión</h3>
        <dl>
          {fields.map(([field, label]) => data[field] !== null && data[field] !== undefined ? (
            <div key={field}><dt>{label}</dt><dd>{data[field]}</dd></div>
          ) : null)}
        </dl>
      </section>
      {actionable ? (
        <section aria-label='Decisión sobre la ronda actual'>
          <button type='button' onClick={approveCurrentRound} disabled={pending}>Aprobar propuesta</button>
          <button type='button' onClick={() => setRejecting(true)} disabled={pending}>Rechazar propuesta</button>
          {rejecting ? (
            <PropertyProposalReviewRejectDialog
              pending={pending}
              onCancel={() => setRejecting(false)}
              onSubmit={rejectCurrentRound}
            />
          ) : null}
        </section>
      ) : null}
      <PropertyProposalHistory history={data.history} />
    </section>
  );
}
