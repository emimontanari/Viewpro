import type { PropertyProposalStatus } from '../api/types';

const labels: Record<PropertyProposalStatus, string> = {
  BORRADOR: 'BORRADOR', EN_REVISION: 'EN REVISIÓN', APROBADA: 'APROBADA', RECHAZADA: 'RECHAZADA'
};

export function PropertyProposalStatusLabel({ state }: { state: PropertyProposalStatus }) {
  return <span role='status' className='rounded-full border px-2 py-1 text-xs font-medium'>{labels[state]}</span>;
}
