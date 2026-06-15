import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Computes a contrasting foreground color (#000000 or #ffffff) for a given
 * hex background color using the YIQ luminance formula.
 *
 * YIQ threshold: values >= 128 are considered light (use black text),
 * values < 128 are considered dark (use white text).
 */
export function pickContrastingTextColor(bgHex: string): '#000000' | '#ffffff' {
  const hex = bgHex.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

type MovementOutcomeChipProps = {
  label: string | null;
  color: string | null;
  deletedAt: string | null;
};

/**
 * Renders an outcome chip next to a movement type badge.
 *
 * - Uses Badge variant="outline" to visually distinguish from filled status badges (FR-25).
 * - When `color` is provided, applies it as background and picks a WCAG AA-safe foreground.
 * - When `deletedAt` is set, adds aria-label="Etiqueta archivada" and italic styling (FR-24).
 * - When `label` is null, renders nothing (FR-28 backwards compat).
 */
export function MovementOutcomeChip({ label, color, deletedAt }: MovementOutcomeChipProps) {
  if (!label) {
    return null;
  }

  const isArchived = deletedAt !== null;
  const textColor = color ? pickContrastingTextColor(color) : undefined;

  return (
    <Badge
      variant='outline'
      aria-label={isArchived ? 'Etiqueta archivada' : undefined}
      className={cn('rounded-full', isArchived && 'italic line-through opacity-70')}
      style={
        color
          ? { backgroundColor: color, borderColor: color, color: textColor }
          : undefined
      }
    >
      {label}
    </Badge>
  );
}
