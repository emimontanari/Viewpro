import { describe, expect, it } from 'vitest'
import { normalizeDocumentTitle, resolveCanonicalType } from './document-taxonomy'

// ---------------------------------------------------------------------------
// Phase 2a — Taxonomy resolver: canonical row coverage (T1-a)
// ---------------------------------------------------------------------------

describe('resolveCanonicalType — canonical rows (T1-a)', () => {
  it('resolves escritura and its synonyms', () => {
    expect(resolveCanonicalType('escritura')).toBe('escritura')
    expect(resolveCanonicalType('escritura firmada')).toBe('escritura')
    expect(resolveCanonicalType('titulo')).toBe('escritura')
    expect(resolveCanonicalType('titulo de propiedad')).toBe('escritura')
  })

  it('resolves dni and its synonyms', () => {
    expect(resolveCanonicalType('dni')).toBe('dni')
    expect(resolveCanonicalType('documento de identidad')).toBe('dni')
    expect(resolveCanonicalType('dni del propietario')).toBe('dni')
    expect(resolveCanonicalType('cedula')).toBe('dni')
  })

  it('resolves plano and its synonyms', () => {
    expect(resolveCanonicalType('plano')).toBe('plano')
    expect(resolveCanonicalType('plano municipal')).toBe('plano')
    expect(resolveCanonicalType('plano de mensura')).toBe('plano')
    expect(resolveCanonicalType('planos')).toBe('plano')
  })

  it('resolves impuesto_municipal and its synonyms', () => {
    expect(resolveCanonicalType('impuesto municipal')).toBe('impuesto_municipal')
    expect(resolveCanonicalType('abl')).toBe('impuesto_municipal')
    expect(resolveCanonicalType('tasa municipal')).toBe('impuesto_municipal')
    expect(resolveCanonicalType('impuesto inmobiliario')).toBe('impuesto_municipal')
  })

  it('resolves reglamento_copropiedad and its synonyms', () => {
    expect(resolveCanonicalType('reglamento')).toBe('reglamento_copropiedad')
    expect(resolveCanonicalType('reglamento de copropiedad')).toBe('reglamento_copropiedad')
    expect(resolveCanonicalType('propiedad horizontal')).toBe('reglamento_copropiedad')
  })

  it('resolves expensas and its synonyms', () => {
    expect(resolveCanonicalType('expensas')).toBe('expensas')
    expect(resolveCanonicalType('estado de expensas')).toBe('expensas')
    expect(resolveCanonicalType('libre deuda de expensas')).toBe('expensas')
  })

  it('resolves boleto_compraventa and its synonyms', () => {
    expect(resolveCanonicalType('boleto')).toBe('boleto_compraventa')
    expect(resolveCanonicalType('boleto de compraventa')).toBe('boleto_compraventa')
    expect(resolveCanonicalType('boleto de compra-venta')).toBe('boleto_compraventa')
  })

  it('resolves constancia_servicios and its synonyms', () => {
    expect(resolveCanonicalType('servicios')).toBe('constancia_servicios')
    expect(resolveCanonicalType('comprobante de servicios')).toBe('constancia_servicios')
    expect(resolveCanonicalType('constancia de servicios')).toBe('constancia_servicios')
  })

  it('resolves informe_dominio and its synonyms', () => {
    expect(resolveCanonicalType('informe de dominio')).toBe('informe_dominio')
    expect(resolveCanonicalType('dominio')).toBe('informe_dominio')
  })

  it('falls through to otro for unmatched titles (T1-b)', () => {
    expect(resolveCanonicalType('factura de luz')).toBe('otro')
    expect(resolveCanonicalType('')).toBe('otro')
    expect(resolveCanonicalType('algo completamente diferente')).toBe('otro')
  })
})

// ---------------------------------------------------------------------------
// Phase 2b — Normalization edge cases (T2-a through T2-f)
// ---------------------------------------------------------------------------

describe('resolveCanonicalType — normalization edge cases (T2)', () => {
  it('T2-a: is case-insensitive', () => {
    expect(resolveCanonicalType('Escritura')).toBe('escritura')
  })

  it('T2-b: strips accents (titulo de propiedad with accent)', () => {
    expect(resolveCanonicalType('título de propiedad')).toBe('escritura')
  })

  it('T2-c: trims leading/trailing whitespace', () => {
    expect(resolveCanonicalType('  DNI del propietario  ')).toBe('dni')
  })

  it('T2-d: handles accent + case combined (TÍTULO)', () => {
    expect(resolveCanonicalType('TÍTULO')).toBe('escritura')
  })

  it('T2-e: resolves cédula (accented é, capital C) to dni', () => {
    expect(resolveCanonicalType('Cédula')).toBe('dni')
  })

  it('T2-f: resolves Planos (capital P) to plano', () => {
    expect(resolveCanonicalType('Planos')).toBe('plano')
  })
})

// ---------------------------------------------------------------------------
// Phase 2c — otro bypass edge cases (G3-b)
// ---------------------------------------------------------------------------

describe('resolveCanonicalType — otro bypass (G3-b)', () => {
  it('resolves escrituraa (typo, not a synonym) to otro', () => {
    expect(resolveCanonicalType('escrituraa')).toBe('otro')
  })

  it('resolves "escritura de 1980" (substring, not a synonym) to otro', () => {
    expect(resolveCanonicalType('escritura de 1980')).toBe('otro')
  })
})

// ---------------------------------------------------------------------------
// Phase 2d — normalizeDocumentTitle unit tests
// ---------------------------------------------------------------------------

describe('normalizeDocumentTitle', () => {
  it('strips diacritics via NFD decomposition', () => {
    expect(normalizeDocumentTitle('título')).toBe('titulo')
    expect(normalizeDocumentTitle('cédula')).toBe('cedula')
  })

  it('lowercases the input', () => {
    expect(normalizeDocumentTitle('ESCRITURA')).toBe('escritura')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalizeDocumentTitle('  dni  ')).toBe('dni')
  })

  it('applies all normalizations together', () => {
    expect(normalizeDocumentTitle('  TÍTULO DE PROPIEDAD  ')).toBe('titulo de propiedad')
  })
})
