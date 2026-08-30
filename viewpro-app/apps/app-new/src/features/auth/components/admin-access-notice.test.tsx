import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAccessNotice } from './admin-access-notice';

const router = { replace: vi.fn() };
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/dashboard',
  useSearchParams: () => params
}));

const toastMock = { error: vi.fn() };
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastMock.error(m) } }));

describe('AdminAccessNotice', () => {
  beforeEach(() => {
    params = new URLSearchParams();
    router.replace.mockClear();
    toastMock.error.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('explains a denial and clears the marker so a refresh does not repeat it', async () => {
    params = new URLSearchParams('adminAccess=denied');

    render(<AdminAccessNotice />);

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        'No tenés acceso a la consola de administración.'
      );
    });
    expect(router.replace).toHaveBeenCalledWith('/dashboard');
  });

  it('says the check failed rather than claiming a denial', async () => {
    params = new URLSearchParams('adminAccess=unavailable');

    render(<AdminAccessNotice />);

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        'No pudimos verificar tus permisos. Probá de nuevo en un momento.'
      );
    });
  });

  it('keeps the other query params when it clears its own', async () => {
    params = new URLSearchParams('page=2&adminAccess=denied');

    render(<AdminAccessNotice />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/dashboard?page=2');
    });
  });

  it('stays silent with no marker, and for one nobody wrote', async () => {
    for (const query of ['', 'adminAccess=whatever', 'page=2']) {
      params = new URLSearchParams(query);
      render(<AdminAccessNotice />);
    }

    await waitFor(() => {
      expect(toastMock.error).not.toHaveBeenCalled();
    });
    expect(router.replace).not.toHaveBeenCalled();
  });
});
