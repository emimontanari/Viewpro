import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('blocks pointer and direct form saves until the created label is selected', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const creation = deferred<Response>();
    stubMovementLabelRequests(creation.promise);
    renderCreatePropertyMovementDialog({ canUpdateStatus: false, onSubmit });

    await user.type(screen.getByLabelText('Observación'), 'Etiqueta pendiente.');
    await startInlineLabelCreation(user);

    const save = screen.getByRole('button', { name: /Guardar actualización/i });
    await waitFor(() => expect(save).toBeDisabled());
    fireEvent.submit(document.getElementById('create-property-movement-form')!);
    expect(onSubmit).not.toHaveBeenCalled();

    creation.resolve(labelResponse('label-1', 'Etiqueta creada'));
    await waitFor(() => expect(save).toBeEnabled());

    await user.click(save);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0]?.[0].outcome).toEqual({ customLabelId: 'label-1' });
  });

  it('keeps a failed label creation recoverable without an implicit outcome', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const creation = deferred<Response>();
    stubMovementLabelRequests(creation.promise);
    renderCreatePropertyMovementDialog({ canUpdateStatus: false, onSubmit });

    await user.type(screen.getByLabelText('Observación'), 'Guardar sin resultado.');
    await startInlineLabelCreation(user);
    await waitFor(() => expect(screen.getByRole('button', { name: /Guardar actualización/i })).toBeDisabled());

    creation.resolve(new Response('{}', { status: 409 }));
    await screen.findByText('No pudimos completar la solicitud.');
    const save = screen.getByRole('button', { name: /Guardar actualización/i });
    expect(save).toBeEnabled();
    expect(screen.getByRole('combobox', { name: /resultado del movimiento/i })).toHaveTextContent('Seleccioná un resultado');

    await user.click(save);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0]?.[0].outcome).toBeUndefined();
  });

    it('allows retrying a failed label creation with its returned outcome', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      let attempts = 0;
      vi.stubGlobal('fetch', vi.fn((_input, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(attempts++ ? labelResponse('label-retry', 'Etiqueta reintentada') : new Response('{}', { status: 409 }));
        }
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }));
      renderCreatePropertyMovementDialog({ canUpdateStatus: false, onSubmit });

      await user.type(screen.getByLabelText('Observación'), 'Reintentar la etiqueta.');
      await startInlineLabelCreation(user);
      await screen.findByText('No pudimos completar la solicitud.');
      await user.click(screen.getByRole('button', { name: /Crear etiqueta/i }));
      await waitFor(() => expect(screen.getByRole('combobox', { name: /resultado del movimiento/i })).toHaveTextContent('Etiqueta personalizada'));

      await user.click(screen.getByRole('button', { name: /Guardar actualización/i }));
      expect(onSubmit).toHaveBeenCalledOnce();
      expect(onSubmit.mock.calls[0]?.[0].outcome).toEqual({ customLabelId: 'label-retry' });
    });

    it('ignores a prior label completion after close and reopen', async () => {
    const user = userEvent.setup();
    const creation = deferred<Response>();
    const onSubmit = vi.fn();
    stubMovementLabelRequests(creation.promise);
    const view = renderCreatePropertyMovementDialog({ canUpdateStatus: false, onSubmit });

    await startInlineLabelCreation(user);
    view.rerender(
      <Wrapper>
<CreatePropertyMovementDialog canUpdateStatus={false} isSubmitting={false} onOpenChange={vi.fn()} onSubmit={onSubmit} open={false} />
      </Wrapper>
    );
    view.rerender(
      <Wrapper>
<CreatePropertyMovementDialog canUpdateStatus={false} isSubmitting={false} onOpenChange={vi.fn()} onSubmit={onSubmit} open />
      </Wrapper>
    );
    creation.resolve(labelResponse('label-old', 'Etiqueta vieja'));

    await waitFor(() => expect(screen.getByRole('button', { name: /Guardar actualización/i })).toBeEnabled());
    expect(screen.getByRole('combobox', { name: /resultado del movimiento/i })).toHaveTextContent('Seleccioná un resultado');
    fireEvent.submit(document.getElementById('create-property-movement-form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((done) => { resolve = done; }), resolve };
}

function labelResponse(id: string, label: string) {
  return new Response(JSON.stringify({ id, label, color: null }), { status: 201 });
}

function stubMovementLabelRequests(creation: Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn((_input, init?: RequestInit) =>
    init?.method === 'POST' ? creation : Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
  ));
}

async function startInlineLabelCreation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox', { name: /resultado del movimiento/i }));
  await user.click(screen.getByText(/\+ Agregar etiqueta/i));
  await user.type(screen.getByLabelText('Nombre'), 'Etiqueta pendiente');
  await user.click(screen.getByRole('button', { name: /Crear etiqueta/i }));
}

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
