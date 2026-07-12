import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { InviteTeamMemberDialog } from './invite-team-member-dialog';

type DialogProps = ComponentProps<typeof InviteTeamMemberDialog>;

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const props: DialogProps = {
    invitationUrl: null,
    isSubmitting: false,
    onInviteAnother: vi.fn(),
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    open: true,
    ...overrides
  };

  render(<InviteTeamMemberDialog {...props} />);
  return props;
}

describe('InviteTeamMemberDialog', () => {
  it('requires a valid email', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.click(screen.getByRole('button', { name: /crear invitación/i }));

    expect(await screen.findByText('El email es obligatorio.')).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/email/i), 'no-es-email');
    await user.click(screen.getByRole('button', { name: /crear invitación/i }));

    expect(await screen.findByText('Ingresá un email válido.')).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('submits a normalized email and selected role', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.type(screen.getByLabelText(/email/i), ' AGENTE@Example.COM ');
    await user.click(screen.getByRole('combobox', { name: /rol/i }));
    await user.click(screen.getByRole('option', { name: /encargado/i }));
    await user.click(screen.getByRole('button', { name: /crear invitación/i }));

    expect(props.onSubmit).toHaveBeenCalledWith({
      email: 'agente@example.com',
      role: 'MANAGER'
    });
  });

  it('shows the generated manual invitation link', () => {
    renderDialog({ invitationUrl: 'http://localhost:3000/team-invitations/raw-token-1' });

    expect(screen.getByText('Copiá este link manualmente:')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'http://localhost:3000/team-invitations/raw-token-1' })
    ).toHaveAttribute('href', 'http://localhost:3000/team-invitations/raw-token-1');
  });
});
