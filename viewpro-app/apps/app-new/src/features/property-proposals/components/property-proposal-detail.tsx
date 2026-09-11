'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { hasErrorCode } from '@/lib/bff-client';
import { sellerPropertyProposalDetailOptions } from '../api/queries';
import type { PropertyProposalFields } from '../api/types';
import { PropertyProposalHistory } from './property-proposal-history';
import { PropertyProposalStatusLabel } from './property-proposal-status-label';

type Props = { tenantId: string; proposalId: string; enabled: boolean };
type StagedField = Exclude<keyof PropertyProposalFields, 'title'>;

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
      <PropertyProposalHistory history={data.history} />
    </section>
  );
}
