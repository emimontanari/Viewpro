export type CanonicalDocumentType =
  | 'escritura'
  | 'dni'
  | 'plano'
  | 'impuesto_municipal'
  | 'reglamento_copropiedad'
  | 'expensas'
  | 'boleto_compraventa'
  | 'constancia_servicios'
  | 'informe_dominio'
  | 'otro'

// Synonyms stored pre-normalized (lowercase, no diacritics). Domain data stays in Spanish.
const SYNONYMS: Record<Exclude<CanonicalDocumentType, 'otro'>, readonly string[]> = {
  escritura: ['escritura', 'escritura firmada', 'titulo', 'titulo de propiedad'],
  dni: ['dni', 'documento de identidad', 'dni del propietario', 'cedula'],
  plano: ['plano', 'plano municipal', 'plano de mensura', 'planos'],
  impuesto_municipal: ['impuesto municipal', 'abl', 'tasa municipal', 'impuesto inmobiliario'],
  reglamento_copropiedad: ['reglamento', 'reglamento de copropiedad', 'propiedad horizontal'],
  expensas: ['expensas', 'estado de expensas', 'libre deuda de expensas'],
  boleto_compraventa: ['boleto', 'boleto de compraventa', 'boleto de compra-venta'],
  constancia_servicios: ['servicios', 'comprobante de servicios', 'constancia de servicios'],
  informe_dominio: ['informe de dominio', 'dominio'],
}

/**
 * Normalizes a document title for taxonomy lookup.
 * Applies: NFD decomposition → diacritic strip → lowercase → trim.
 * Pure function — no I/O.
 */
export function normalizeDocumentTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Resolves a document title to a canonical type key.
 * Normalizes the input and performs exact synonym lookup.
 * Returns 'otro' when no canonical match is found.
 */
export function resolveCanonicalType(title: string): CanonicalDocumentType {
  const normalized = normalizeDocumentTitle(title)
  for (const [key, synonyms] of Object.entries(SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return key as CanonicalDocumentType
    }
  }
  return 'otro'
}
