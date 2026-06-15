import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { CreatePropertyMovementDialog } from './create-property-movement-dialog';

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>;
}

describe('CreatePropertyMovementDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the official status field when status updates are permitted', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' }, status: 200 })
    ));
    renderCreatePropertyMovementDialog();

    expect(screen.getByLabelText('Actualizar estado')).toBeInTheDocument();
  });

  it('omits official status changes when status updates are not permitted', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' }, status: 200 })
    ));
    renderCreatePropertyMovementDialog({ canUpdateStatus: false, onSubmit });

    expect(screen.queryByLabelText('Actualizar estado')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Observación'), 'El comprador pidió una visita.');
    await user.click(screen.getByRole('button', { name: /Guardar actualización/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      observation: 'El comprador pidió una visita.',
      type: 'GENERAL_UPDATE'
    });
    expect(onSubmit.mock.calls[0]?.[0].newStatus).toBeUndefined();
  });

  it('renders the outcome combobox after the type selector', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' }, status: 200 })
    ));
    renderCreatePropertyMovementDialog();

    expect(
      screen.getByRole('combobox', { name: /resultado del movimiento/i })
    ).toBeInTheDocument();
  });

  it('includes outcome in the submit payload when a built-in outcome is selected', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' }, status: 200 })
    ));
    renderCreatePropertyMovementDialog({ canUpdateStatus: false, onSubmit });

    await user.type(screen.getByLabelText('Observación'), 'Visita programada.');
    // Open the combobox and select a built-in outcome.
    await user.click(screen.getByRole('combobox', { name: /resultado del movimiento/i }));
    await user.click(await screen.findByText('Consultas y visitas'));

    await user.click(screen.getByRole('button', { name: /Guardar actualización/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0]?.[0];
    expect(payload?.outcome).toEqual({ builtIn: 'CONSULTAS_Y_VISITAS' });
  });
});

function renderCreatePropertyMovementDialog({
  canUpdateStatus = true,
  canCreateLabel = true,
  isSubmitting = false,
  onOpenChange = vi.fn(),
  onSubmit = vi.fn(),
  open = true
}: Partial<Parameters<typeof CreatePropertyMovementDialog>[0]> = {}) {
  return render(
    <CreatePropertyMovementDialog
      canUpdateStatus={canUpdateStatus}
      canCreateLabel={canCreateLabel}
      isSubmitting={isSubmitting}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={open}
    />,
    { wrapper: Wrapper }
  );
}
