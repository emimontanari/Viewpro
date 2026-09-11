'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { sellerPropertyProposalsOptions } from '../api/queries';
import { PropertyProposalStatusLabel } from './property-proposal-status-label';

type Props = { tenantId: string; enabled: boolean };

export function PropertyProposalList({ tenantId, enabled }: Props) {
  const { data, error, isPending } = useQuery({
    ...sellerPropertyProposalsOptions(tenantId),
    enabled
  });

  if (isPending) return <p aria-busy='true'>Cargando propuestas…</p>;
  if (error) return <p role='alert'>No se pudieron cargar las propuestas.</p>;

  return <section>
    <Link href='/dashboard/property-proposals/new'>Crear propuesta</Link>
    {data?.items.length ? <ul>
      {data.items.map((proposal) => <li key={proposal.id} className='flex gap-2'>
        <span>{proposal.title}</span><PropertyProposalStatusLabel state={proposal.state} />
      </li>)}
    </ul> : <p>Todavía no creaste propuestas.</p>}
  </section>;
}
