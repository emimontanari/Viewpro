import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ComponentType, ReactNode } from 'react';
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

  it('commits a created label before reporting that creation settled', async () => {
    const user = userEvent.setup();
    const creation = deferred<Response>();
    const events: string[] = [];
    const ComboboxWithPending = MovementOutcomeCombobox as ComponentType<
      ComponentProps<typeof MovementOutcomeCombobox> & { onCreatePendingChange: (pending: boolean) => void }
    >;
    vi.stubGlobal('fetch', vi.fn((_input, init?: RequestInit) =>
      init?.method === 'POST' ? creation.promise : Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    ));
    render(
      <ComboboxWithPending
        canCreateLabel
        onChange={(value) => events.push(`selected:${value}`)}
        onCreatePendingChange={(pending) => events.push(`pending:${pending}`)}
        value={null}
      />,
      { wrapper: Wrapper }
    );

    await user.click(screen.getByRole('combobox', { name: /resultado del movimiento/i }));
    await user.click(screen.getByText(/\+ Agregar etiqueta/i));
    await user.type(screen.getByLabelText('Nombre'), 'Etiqueta creada');
    await user.click(screen.getByRole('button', { name: /Crear etiqueta/i }));
    await waitFor(() => expect(events).toEqual(['pending:true']));

    creation.resolve(new Response(JSON.stringify({ id: 'label-1', label: 'Etiqueta creada', color: null }), { status: 201 }));
    await waitFor(() => expect(events).toEqual(['pending:true', 'selected:custom:label-1', 'pending:false']));
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((done) => { resolve = done; }), resolve };
}
