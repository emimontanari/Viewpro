import { describe, expect, it } from 'vitest';
import type { Product } from '../api/types';
import type { ProductFormValues } from '../schemas/product';
import {
  formatAmountInput,
  getDefaultValues,
  getImageUploadDescription,
  getPropertySaveSuccessMessage,
  parseAmountInput,
  toCreatePayload,
  toUpdatePayload
} from './product-form-mappers';

describe('product-form-mappers', () => {
  it('builds empty create defaults', () => {
    expect(getDefaultValues(null)).toEqual({
      addressLine: '',
      ageYears: undefined,
      bathrooms: undefined,
      bedrooms: undefined,
      city: '',
      coveredAreaSqm: undefined,
      currency: 'ARS',
      garages: undefined,
      image: [],
      operationType: 'SALE',
      orientation: '',
      ownerEmail: '',
      ownerName: '',
      propertyType: 'APARTMENT',
      province: '',
      publishedPrice: undefined,
      rooms: undefined,
      title: '',
      totalAreaSqm: undefined
    });
  });

  it('maps an existing product into edit defaults', () => {
    expect(getDefaultValues(createProduct())).toMatchObject({
      addressLine: 'Av. Siempre Viva 742',
      ageYears: 15,
      bathrooms: 2,
      bedrooms: 3,
      city: 'Springfield',
      coveredAreaSqm: 95,
      currency: 'USD',
      garages: 1,
      image: [],
      operationType: 'SALE',
      orientation: 'Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Ana Owner',
      propertyType: 'HOUSE',
      province: 'Buenos Aires',
      publishedPrice: 120000,
      rooms: 4,
      title: 'Casa demo',
      totalAreaSqm: 120
    });
  });

  it('builds create payloads with only filled optional values', () => {
    expect(
      toCreatePayload(
        createFormValues({
          ageYears: '',
          bathrooms: 2,
          bedrooms: undefined,
          coveredAreaSqm: 95,
          currency: 'usd' as ProductFormValues['currency'],
          garages: 0,
          orientation: ' Norte ',
          ownerEmail: 'owner@example.com',
          ownerName: 'Ana Owner',
          publishedPrice: 120000,
          rooms: 4,
          totalAreaSqm: 120
        })
      )
    ).toEqual({
      addressLine: 'Av. Siempre Viva 742',
      bathrooms: 2,
      city: 'Springfield',
      coveredAreaSqm: 95,
      currency: 'USD',
      garages: 0,
      operationType: 'SALE',
      orientation: 'Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Ana Owner',
      propertyType: 'HOUSE',
      province: 'Buenos Aires',
      publishedPriceCents: 12000000,
      rooms: 4,
      title: 'Casa demo',
      totalAreaSqm: 120
    });
  });

  it('builds update payloads with nulls for cleared optional values', () => {
    expect(
      toUpdatePayload(
        createFormValues({
          ageYears: '',
          bathrooms: undefined,
          bedrooms: 3,
          coveredAreaSqm: '',
          currency: 'ars' as ProductFormValues['currency'],
          garages: 0,
          orientation: '  ',
          ownerEmail: '',
          ownerName: '  Ana Owner  ',
          publishedPrice: '',
          rooms: 4,
          totalAreaSqm: 120
        })
      )
    ).toEqual({
      addressLine: 'Av. Siempre Viva 742',
      ageYears: null,
      bathrooms: null,
      bedrooms: 3,
      city: 'Springfield',
      coveredAreaSqm: null,
      currency: 'ARS',
      garages: 0,
      operationType: 'SALE',
      orientation: null,
      ownerEmail: null,
      ownerName: 'Ana Owner',
      propertyType: 'HOUSE',
      province: 'Buenos Aires',
      publishedPriceCents: null,
      rooms: 4,
      title: 'Casa demo',
      totalAreaSqm: 120
    });
  });

  it('formats and parses amount input like the current editor', () => {
    expect(formatAmountInput(120000)).toBe('120.000');
    expect(formatAmountInput('')).toBe('');
    expect(formatAmountInput(undefined)).toBe('');
    expect(parseAmountInput('$ 120.000')).toBe(120000);
    expect(parseAmountInput('abc')).toBe('');
  });

  it('keeps image upload descriptions and save messages', () => {
    expect(getImageUploadDescription(1)).toBe(
      'Podés seleccionar hasta 1 imagen. JPG, PNG o WebP de hasta 5 MB cada una.'
    );
    expect(getImageUploadDescription(3)).toBe(
      'Podés seleccionar hasta 3 imágenes. JPG, PNG o WebP de hasta 5 MB cada una.'
    );
    expect(getPropertySaveSuccessMessage('create', 0)).toBe('Propiedad creada correctamente');
    expect(getPropertySaveSuccessMessage('edit', 0)).toBe('Propiedad actualizada correctamente');
    expect(getPropertySaveSuccessMessage('create', 2)).toBe(
      'Propiedad creada y 2 imágenes subidas.'
    );
  });
});

function createFormValues(overrides: Partial<ProductFormValues> = {}): ProductFormValues {
  return {
    addressLine: 'Av. Siempre Viva 742',
    ageYears: undefined,
    bathrooms: undefined,
    bedrooms: undefined,
    city: 'Springfield',
    coveredAreaSqm: undefined,
    currency: 'ARS',
    garages: undefined,
    image: [],
    operationType: 'SALE',
    orientation: '',
    ownerEmail: '',
    ownerName: '',
    propertyType: 'HOUSE',
    province: 'Buenos Aires',
    publishedPrice: undefined,
    rooms: undefined,
    title: 'Casa demo',
    totalAreaSqm: undefined,
    ...overrides
  } as ProductFormValues;
}

type ProductOverrides = Omit<Partial<Product>, 'property'> & {
  property?: Partial<Product['property']>;
};

function createProduct(overrides: ProductOverrides = {}): Product {
  const { property: propertyOverrides, ...productOverrides } = overrides;

  return {
    agents: [],
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    createdAt: '2026-05-30T10:00:00.000Z',
    currency: 'USD',
    id: 'product-1',
    operationType: 'SALE',
    property: {
      addressLine: 'Av. Siempre Viva 742',
      ageYears: 15,
      bathrooms: 2,
      bedrooms: 3,
      city: 'Springfield',
      coveredAreaSqm: 95,
      garages: 1,
      id: 'property-1',
      images: [],
      orientation: 'Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Ana Owner',
      owners: [],
      primaryImage: null,
      propertyType: 'HOUSE',
      province: 'Buenos Aires',
      rooms: 4,
      title: 'Casa demo',
      totalAreaSqm: 120,
      ...propertyOverrides
    },
    publishedPriceCents: 12000000,
    status: 'CAPTURE',
    tenantId: 'tenant-1',
    updatedAt: '2026-05-30T10:00:00.000Z',
    ...productOverrides
  };
}
