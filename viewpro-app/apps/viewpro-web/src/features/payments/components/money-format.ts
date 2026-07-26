// platform-payment-ledger — rendering money without losing it.
//
// Amounts arrive as strings of integer minor units and are formatted here
// with BigInt and string manipulation only. Nothing in this file may call
// Number(): the moment an amount past Number.MAX_SAFE_INTEGER goes through a
// JS number it is silently rounded, and a formatting helper is the last place
// anyone would think to look for a money bug.

const MINOR_UNIT_SCALE = 2;

/**
 * Format minor units for display, e.g. "4500000" → "$ 45.000,00".
 *
 * Argentine convention: "." groups thousands, "," separates decimals.
 * Non-peso currencies render with their code instead of a symbol rather than
 * guessing at an unfamiliar one.
 */
export function formatAmount(amountMinorUnits: string, currency: string): string {
  const value = BigInt(amountMinorUnits);
  const divisor = 10n ** BigInt(MINOR_UNIT_SCALE);
  const whole = value / divisor;
  const fraction = (value < 0n ? -value : value) % divisor;

  const grouped = groupThousands(whole.toString());
  const decimals = fraction.toString().padStart(MINOR_UNIT_SCALE, '0');
  const prefix = currency === 'ARS' ? '$' : currency;

  return `${prefix} ${grouped},${decimals}`;
}

function groupThousands(digits: string): string {
  const negative = digits.startsWith('-');
  const bare = negative ? digits.slice(1) : digits;
  const parts: string[] = [];

  for (let end = bare.length; end > 0; end -= 3) {
    parts.unshift(bare.slice(Math.max(0, end - 3), end));
  }

  return `${negative ? '-' : ''}${parts.join('.')}`;
}

/** e.g. "2026-08-31" → "Pago hasta el 31/08/2026". */
export function paidThroughLabel(paidThroughAt: string | null): string {
  if (paidThroughAt === null) {
    return 'Sin pagos registrados';
  }

  const [year, month, day] = paidThroughAt.split('-');

  return `Pago hasta el ${day}/${month}/${year}`;
}

/**
 * e.g. 3 → "Vencido hace 3 días". Returns null when the tenant is not
 * overdue, so callers render nothing rather than an empty badge.
 */
export function overdueLabel(overdueDays: number | null): string | null {
  if (overdueDays === null) {
    return null;
  }

  return `Vencido hace ${overdueDays} ${overdueDays === 1 ? 'día' : 'días'}`;
}

/**
 * Convert what the operator typed into integer minor units.
 *
 * Done entirely with strings. The obvious alternative,
 * `Math.round(parseFloat(input) * 100)`, is wrong in a way that survives
 * casual testing: parseFloat('45000.70') * 100 is 4500069.999999999. Some
 * values round back correctly and some do not, so the bug reaches production
 * looking like an occasional one-cent discrepancy nobody can reproduce.
 *
 * Accepts both '.' and ',' as the decimal separator and tolerates thousands
 * separators, because an operator typing an amount will use whichever their
 * keyboard and habit produce. More than two decimals is REJECTED rather than
 * truncated — booking a different amount than the one entered is not a
 * rounding detail, it is the wrong number in the ledger.
 */
export function toMinorUnits(input: string): string {
  const trimmed = input.trim();

  if (trimmed === '') {
    throw new Error('Ingresá un monto');
  }

  // Pure thousands notation ("45.000", "1.234.567") is unambiguous only when
  // EVERY group after the first is exactly 3 digits and the first is 1-3.
  // Without that check "45000.567" would be read as thousands and silently
  // become 45000567 — a hundred times the amount the operator meant.
  const pureThousands = /^\d{1,3}([.,]\d{3})+$/;

  let whole: string;
  let decimals: string;

  if (pureThousands.test(trimmed)) {
    whole = trimmed.replace(/[.,]/g, '');
    decimals = '';
  } else {
    // Otherwise the LAST separator is the decimal one and any earlier
    // separators group thousands.
    const decimalIndex = Math.max(trimmed.lastIndexOf(','), trimmed.lastIndexOf('.'));

    whole = decimalIndex === -1 ? trimmed : trimmed.slice(0, decimalIndex);
    decimals = decimalIndex === -1 ? '' : trimmed.slice(decimalIndex + 1);
    whole = whole.replace(/[.,]/g, '');
  }

  if (!/^\d+$/.test(whole) || (decimals !== '' && !/^\d+$/.test(decimals))) {
    throw new Error('El monto debe ser un número');
  }

  if (decimals.length > 2) {
    // Truncating here would book a different amount than the one entered.
    throw new Error('El monto admite como máximo 2 decimales');
  }

  const minorUnits = `${whole}${decimals.padEnd(2, '0')}`.replace(/^0+(?=\d)/, '');

  if (BigInt(minorUnits) <= 0n) {
    throw new Error('El monto debe ser mayor a cero');
  }

  return minorUnits;
}
