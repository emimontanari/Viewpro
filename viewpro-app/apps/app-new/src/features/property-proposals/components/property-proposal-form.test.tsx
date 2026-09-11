import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff-client';
import { useCreateSellerPropertyProposal, useSubmitSellerPropertyProposal, useUpdateSellerPropertyProposal } from '../api/queries';
import type { SellerPropertyProposalDetail } from '../api/types';
import { PropertyProposalForm } from './property-proposal-form';

vi.mock('../api/queries', () => ({ useCreateSellerPropertyProposal: vi.fn(), useUpdateSellerPropertyProposal: vi.fn(), useSubmitSellerPropertyProposal: vi.fn() }));
const create = vi.fn(), update = vi.fn(), submit = vi.fn(), staleSubmit = vi.fn();
const detail = (extra: Partial<SellerPropertyProposalDetail> = {}): SellerPropertyProposalDetail => ({ id: 'proposal-1', state: 'BORRADOR', version: 2, title: 'Casa', addressLine: null, city: null, province: null, propertyType: null, operationType: null, totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: null, ownerEmail: null, publishedPriceCents: null, currency: null, history: [], currentReviewRoundId: undefined, canonicalEngagementId: undefined, latestSubmittedAt: null, createdAt: '', updatedAt: '', ...extra });
function setup(proposal?: SellerPropertyProposalDetail, strict = false) { const form = <PropertyProposalForm tenantId='tenant-1' proposal={proposal} />; return render(strict ? <StrictMode>{form}</StrictMode> : form); }
async function fill(user: ReturnType<typeof userEvent.setup>, omit?: string) {
  for (const [label, value] of [['Título', 'Casa'], ['Dirección', 'Calle 1'], ['Ciudad', 'Córdoba'], ['Provincia', 'Córdoba']] as const) if (label !== omit) { await user.clear(screen.getByLabelText(label)); await user.type(screen.getByLabelText(label), value); }
  if (omit !== 'Tipo de propiedad') await user.selectOptions(screen.getByLabelText('Tipo de propiedad'), 'HOUSE');
  if (omit !== 'Operación') await user.selectOptions(screen.getByLabelText('Operación'), 'SALE');
}
describe('PropertyProposalForm', () => {
  beforeEach(() => { vi.clearAllMocks(); create.mockResolvedValue(detail()); update.mockResolvedValue(detail({ version: 3 })); submit.mockResolvedValue(detail({ state: 'EN_REVISION', version: 4 })); staleSubmit.mockRejectedValue(new Error('stale submit hook invoked')); vi.mocked(useCreateSellerPropertyProposal).mockReturnValue({ mutateAsync: create } as never); vi.mocked(useUpdateSellerPropertyProposal).mockReturnValue({ mutateAsync: update } as never); vi.mocked(useSubmitSellerPropertyProposal).mockImplementation((_tenantId, proposalId) => ({ mutateAsync: proposalId === 'proposal-1' ? submit : staleSubmit }) as never); });
  it('uses the tenant-bound create hook for a trimmed title draft without image or canonical controls', async () => {
    const user = userEvent.setup(); setup(); await user.type(screen.getByLabelText('Título'), '  Casa  '); await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ title: 'Casa' })); expect(useCreateSellerPropertyProposal).toHaveBeenCalledWith('tenant-1'); expect(screen.queryByLabelText(/imagen/i)).toBeNull(); expect(screen.queryByRole('link')).toBeNull();
  });
  it('accepts a 120-character title and rejects 121 characters without mutation', async () => {
    const user = userEvent.setup(); setup(); await user.type(screen.getByLabelText('Título'), 'a'.repeat(120)); await user.click(screen.getByRole('button', { name: 'Guardar borrador' })); await waitFor(() => expect(create).toHaveBeenCalled());
    setup(); await user.type(screen.getAllByLabelText('Título')[1], 'a'.repeat(121)); await user.click(screen.getAllByRole('button', { name: 'Guardar borrador' })[1]); expect(screen.getByRole('alert')).toHaveTextContent('Ingresá un título válido.'); expect(create).toHaveBeenCalledTimes(1);
  });
  it.each(['Título', 'Dirección', 'Ciudad', 'Provincia', 'Tipo de propiedad', 'Operación'])('does not mutate when %s is absent from submission', async (omit) => {
    const user = userEvent.setup(); setup(); await fill(user, omit); await user.click(screen.getByRole('button', { name: 'Enviar a revisión' })); expect(create).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled();
  });
  it('creates complete fields then submits with the returned tenant-bound id and version', async () => {
    const user = userEvent.setup(); setup(undefined, true); await fill(user); await user.click(screen.getByRole('button', { name: 'Enviar a revisión' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ title: 'Casa', addressLine: 'Calle 1', city: 'Córdoba', province: 'Córdoba', propertyType: 'HOUSE', operationType: 'SALE' })); await waitFor(() => expect(useSubmitSellerPropertyProposal).toHaveBeenLastCalledWith('tenant-1', 'proposal-1')); await waitFor(() => expect(submit).toHaveBeenCalledWith({ expectedVersion: 2 })); expect(submit).toHaveBeenCalledTimes(1); expect(staleSubmit).not.toHaveBeenCalled();
  });
  it('runs the queued submit effect once when a pending form edit rerenders it', async () => {
    const user = userEvent.setup(); let resolve!: (value: SellerPropertyProposalDetail) => void; submit.mockReturnValueOnce(new Promise((done) => { resolve = done; })); setup(undefined, true); await fill(user); await user.click(screen.getByRole('button', { name: 'Enviar a revisión' })); await waitFor(() => expect(submit).toHaveBeenCalledTimes(1)); await user.type(screen.getByLabelText('Título'), '!'); expect(submit).toHaveBeenCalledTimes(1); resolve(detail({ state: 'EN_REVISION' })); await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar a revisión' })).not.toBeDisabled());
  });
  it('updates persisted fields then submits its returned authoritative version and status', async () => {
    const user = userEvent.setup(); setup(detail({ version: 7 })); await fill(user); await user.click(screen.getByRole('button', { name: 'Enviar a revisión' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ title: 'Casa', addressLine: 'Calle 1', city: 'Córdoba', province: 'Córdoba', propertyType: 'HOUSE', operationType: 'SALE', expectedVersion: 7 })); await waitFor(() => expect(submit).toHaveBeenCalledWith({ expectedVersion: 3 })); expect(useUpdateSellerPropertyProposal).toHaveBeenCalledWith('tenant-1', 'proposal-1'); expect(screen.getByRole('status')).toHaveTextContent('EN REVISIÓN');
  });
  it('deduplicates save and global submit-overlap pending actions without leaving promises unsettled', async () => {
    const user = userEvent.setup(); let resolve!: (value: SellerPropertyProposalDetail) => void; const waiting = new Promise<SellerPropertyProposalDetail>((done) => { resolve = done; }); update.mockReturnValueOnce(waiting); setup(detail({ version: 7 })); await fill(user); const send = screen.getByRole('button', { name: 'Enviar a revisión' }); await user.click(send); await user.click(send); await user.click(screen.getByRole('button', { name: 'Guardar borrador' })); expect(update).toHaveBeenCalledTimes(1); resolve(detail({ version: 3 })); await waitFor(() => expect(submit).toHaveBeenCalledWith({ expectedVersion: 3 }));
    let saveResolve!: (value: SellerPropertyProposalDetail) => void; update.mockReturnValueOnce(new Promise((done) => { saveResolve = done; })); setup(detail({ version: 7 })); await user.click(screen.getAllByRole('button', { name: 'Guardar borrador' })[1]); await user.click(screen.getAllByRole('button', { name: 'Guardar borrador' })[1]); expect(update).toHaveBeenCalledTimes(2); saveResolve(detail({ version: 8 })); await waitFor(() => expect(screen.getAllByRole('button', { name: 'Guardar borrador' })[1]).not.toBeDisabled());
  });
  it('renders conflict copy for a real BffError 409 without backend prose', async () => { const user = userEvent.setup(); create.mockRejectedValueOnce(new BffError(409, 'PROPERTY_PROPOSAL_STATE_CONFLICT')); setup(); await user.type(screen.getByLabelText('Título'), 'Casa'); await user.click(screen.getByRole('button', { name: 'Guardar borrador' })); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('La propuesta cambió. Actualizá e intentá nuevamente.')); });
  it('renders generic copy for non-409 BffError without backend prose', async () => { const user = userEvent.setup(); create.mockRejectedValueOnce(new BffError(422, 'PROPERTY_PROPOSAL_SUBMISSION_INCOMPLETE')); setup(); await user.type(screen.getByLabelText('Título'), 'Casa'); await user.click(screen.getByRole('button', { name: 'Guardar borrador' })); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar la propuesta.')); expect(screen.queryByText('No pudimos completar la solicitud.')).toBeNull(); });
  it('never renders hostile non-Bff error prose', async () => { const user = userEvent.setup(); create.mockRejectedValueOnce(new Error('hostile backend prose')); setup(); await user.type(screen.getByLabelText('Título'), 'Casa'); await user.click(screen.getByRole('button', { name: 'Guardar borrador' })); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar la propuesta.')); expect(screen.queryByText('hostile backend prose')).toBeNull(); });
});
