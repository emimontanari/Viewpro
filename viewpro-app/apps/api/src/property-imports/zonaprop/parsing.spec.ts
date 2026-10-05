import { describe, expect, it } from 'vitest'
import {
  emailDomain, mapFeature, mapOperationType, mapPropertyType, normalizePhone, parseZonapropAdvertiserUrl,
  parseZonapropListingUrl, requiredFieldsStatus, splitLocation, validatePrice,
} from './parsing'

describe('ZonaProp pure parsing', () => {
  it('accepts only canonical advertiser URLs and extracts publisher id', () => {
    expect(parseZonapropAdvertiserUrl('https://www.zonaprop.com.ar/inmobiliarias/soriano_30827834-inmuebles.html')).toEqual({
      canonicalUrl: 'https://www.zonaprop.com.ar/inmobiliarias/soriano_30827834-inmuebles.html', publisherId: '30827834',
    })
    for (const url of [
      'http://www.zonaprop.com.ar/inmobiliarias/soriano_30827834-inmuebles.html',
      'https://zonaprop.com.ar/inmobiliarias/soriano_30827834-inmuebles.html',
      'https://evil.zonaprop.com.ar/inmobiliarias/soriano_30827834-inmuebles.html',
      'https://u:p@www.zonaprop.com.ar/inmobiliarias/soriano_30827834-inmuebles.html',
      'https://www.zonaprop.com.ar:443/inmobiliarias/soriano_30827834-inmuebles.html',
      'https://www.zonaprop.com.ar/inmobiliarias/soriano_nope-inmuebles.html?x=1',
      'https://www.zonaprop.com.ar/inmobiliarias/soriano_nope-inmuebles.html#x',
      'https://www.zonaprop.com.ar/inmobiliarias/a/30827834-inmuebles.html',
    ]) expect(parseZonapropAdvertiserUrl(url)).toHaveProperty('reason')
  })

  it('extracts listing ids only from ZonaProp classified URLs with listing slugs', () => {
    expect(parseZonapropListingUrl('https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-casa-59907435.html')).toBe('59907435')
    expect(parseZonapropListingUrl('https://www.zonaprop.com.ar/propiedades/clasificado/59907435.html')).toBeNull()
    expect(parseZonapropListingUrl('https://evil.example/propiedades/clasificado/casa-59907435.html')).toBeNull()
    expect(parseZonapropListingUrl('https://www.zonaprop.com.ar/propiedades/clasificado/casa-59907435.html?x=1')).toBeNull()
  })

  it('splits documented Córdoba and CABA locations without postal-code fallback', () => {
    expect(splitLocation(['Nueva Córdoba', 'Córdoba', 'Córdoba'])).toEqual({ city: 'Córdoba', province: 'Córdoba' })
    expect(splitLocation(['Palermo', 'Capital Federal'])).toEqual({ city: 'Capital Federal', province: 'Capital Federal' })
    expect(splitLocation(['Only one'])).toBeNull()
  })

  it.each([
    ['departamento', 'APARTMENT'], ['casa', 'HOUSE'], ['PH', 'APARTMENT'], ['local', 'COMMERCIAL'],
    ['oficina', 'COMMERCIAL'], ['cochera', 'OTHER'], ['terreno', 'LAND'], ['galpón', 'COMMERCIAL'],
    ['quinta', 'HOUSE'], ['campo', 'LAND'], ['invento', 'OTHER'], [null, 'OTHER'],
  ])('maps property type %s', (label, type) => expect(mapPropertyType(label)).toBe(type))

  it.each([['venta', 'SALE'], ['alquiler', 'RENT'], ['alquiler temporario', 'RENT'], ['otro', null]])(
    'maps operation %s', (label, type) => expect(mapOperationType(label)).toBe(type),
  )

  it('validates price and currency together, positivity and int4 cents limit', () => {
    expect(validatePrice(null, null)).toBeNull()
    expect(validatePrice(12.34, 'ARS')).toEqual({ publishedPriceCents: 1234, currency: 'ARS' })
    for (const pair of [[12, null], [null, 'USD'], [3, 'EUR'], [0, 'ARS'], [-1, 'ARS'], ['NaN', 'ARS'], [21474836.48, 'USD']] as const) {
      expect(validatePrice(pair[0], pair[1])).toHaveProperty('reason')
    }
  })

  it('normalizes contact signals without conflating phone and WhatsApp', () => {
    expect(normalizePhone('+54 (9) 351 369-6205')).toBe('5493513696205')
    expect(emailDomain('Employee@SorianoPropiedades.COM.AR')).toBe('sorianopropiedades.com.ar')
    expect(emailDomain('not-an-email')).toBeNull()
  })

  it('reports all missing required candidate fields', () => {
    expect(requiredFieldsStatus({ title: 'Casa', addressLine: null, city: null, province: null, propertyType: null, operationType: null }))
      .toEqual({ status: 'incomplete', missing: ['addressLine', 'city', 'province', 'propertyType', 'operationType'] })
    expect(requiredFieldsStatus({ title: 'Casa', addressLine: 'A', city: 'B', province: 'C', propertyType: 'HOUSE', operationType: 'SALE' }))
      .toEqual({ status: 'ready', missing: [] })
  })

  it('maps documented stable feature codes to numeric fields', () => {
    expect(mapFeature('CFT101', '57 m² cub.')).toEqual({ field: 'coveredAreaSqm', value: 57 })
    expect(mapFeature('CFT100', '1.250 m² tot.')).toEqual({ field: 'totalAreaSqm', value: 1250 })
    expect(mapFeature('CFT1', '3 amb.')).toEqual({ field: 'rooms', value: 3 })
    expect(mapFeature('CFT2', '2 dorm.')).toEqual({ field: 'bedrooms', value: 2 })
    expect(mapFeature('CFT3', '2 baños')).toEqual({ field: 'bathrooms', value: 2 })
    expect(mapFeature('CFT5', '25 años')).toEqual({ field: 'ageYears', value: 25 })
    expect(mapFeature('CFT5', 'A estrenar')).toEqual({ field: 'ageYears', value: 0 })
    expect(mapFeature('1000029', ' n ')).toEqual({ field: 'orientation', value: 'N' })
  })

  it('ignores unknown codes and unparseable feature values', () => {
    expect(mapFeature('CFT999', '3')).toBeNull()
    expect(mapFeature('CFT1', 'consultar')).toBeNull()
    expect(mapFeature('CFT2', '')).toBeNull()
  })
})
