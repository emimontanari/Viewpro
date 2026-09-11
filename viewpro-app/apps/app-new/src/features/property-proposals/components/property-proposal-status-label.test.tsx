import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PropertyProposalStatusLabel } from './property-proposal-status-label';

describe('PropertyProposalStatusLabel', () => {
  it.each([
    ['BORRADOR', 'BORRADOR'], ['EN_REVISION', 'EN REVISIÓN'],
    ['APROBADA', 'APROBADA'], ['RECHAZADA', 'RECHAZADA']
  ] as const)('renders the %s badge as %s', (state, label) => {
    render(<PropertyProposalStatusLabel state={state} />);
    expect(screen.getByRole('status')).toHaveTextContent(label);
  });
});
