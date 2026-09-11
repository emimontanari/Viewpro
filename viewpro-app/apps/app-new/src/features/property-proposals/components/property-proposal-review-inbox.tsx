'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelAndRemovePropertyProposalQueries,
  reviewerPropertyProposalsOptions
} from '../api/queries';
import { PropertyProposalStatusLabel } from './property-proposal-status-label';

type Props = { tenantId: string; enabled: boolean };
const pageSize = 20;

export function PropertyProposalReviewInbox({ tenantId, enabled }: Props) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const queryEnabled = enabled && Boolean(tenantId);
  useEffect(
    () => () => {
      void cancelAndRemovePropertyProposalQueries(queryClient, tenantId);
    },
    [queryClient, tenantId]
  );
  const { data, error, isPending } = useQuery({
    ...reviewerPropertyProposalsOptions(tenantId, { state: 'EN_REVISION', page, pageSize }),
    enabled: queryEnabled
  });
  const currentPage = data?.page ?? page;
  const currentPageSize = data?.pageSize ?? pageSize;
  const hasNextPage = currentPage * currentPageSize < (data?.total ?? 0);

  if (!queryEnabled || isPending) return <p aria-busy='true'>Cargando propuestas para revisar…</p>;
  if (error) return <p role='alert'>No se pudieron cargar las propuestas.</p>;

  return (
    <section aria-labelledby='review-inbox-title'>
      <h2 id='review-inbox-title'>Propuestas para revisar</h2>
      {data?.items.length ? (
        <ul>
          {data.items.map((proposal) => (
            <li key={proposal.id} className='flex gap-2'>
              <span>{proposal.title}</span>
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
