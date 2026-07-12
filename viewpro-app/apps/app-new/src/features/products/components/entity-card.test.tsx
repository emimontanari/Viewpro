import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EntityCard, getEntityInitials, getLinkedEntityCountCopy } from './entity-card';

describe('EntityCard', () => {
  it('renders identity, badges, initials and click behavior', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <EntityCard
        badges={[{ label: 'Activo', className: 'bg-background' }]}
        email='propietario.demo@viewpro.local'
        name='Propietario Demo'
        onClick={onClick}
      />
    );

    expect(screen.getByText('PD')).toBeInTheDocument();
    expect(screen.getByText('propietario.demo@viewpro.local')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver detalle de Propietario Demo' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('centralizes initials and counter copy rules', () => {
    expect(getEntityInitials('Propietario Demo', 'owner@example.com')).toBe('PD');
    expect(getEntityInitials('Sofía', 'sofia@example.com')).toBe('S');
    expect(getEntityInitials('', 'owner@example.com')).toBe('O');
    expect(getLinkedEntityCountCopy(0, 'propietario vinculado', 'propietarios vinculados')).toBe(
      '0 propietarios vinculados'
    );
    expect(getLinkedEntityCountCopy(1, 'vendedor asignado', 'vendedores asignados')).toBe(
      '1 vendedor asignado'
    );
    expect(getLinkedEntityCountCopy(2, 'vendedor asignado', 'vendedores asignados')).toBe(
      '2 vendedores asignados'
    );
  });
});
