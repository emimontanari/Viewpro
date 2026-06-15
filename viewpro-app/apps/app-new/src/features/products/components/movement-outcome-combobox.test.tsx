import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MovementOutcomeCombobox } from './movement-outcome-combobox';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
  );
}

function renderCombobox({
  canCreateLabel = true,
  onChange = vi.fn(),
  value = null
}: {
  canCreateLabel?: boolean;
  onChange?: (value: string | null) => void;
  value?: string | null;
} = {}) {
  return render(
    <MovementOutcomeCombobox
      canCreateLabel={canCreateLabel}
      onChange={onChange}
      value={value}
    />,
    { wrapper: Wrapper }
  );
}

function stubLabelsResponse(labels: unknown[]) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(labels), {
      headers: { 'content-type': 'application/json' },
      status: 200
    })
  );
}

describe('MovementOutcomeCombobox', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders built-in outcome options', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', stubLabelsResponse([]));
    renderCombobox();

    await user.click(screen.getByRole('combobox', { name: /resultado del movimiento/i }));

    await waitFor(() => {
      expect(screen.getByText('En captación')).toBeInTheDocument();
      expect(screen.getByText('Consultas y visitas')).toBeInTheDocument();
      expect(screen.getByText('Cerrado')).toBeInTheDocument();
    });
  });

  it('renders custom labels after fetch', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      stubLabelsResponse([
        {
          id: 'label-1',
          label: 'Esperando documentos',
          color: '#3B82F6',
          deletedAt: null,
          tenantId: 'tenant-1',
          createdByUserId: 'user-1',
          createdAt: '2026-06-15T00:00:00.000Z'
        }
      ])
    );
    renderCombobox();

    await user.click(screen.getByRole('combobox', { name: /resultado del movimiento/i }));

    await waitFor(() => {
      expect(screen.getByText('Esperando documentos')).toBeInTheDocument();
    });
  });

  it('hides the add-label action when canCreateLabel is false', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', stubLabelsResponse([]));
    renderCombobox({ canCreateLabel: false });

    await user.click(screen.getByRole('combobox', { name: /resultado del movimiento/i }));

    await waitFor(() => {
      expect(screen.queryByText(/\+ Agregar etiqueta/i)).not.toBeInTheDocument();
    });
  });

  it('shows the add-label action when canCreateLabel is true', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', stubLabelsResponse([]));
    renderCombobox({ canCreateLabel: true });

    await user.click(screen.getByRole('combobox', { name: /resultado del movimiento/i }));

    await waitFor(() => {
      expect(screen.getByText(/\+ Agregar etiqueta/i)).toBeInTheDocument();
    });
  });

  it('calls onChange when a built-in outcome is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.stubGlobal('fetch', stubLabelsResponse([]));
    renderCombobox({ onChange });

    await user.click(screen.getByRole('combobox', { name: /resultado del movimiento/i }));
    await screen.findByText('En captación');
    await user.click(screen.getByText('En captación'));

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('EN_CAPTACION'));
  });
});
