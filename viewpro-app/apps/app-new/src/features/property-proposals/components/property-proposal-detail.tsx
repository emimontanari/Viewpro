'use client';

import { useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { hasErrorCode } from '@/lib/bff-client';
import {
  cancelAndRemovePropertyProposalQueries,
  sellerPropertyProposalDetailOptions
} from '../api/queries';
import type { PropertyProposalFields } from '../api/types';
import { PropertyProposalForm } from './property-proposal-form';
import { PropertyProposalHistory } from './property-proposal-history';
import { PropertyProposalStatusLabel } from './property-proposal-status-label';

type Props = { tenantId: string; proposalId: string; enabled: boolean };
type StagedField = Exclude<keyof PropertyProposalFields, 'title'>;
type StateConflict = { expectedVersion: number; submittedAt: number };
type EditAttempt = StateConflict & { context: string; conflictVersion?: number };

const stagedFields: readonly [StagedField, string][] = [
  ['addressLine', 'Dirección'],
  ['city', 'Ciudad'],
  ['province', 'Provincia'],
  ['propertyType', 'Tipo de propiedad'],
  ['operationType', 'Operación'],
  ['totalAreaSqm', 'Superficie total'],
  ['coveredAreaSqm', 'Superficie cubierta'],
  ['rooms', 'Ambientes'],
  ['bedrooms', 'Dormitorios'],
  ['bathrooms', 'Baños'],
  ['garages', 'Cocheras'],
  ['ageYears', 'Antigüedad'],
  ['orientation', 'Orientación'],
  ['ownerName', 'Nombre de propietario'],
  ['ownerEmail', 'Email de propietario'],
  ['publishedPriceCents', 'Precio publicado'],
  ['currency', 'Moneda']
];

export function PropertyProposalDetail({ tenantId, proposalId, enabled }: Props) {
  const queryClient = useQueryClient();
  useEffect(
    () => () => {
      void cancelAndRemovePropertyProposalQueries(queryClient, tenantId);
    },
    [queryClient, tenantId]
  );
  const context = `${tenantId}:${proposalId}`;
  const scope = useRef<{ context: string; attempt?: EditAttempt }>({ context });
  if (scope.current.context !== context) scope.current = { context };
  const conflicts = useMutationState({
    filters: { status: 'error' },
    select: (mutation): StateConflict | null => {
      const variables = mutation.state.variables as Record<string, unknown> | undefined;
      const expectedVersion = variables?.expectedVersion;
      return hasErrorCode(mutation.state.error, 'PROPERTY_PROPOSAL_STATE_CONFLICT') &&
        typeof expectedVersion === 'number'
        ? { expectedVersion, submittedAt: mutation.state.submittedAt }
        : null;
    }
  });
  const { data, error, isPending } = useQuery({
    ...sellerPropertyProposalDetailOptions(tenantId, proposalId),
    enabled: enabled && Boolean(tenantId) && Boolean(proposalId)
  });

  if (isPending) return <p aria-busy='true'>Cargando propuesta…</p>;
  if (hasErrorCode(error, 'PROPERTY_PROPOSAL_NOT_FOUND')) {
    return <p>No encontramos esta propuesta.</p>;
  }
  if (error) return <p role='alert'>No se pudo cargar la propuesta.</p>;
  if (!data) return <p>No encontramos esta propuesta.</p>;

  const attempt = scope.current.attempt;
  if (
    attempt?.context === context &&
    attempt.conflictVersion === undefined &&
    conflicts.some(
      (conflict) =>
        conflict !== null &&
        conflict.submittedAt >= attempt.submittedAt &&
        conflict.expectedVersion === attempt.expectedVersion
    ) &&
    data.version !== attempt.expectedVersion
  )
    attempt.conflictVersion = data.version;
  if (attempt?.conflictVersion !== undefined && attempt.conflictVersion !== data.version)
    scope.current.attempt = undefined;
  const showConflict = scope.current.attempt?.conflictVersion === data.version;
  const canonicalEngagementId =
    data.state === 'APROBADA' ? data.canonicalEngagementId?.trim() : undefined;

  return (
    <section aria-labelledby='proposal-detail-title'>
      <header>
        <h2 id='proposal-detail-title'>{data.title}</h2>
        <PropertyProposalStatusLabel state={data.state} />
        {canonicalEngagementId ? (
          <Link href={`/dashboard/product/${encodeURIComponent(canonicalEngagementId)}`}>
            Ver propiedad aprobada
          </Link>
        ) : null}
      </header>
      <section aria-labelledby='proposal-staged-title'>
        <h3 id='proposal-staged-title'>Datos de la propuesta</h3>
        <dl>
          {stagedFields.map(([field, label]) =>
            data[field] !== null && data[field] !== undefined ? (
              <div key={field}>
                <dt>{label}</dt>
                <dd>{data[field]}</dd>
              </div>
            ) : null
          )}
        </dl>
      </section>
      {data.state === 'BORRADOR' || data.state === 'RECHAZADA' ? (
        <section
          aria-labelledby='proposal-edit-title'
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest('button[type="button"]')) {
              scope.current.attempt = {
                context,
                expectedVersion: data.version,
                submittedAt: Date.now()
              };
            }
          }}
        >
          <h3 id='proposal-edit-title'>Editar propuesta</h3>
          <p>
            {data.state === 'RECHAZADA'
              ? 'Guardá los cambios y reenviá a revisión solo cuando estés lista.'
              : 'Guardá los cambios o enviá la propuesta a revisión cuando esté completa.'}
          </p>
          {showConflict ? (
            <p role='alert'>La propuesta cambió. Actualizá e intentá nuevamente.</p>
          ) : null}
          <PropertyProposalForm
            key={`${tenantId}:${data.id}:${data.version}`}
            tenantId={tenantId}
            proposal={data}
          />
        </section>
      ) : null}
      <PropertyProposalHistory history={data.history} />
    </section>
  );
}
