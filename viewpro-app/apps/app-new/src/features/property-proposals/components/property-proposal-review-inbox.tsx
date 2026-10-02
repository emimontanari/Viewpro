'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type {
  PropertyProposalHistoryFilter,
  PropertyProposalStatus
} from '../api/types';
import {
  reviewerPropertyProposalsOptions,
  usePurgePreviousTenantPropertyProposalQueries
} from '../api/queries';
import { PropertyProposalStatusLabel } from './property-proposal-status-label';

type Props = { tenantId: string; enabled: boolean };
const pageSize = 20;

export function PropertyProposalReviewInbox({ tenantId, enabled }: Props) {
  const [page, setPage] = useState(1);
  const [state, setState] = useState<PropertyProposalStatus>('EN_REVISION');
  const [history, setHistory] = useState<PropertyProposalHistoryFilter | ''>('');
  const queryEnabled = enabled && Boolean(tenantId);
  usePurgePreviousTenantPropertyProposalQueries(tenantId);
  const { data, error, isPending } = useQuery({
    ...reviewerPropertyProposalsOptions(tenantId, {
      state,
      ...(history ? { history } : {}),
      page,
      pageSize
    }),
    enabled: queryEnabled
  });
  const currentPage = page;
  const currentPageSize = data?.pageSize ?? pageSize;
  const hasNextPage = currentPage * currentPageSize < (data?.total ?? 0);

  if (!queryEnabled || isPending) return <p aria-busy='true'>Cargando propuestas para revisar…</p>;
  if (error) return <p role='alert'>No se pudieron cargar las propuestas.</p>;

  return (
    <section aria-labelledby='review-inbox-title'>
      <h2 id='review-inbox-title'>Propuestas para revisar</h2>
      <div>
        <label>
          Estado
          <select
            value={state}
            onChange={(event) => {
              setState(event.target.value as PropertyProposalStatus);
              setPage(1);
            }}
          >
            <option value='BORRADOR'>Borrador</option>
            <option value='EN_REVISION'>En revisión</option>
            <option value='APROBADA'>Aprobada</option>
            <option value='RECHAZADA'>Rechazada</option>
          </select>
        </label>
        <label>
          Historial
          <select
            value={history}
            onChange={(event) => {
              setHistory(event.target.value as PropertyProposalHistoryFilter | '');
              setPage(1);
            }}
          >
            <option value=''>Cualquier historial</option>
            <option value='NONE'>Sin historial de revisión</option>
            <option value='PENDING'>Pendiente</option>
            <option value='REJECTED'>Rechazada</option>
            <option value='APPROVED'>Aprobada</option>
          </select>
        </label>
      </div>
      {data?.items.length ? (
        <ul>
          {data.items.map((proposal) => (
            <li key={proposal.id} className='flex gap-2'>
              <Link href={`/dashboard/property-proposals/review/${encodeURIComponent(proposal.id)}`}>
                {proposal.title}
              </Link>
              <span>
                {[proposal.proposedBy.firstName, proposal.proposedBy.lastName]
                  .filter(Boolean)
                  .join(' ')}
              </span>
              <PropertyProposalStatusLabel state={proposal.state} />
            </li>
          ))}
        </ul>
      ) : (
        <p>No hay propuestas para revisar.</p>
      )}
      <div>
        <button type='button' disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
          Anterior
        </button>
        <span>Página {currentPage}</span>
        <button type='button' disabled={!hasNextPage} onClick={() => setPage(currentPage + 1)}>
          Siguiente
        </button>
      </div>
    </section>
  );
}
