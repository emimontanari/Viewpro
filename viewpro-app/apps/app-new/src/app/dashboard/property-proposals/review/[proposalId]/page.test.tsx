import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useParams } from 'next/navigation';
import { useActiveTenant } from '@/lib/session-context';
import { usePropertyProposalAccess } from '@/lib/property-proposal-access';
import PropertyProposalReviewPage from './page';

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
vi.mock('@/lib/session-context', () => ({ useActiveTenant: vi.fn() }));
vi.mock('@/lib/property-proposal-access', () => ({
  reviewerPropertyProposalAccess: {}, usePropertyProposalAccess: vi.fn()
}));
vi.mock('@/features/property-proposals/components/property-proposal-review-detail', () => ({
  PropertyProposalReviewDetail: ({ tenantId, proposalId, enabled }: { tenantId: string; proposalId: string; enabled: boolean }) =>
    <p>Detalle revisor {tenantId}/{proposalId}: {String(enabled)}</p>
}));
describe('PropertyProposalReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({ proposalId: 'proposal-1' });
    vi.mocked(useActiveTenant).mockReturnValue({ activeTenantId: 'tenant-1', isTenantLoading: false } as never);
    vi.mocked(usePropertyProposalAccess).mockReturnValue({ activeTenantId: 'tenant-1', enabled: true });
  });

  it('fails closed during loading, denied access, or missing tenant', () => {
    vi.mocked(useActiveTenant).mockReturnValue({ activeTenantId: null, isTenantLoading: true } as never);
    const { rerender } = render(<PropertyProposalReviewPage />);
    expect(screen.getByText('Cargando propuesta…')).toBeVisible();
    expect(screen.queryByText(/Detalle revisor/)).toBeNull();

    vi.mocked(useActiveTenant).mockReturnValue({ activeTenantId: 'tenant-1', isTenantLoading: false } as never);
    vi.mocked(usePropertyProposalAccess).mockReturnValue({ activeTenantId: 'tenant-1', enabled: false });
    rerender(<PropertyProposalReviewPage />);
    expect(screen.getByText('No tenés acceso a la revisión de propuestas.')).toBeVisible();
    expect(screen.queryByText(/Detalle revisor/)).toBeNull();

    vi.mocked(usePropertyProposalAccess).mockReturnValue({ activeTenantId: null, enabled: true });
    rerender(<PropertyProposalReviewPage />);
    expect(screen.getByText('No tenés acceso a la revisión de propuestas.')).toBeVisible();
  });
  it('mounts detail with the resolved reviewer tenant and exact route id', () => {
    render(<PropertyProposalReviewPage />);
    expect(screen.getByText('Detalle revisor tenant-1/proposal-1: true')).toBeVisible();
  });
});
