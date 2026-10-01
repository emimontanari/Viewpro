import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveTenant } from '@/lib/session-context';
import { usePropertyProposalAccess } from '@/lib/property-proposal-access';
import PropertyProposalReviewPage from './page';

vi.mock('@/lib/session-context', () => ({ useActiveTenant: vi.fn() }));
vi.mock('@/lib/property-proposal-access', () => ({
  reviewerPropertyProposalAccess: {}, usePropertyProposalAccess: vi.fn()
}));
vi.mock('@/features/property-proposals/components/property-proposal-review-inbox', () => ({
  PropertyProposalReviewInbox: ({ tenantId, enabled }: { tenantId: string; enabled: boolean }) =>
    <p>Inbox para {tenantId}: {String(enabled)}</p>
}));

describe('PropertyProposalReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useActiveTenant).mockReturnValue({ activeTenantId: 'tenant-1', isTenantLoading: false } as never);
    vi.mocked(usePropertyProposalAccess).mockReturnValue({ activeTenantId: 'tenant-1', enabled: true });
  });

  it('keeps loading, denied, and tenantless direct access fail-closed without mounting the inbox', () => {
    vi.mocked(useActiveTenant).mockReturnValue({ activeTenantId: null, isTenantLoading: true } as never);
    const { rerender } = render(<PropertyProposalReviewPage />);
    expect(screen.getByText('Cargando propuestas…')).toBeVisible();
    expect(screen.queryByText(/Inbox para/)).toBeNull();

    vi.mocked(useActiveTenant).mockReturnValue({ activeTenantId: 'tenant-1', isTenantLoading: false } as never);
    vi.mocked(usePropertyProposalAccess).mockReturnValue({ activeTenantId: 'tenant-1', enabled: false });
    rerender(<PropertyProposalReviewPage />);
    expect(screen.getByText('No tenés acceso a la revisión de propuestas.')).toBeVisible();
    expect(screen.queryByText(/Inbox para/)).toBeNull();

    vi.mocked(usePropertyProposalAccess).mockReturnValue({ activeTenantId: null, enabled: true });
    rerender(<PropertyProposalReviewPage />);
    expect(screen.getByText('No tenés acceso a la revisión de propuestas.')).toBeVisible();
  });

  it('mounts the inbox only with the resolved active tenant and exact reviewer access predicate', () => {
    render(<PropertyProposalReviewPage />);
    expect(screen.getByText('Inbox para tenant-1: true')).toBeVisible();
  });
});
