import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreatePropertyMovementDialog } from './create-property-movement-dialog';

describe('CreatePropertyMovementDialog', () => {
  it('shows the official status field when status updates are permitted', () => {
    renderCreatePropertyMovementDialog();

    expect(screen.getByLabelText('Actualizar estado')).toBeInTheDocument();
  });

  it('omits official status changes when status updates are not permitted', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
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
});

function renderCreatePropertyMovementDialog({
  canUpdateStatus = true,
  isSubmitting = false,
  onOpenChange = vi.fn(),
  onSubmit = vi.fn(),
  open = true
}: Partial<Parameters<typeof CreatePropertyMovementDialog>[0]> = {}) {
  return render(
    <CreatePropertyMovementDialog
      canUpdateStatus={canUpdateStatus}
      isSubmitting={isSubmitting}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={open}
    />
  );
}
