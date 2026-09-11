import type {
  PropertyProposalHistory as PropertyProposalHistoryEntry,
  PropertyProposalSnapshot
} from '../api/types';

type Props = { history: readonly PropertyProposalHistoryEntry[] };
type SnapshotField = keyof PropertyProposalSnapshot;

const snapshotFields: readonly [SnapshotField, string][] = [
  ['title', 'Título'],
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

export function PropertyProposalHistory({ history }: Props) {
  if (history.length === 0) return <p>Todavía no hay envíos para esta propuesta.</p>;

  return (
    <section aria-labelledby='proposal-history-title'>
      <h2 id='proposal-history-title'>Historial de revisiones</h2>
      <ol>
        {history.map((round) => (
          <li key={round.id}>
            <h3>Ronda {round.roundNumber}</h3>
            <p>Enviada por {personName(round.submittedBy)}</p>
            <time dateTime={round.submittedAt}>{round.submittedAt}</time>
            <dl data-history-snapshot>
              {snapshotFields.map(([field, label]) =>
                round.snapshot[field] !== null && round.snapshot[field] !== undefined ? (
                  <div key={field}>
                    <dt>{label}</dt>
                    <dd>{round.snapshot[field]}</dd>
                  </div>
                ) : null
              )}
            </dl>
            {round.decision ? (
              <div>
                <p>
                  {round.decision.outcome === 'APPROVED'
                    ? 'Aprobada'
                    : `Rechazada: ${round.decision.rejectionReason ?? 'Sin motivo'}`}
                </p>
                <p>Revisada por {personName(round.decision.reviewer)}</p>
                <time dateTime={round.decision.decidedAt}>{round.decision.decidedAt}</time>
              </div>
            ) : (
              <p>Pendiente de revisión</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function personName(person: { firstName: string; lastName: string | null }): string {
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}
