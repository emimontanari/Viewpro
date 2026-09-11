import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCreateSellerPropertyProposal,
  useSubmitSellerPropertyProposal,
  useUpdateSellerPropertyProposal
} from '../api/queries';
import type { SellerPropertyProposalDetail } from '../api/types';
import { PropertyProposalForm } from './property-proposal-form';

vi.mock('../api/queries', () => ({
  useCreateSellerPropertyProposal: vi.fn(),
  useSubmitSellerPropertyProposal: vi.fn(),
  useUpdateSellerPropertyProposal: vi.fn()
}));

const create = vi.fn(),
  update = vi.fn(),
  submit = vi.fn();
const proposal = (state: 'BORRADOR' | 'RECHAZADA'): SellerPropertyProposalDetail => ({
  id: 'proposal-1',
  state,
  version: 7,
  title: 'Casa',
  addressLine: 'Calle 1',
  city: 'Córdoba',
  province: 'Córdoba',
  propertyType: 'HOUSE',
  operationType: 'SALE',
  totalAreaSqm: null,
  coveredAreaSqm: null,
  rooms: null,
  bedrooms: null,
  bathrooms: null,
  garages: null,
  ageYears: null,
  orientation: null,
  ownerName: null,
  ownerEmail: null,
  publishedPriceCents: null,
  currency: null,
  history: [],
  currentReviewRoundId: undefined,
  canonicalEngagementId: undefined,
  latestSubmittedAt: null,
  createdAt: '',
  updatedAt: ''
});

describe('PropertyProposalForm existing saves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateSellerPropertyProposal).mockReturnValue({ mutateAsync: create } as never);
    vi.mocked(useUpdateSellerPropertyProposal).mockReturnValue({ mutateAsync: update } as never);
    vi.mocked(useSubmitSellerPropertyProposal).mockReturnValue({ mutateAsync: submit } as never);
  });

  it.each(['BORRADOR', 'RECHAZADA'] as const)(
    'preserves edited staged fields and never auto-submits %s',
    async (state) => {
      const user = userEvent.setup();
      update.mockResolvedValueOnce(proposal(state));
      render(<PropertyProposalForm tenantId='tenant-1' proposal={proposal(state)} />);
      await user.clear(screen.getByLabelText('Dirección'));
      await user.type(screen.getByLabelText('Dirección'), '   ');
      await user.clear(screen.getByLabelText('Ciudad'));
      await user.type(screen.getByLabelText('Ciudad'), 'Rosario');
      await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith({
          title: 'Casa',
          addressLine: null,
          city: 'Rosario',
          province: 'Córdoba',
          propertyType: 'HOUSE',
          operationType: 'SALE',
          expectedVersion: 7
        })
      );
      expect(submit).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent(state);
    }
  );
});
