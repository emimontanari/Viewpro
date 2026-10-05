export type UrlRejectionReason = 'invalid_url' | 'unsupported_protocol' | 'invalid_host' | 'url_components_not_allowed' | 'invalid_path'
export type UrlResult = { canonicalUrl: string; publisherId: string } | { reason: UrlRejectionReason }
export type PriceResult = { publishedPriceCents: number; currency: 'ARS' | 'USD' } | null | { reason: 'invalid_price_currency_pair' | 'unsupported_currency' | 'invalid_price' | 'price_out_of_range' }

const HOST = 'www.zonaprop.com.ar'
const ADVERTISER_PATH = /^\/inmobiliarias\/[^/]+_(\d+)-inmuebles\.html$/

function safeZonaPropUrl(input: string): URL | null {
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' || url.hostname !== HOST || url.username || url.password || url.port || url.search || url.hash) return null
    return url
  } catch { return null }
}

export function parseZonapropAdvertiserUrl(input: string): UrlResult {
  let url: URL
  try { url = new URL(input) } catch { return { reason: 'invalid_url' } }
  if (url.protocol !== 'https:') return { reason: 'unsupported_protocol' }
  if (url.hostname !== HOST) return { reason: 'invalid_host' }
  if (url.username || url.password || url.port || url.search || url.hash || !/^https:\/\/www\.zonaprop\.com\.ar\//i.test(input)) return { reason: 'url_components_not_allowed' }
  const match = ADVERTISER_PATH.exec(url.pathname)
  if (!match) return { reason: 'invalid_path' }
  const publisherId = match[1]
  if (!publisherId) return { reason: 'invalid_path' }
  return { canonicalUrl: `https://${HOST}${url.pathname}`, publisherId }
}

export function parseZonapropListingUrl(input: string): string | null {
  const url = safeZonaPropUrl(input)
  if (!url || !/^https:\/\/www\.zonaprop\.com\.ar\//i.test(input)) return null
  const match = /^\/propiedades\/clasificado\/[a-z0-9]+(?:-[a-z0-9]+)*-(\d+)\.html$/i.exec(url.pathname)
  return match?.[1] ?? null
}

export function splitLocation(parts: string[]): { city: string; province: string } | null {
  const clean = parts.map(part => part.trim()).filter(Boolean)
  const last = clean.at(-1)
  const city = clean.at(-2)
  if (clean.length === 2 && last?.toLocaleLowerCase() === 'capital federal') {
    return { city: last, province: last }
  }
  if (clean.length >= 3 && city && last) return { city, province: last }
  return null
}

export function mapPropertyType(label: string | null): 'HOUSE' | 'APARTMENT' | 'LAND' | 'COMMERCIAL' | 'OTHER' {
  switch (label?.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()) {
    case 'casa': case 'quinta': return 'HOUSE'
    case 'departamento': case 'ph': return 'APARTMENT'
    case 'terreno': case 'terrenos': case 'campo': return 'LAND'
    case 'local': case 'oficina': case 'galpon': return 'COMMERCIAL'
    default: return 'OTHER'
  }
}

export function mapOperationType(label: string | null): 'SALE' | 'RENT' | null {
  const value = label?.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
  if (value === 'venta' || value === 'sale') return 'SALE'
  if (value === 'alquiler' || value === 'alquiler temporario' || value === 'rent' || value === 'temporary rental') return 'RENT'
  return null
}

export function validatePrice(amount: number | string | null, currency: string | null): PriceResult {
  if (amount === null && currency === null) return null
  if (amount === null || currency === null || !currency.trim()) return { reason: 'invalid_price_currency_pair' }
  const normalizedCurrency = currency.trim().toUpperCase()
  if (normalizedCurrency !== 'ARS' && normalizedCurrency !== 'USD') return { reason: 'unsupported_currency' }
  const value = typeof amount === 'number' ? amount : /^\d+(?:\.\d+)?$/.test(amount.trim()) ? Number(amount) : NaN
  if (!Number.isFinite(value) || value <= 0) return { reason: 'invalid_price' }
  const cents = Math.round(value * 100)
  if (!Number.isSafeInteger(cents) || cents > 2_147_483_647) return { reason: 'price_out_of_range' }
  return { publishedPriceCents: cents, currency: normalizedCurrency }
}

// Stable ZonaProp feature codes documented in docs/zonaprop-import-discovery.md.
const NUMERIC_FEATURES = {
  CFT100: 'totalAreaSqm', CFT101: 'coveredAreaSqm', CFT1: 'rooms', CFT2: 'bedrooms', CFT3: 'bathrooms', CFT5: 'ageYears',
} as const
export type FeatureMapping =
  | { field: (typeof NUMERIC_FEATURES)[keyof typeof NUMERIC_FEATURES]; value: number }
  | { field: 'orientation'; value: string }

export function mapFeature(code: string, rawValue: string): FeatureMapping | null {
  const value = rawValue.trim()
  if (code === '1000029') return value ? { field: 'orientation', value: value.toUpperCase() } : null
  const field = NUMERIC_FEATURES[code as keyof typeof NUMERIC_FEATURES]
  if (!field) return null
  if (field === 'ageYears' && /^a estrenar$/i.test(value)) return { field, value: 0 }
  // Values are strings with units and Argentine thousands separators: "1.250 m² tot.".
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)/.exec(value)
  return match?.[1] ? { field, value: Number(match[1].replace(/\./g, '')) } : null
}

export function normalizePhone(phone: string | null): string | null {
  if (phone === null) return null
  const digits = phone.replace(/\D/g, '')
  return digits || null
}

export function emailDomain(email: string | null): string | null {
  if (email === null) return null
  const match = /^[^@\s]+@([^@\s]+)$/.exec(email.trim())
  const domain = match?.[1]
  return domain?.toLowerCase() ?? null
}

export type RequiredFields = {
  title: string | null; addressLine: string | null; city: string | null; province: string | null
  propertyType: string | null; operationType: string | null
}
export function requiredFieldsStatus(fields: RequiredFields):
  | { status: 'ready'; missing: [] }
  | { status: 'incomplete'; missing: (keyof RequiredFields)[] } {
  const missing = (['title', 'addressLine', 'city', 'province', 'propertyType', 'operationType'] as const)
    .filter(key => !fields[key]?.trim())
  return missing.length ? { status: 'incomplete', missing } : { status: 'ready', missing: [] }
}
