import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  PropertyProposalHistory as HistoryEntry,
  PropertyProposalSnapshot
} from '../api/types';
import { PropertyProposalHistory } from './property-proposal-history';

const snapshot: PropertyProposalSnapshot = {
  title: '<img src=x onerror=alert(1)> Casa enviada',
  addressLine: 'Calle Snapshot 123',
  city: 'Villa Allende',
  province: 'Córdoba',
  propertyType: 'HOUSE',
  operationType: 'SALE',
  totalAreaSqm: 120,
  coveredAreaSqm: 95,
  rooms: 4,
  bedrooms: 3,
  bathrooms: 2,
  garages: 1,
  ageYears: 8,
  orientation: null,
  ownerName: 'Ana Propietaria',
  ownerEmail: 'ana@example.com',
  publishedPriceCents: 12500000,
  currency: 'ARS'
};

function round(overrides: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: 'round-1',
    roundNumber: 1,
    submittedAt: '2026-09-03T12:00:00.000Z',
    submittedBy: { id: 'seller-1', firstName: 'Sofía', lastName: 'Vendedora' },
    snapshot,
    decision: null,
    ...overrides
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('PropertyProposalHistory', () => {
  it('renders the submitted snapshot fields without changing immutable backend order or input', () => {
    const history = deepFreeze([
      round({ id: 'round-3', roundNumber: 3, submittedAt: '2026-09-05T12:00:00.000Z' }),
      round({ id: 'round-2', roundNumber: 2, submittedAt: '2026-09-04T12:00:00.000Z' })
    ]);
    const original = structuredClone(history);

    render(<PropertyProposalHistory history={history} />);

    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    ).toEqual(['Ronda 3', 'Ronda 2']);
    expect(history).toEqual(original);
    for (const [label, value] of [
      ['Título', snapshot.title],
      ['Dirección', snapshot.addressLine],
      ['Ciudad', snapshot.city],
      ['Provincia', snapshot.province],
      ['Tipo de propiedad', snapshot.propertyType],
      ['Operación', snapshot.operationType],
      ['Superficie total', snapshot.totalAreaSqm],
      ['Superficie cubierta', snapshot.coveredAreaSqm],
      ['Ambientes', snapshot.rooms],
      ['Dormitorios', snapshot.bedrooms],
      ['Baños', snapshot.bathrooms],
      ['Cocheras', snapshot.garages],
      ['Antigüedad', snapshot.ageYears],
      ['Nombre de propietario', snapshot.ownerName],
      ['Email de propietario', snapshot.ownerEmail],
      ['Precio publicado', snapshot.publishedPriceCents],
      ['Moneda', snapshot.currency]
    ] as const) {
      for (const term of screen.getAllByText(label))
        expect(within(term.parentElement!).getByText(String(value))).toBeVisible();
    }
    expect(screen.queryByText('Orientación')).toBeNull();
    expect(screen.queryByText('Norte')).toBeNull();
    expect(screen.queryByText('Valor actual sin enviar')).toBeNull();
  });

  it('renders submitter, reviewer, dates, and pending, approved, and rejected outcomes', () => {
    const history = [
      round({ id: 'pending', roundNumber: 3, submittedAt: '2026-09-05T12:00:00.000Z' }),
      round({
        id: 'approved',
        roundNumber: 2,
        submittedAt: '2026-09-04T12:00:00.000Z',
        decision: {
          outcome: 'APPROVED',
          decidedAt: '2026-09-04T13:00:00.000Z',
          rejectionReason: null,
          reviewer: { id: 'manager-1', firstName: 'María', lastName: 'Revisora' }
        }
      }),
      round({
        id: 'rejected',
        roundNumber: 1,
        submittedAt: '2026-09-03T12:00:00.000Z',
        decision: {
          outcome: 'REJECTED',
          decidedAt: '2026-09-03T13:00:00.000Z',
          rejectionReason: '<script>alert(1)</script> Falta documentación',
          reviewer: { id: 'manager-2', firstName: 'Juan', lastName: null }
        }
      })
    ];

    const { container } = render(<PropertyProposalHistory history={history} />);

    expect(screen.getAllByText('Enviada por Sofía Vendedora')).toHaveLength(3);
    for (const date of [
      '2026-09-05T12:00:00.000Z',
      '2026-09-04T12:00:00.000Z',
      '2026-09-03T12:00:00.000Z'
    ]) {
      expect(screen.getByText(date)).toHaveAttribute('datetime', date);
    }
    expect(screen.getByText('Pendiente de revisión')).toBeVisible();
    expect(screen.getByText('Aprobada')).toBeVisible();
    expect(
      screen.getByText('Rechazada: <script>alert(1)</script> Falta documentación')
    ).toBeVisible();
    expect(screen.getByText('Revisada por María Revisora')).toBeVisible();
    expect(screen.getByText('Revisada por Juan')).toBeVisible();
    expect(screen.getByText('2026-09-04T13:00:00.000Z')).toHaveAttribute(
      'datetime',
      '2026-09-04T13:00:00.000Z'
    );
    expect(container.querySelectorAll('img, script, a, button')).toHaveLength(0);
  });

  it('renders a bounded empty history without mutation or canonical controls', () => {
    const history = deepFreeze([] as HistoryEntry[]);
    const { container } = render(<PropertyProposalHistory history={history} />);

    expect(screen.getByText('Todavía no hay envíos para esta propuesta.')).toBeVisible();
    expect(history).toEqual([]);
    expect(container.querySelectorAll('img, a, button, input, select, textarea')).toHaveLength(0);
  });
});
