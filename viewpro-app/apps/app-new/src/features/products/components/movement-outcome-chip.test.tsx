import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MovementOutcomeChip, pickContrastingTextColor } from './movement-outcome-chip';

describe('pickContrastingTextColor', () => {
  it('returns white text for a dark background (#000000)', () => {
    expect(pickContrastingTextColor('#000000')).toBe('#ffffff');
  });

  it('returns black text for a light background (#ffffff)', () => {
    expect(pickContrastingTextColor('#ffffff')).toBe('#000000');
  });

  it('returns black text for a mid-light color above threshold (#aaaaaa)', () => {
    // #aaaaaa: R=170, G=170, B=170 → YIQ = (170*299 + 170*587 + 170*114)/1000 = 170 → above 128
    expect(pickContrastingTextColor('#aaaaaa')).toBe('#000000');
  });

  it('returns white text for a mid-dark color below threshold (#555555)', () => {
    // #555555: R=85, G=85, B=85 → YIQ = 85 → below 128
    expect(pickContrastingTextColor('#555555')).toBe('#ffffff');
  });

  it('returns white text for a saturated dark red (#8B0000)', () => {
    // #8B0000: R=139, G=0, B=0 → YIQ = (139*299)/1000 ≈ 41.6 → below 128
    expect(pickContrastingTextColor('#8B0000')).toBe('#ffffff');
  });

  it('returns black text for a bright yellow (#FFFF00)', () => {
    // #FFFF00: R=255, G=255, B=0 → YIQ = (255*299 + 255*587)/1000 ≈ 226 → above 128
    expect(pickContrastingTextColor('#FFFF00')).toBe('#000000');
  });
});

describe('MovementOutcomeChip', () => {
  it('renders nothing when no outcome is provided', () => {
    const { container } = render(
      <MovementOutcomeChip label={null} color={null} deletedAt={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the label text when provided', () => {
    render(<MovementOutcomeChip label='Consultas y visitas' color={null} deletedAt={null} />);
    expect(screen.getByText('Consultas y visitas')).toBeInTheDocument();
  });

  it('applies custom color as background style', () => {
    render(<MovementOutcomeChip label='Test etiqueta' color='#3B82F6' deletedAt={null} />);
    const chip = screen.getByText('Test etiqueta').closest('[data-slot="badge"]');
    expect(chip).toHaveStyle({ backgroundColor: '#3B82F6' });
  });

  it('adds aria-label="Etiqueta archivada" when deletedAt is set', () => {
    render(
      <MovementOutcomeChip
        label='Etiqueta vieja'
        color={null}
        deletedAt='2026-01-01T00:00:00.000Z'
      />
    );
    expect(screen.getByLabelText('Etiqueta archivada')).toBeInTheDocument();
  });

  it('does not add archived aria-label when deletedAt is null', () => {
    render(<MovementOutcomeChip label='Etiqueta activa' color={null} deletedAt={null} />);
    expect(screen.queryByLabelText('Etiqueta archivada')).not.toBeInTheDocument();
  });
});
