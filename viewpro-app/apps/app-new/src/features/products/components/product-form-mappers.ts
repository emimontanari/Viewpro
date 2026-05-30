import type { Product, ProductMutationPayload } from '../api/types';
import type { ProductFormValues } from '../schemas/product';

export function getDefaultValues(initialData: Product | null): ProductFormValues {
  if (!initialData) {
    return {
      title: '',
      addressLine: '',
      city: '',
      province: '',
      propertyType: 'APARTMENT',
      operationType: 'SALE',
      publishedPrice: undefined,
      currency: 'ARS',
      totalAreaSqm: undefined,
      coveredAreaSqm: undefined,
      rooms: undefined,
      bedrooms: undefined,
      bathrooms: undefined,
      garages: undefined,
      ageYears: undefined,
      orientation: '',
      ownerName: '',
      ownerEmail: '',
      image: []
    } as ProductFormValues;
  }

  return {
    title: initialData.property.title,
    addressLine: initialData.property.addressLine,
    city: initialData.property.city,
    province: initialData.property.province,
    propertyType: initialData.property.propertyType,
    operationType: initialData.operationType,
    publishedPrice: centsToAmount(initialData.publishedPriceCents),
    currency: initialData.currency ?? 'ARS',
    totalAreaSqm: initialData.property.totalAreaSqm ?? undefined,
    coveredAreaSqm: initialData.property.coveredAreaSqm ?? undefined,
    rooms: initialData.property.rooms ?? undefined,
    bedrooms: initialData.property.bedrooms ?? undefined,
    bathrooms: initialData.property.bathrooms ?? undefined,
    garages: initialData.property.garages ?? undefined,
    ageYears: initialData.property.ageYears ?? undefined,
    orientation: initialData.property.orientation ?? '',
    ownerName: initialData.property.ownerName ?? '',
    ownerEmail: initialData.property.ownerEmail ?? '',
    image: []
  } as ProductFormValues;
}

export function toCreatePayload(value: ProductFormValues): ProductMutationPayload {
  const totalAreaSqm = optionalIntegerValue(value.totalAreaSqm);
  const coveredAreaSqm = optionalIntegerValue(value.coveredAreaSqm);
  const rooms = optionalIntegerValue(value.rooms);
  const bedrooms = optionalIntegerValue(value.bedrooms);
  const bathrooms = optionalIntegerValue(value.bathrooms);
  const garages = optionalIntegerValue(value.garages);
  const ageYears = optionalIntegerValue(value.ageYears);
  const orientation = value.orientation?.trim();

  return {
    title: value.title,
    addressLine: value.addressLine,
    city: value.city,
    province: value.province,
    propertyType: value.propertyType,
    operationType: value.operationType,
    ...(typeof value.publishedPrice === 'number' && {
      publishedPriceCents: amountToCents(value.publishedPrice)
    }),
    ...(value.currency && { currency: value.currency.toUpperCase() }),
    ...(totalAreaSqm !== undefined && { totalAreaSqm }),
    ...(coveredAreaSqm !== undefined && { coveredAreaSqm }),
    ...(rooms !== undefined && { rooms }),
    ...(bedrooms !== undefined && { bedrooms }),
    ...(bathrooms !== undefined && { bathrooms }),
    ...(garages !== undefined && { garages }),
    ...(ageYears !== undefined && { ageYears }),
    ...(orientation && { orientation }),
    ...(value.ownerName && { ownerName: value.ownerName }),
    ...(value.ownerEmail && { ownerEmail: value.ownerEmail })
  };
}

export function toUpdatePayload(value: ProductFormValues): ProductMutationPayload {
  return {
    title: value.title,
    addressLine: value.addressLine,
    city: value.city,
    province: value.province,
    propertyType: value.propertyType,
    operationType: value.operationType,
    publishedPriceCents: optionalAmountToCentsOrNull(value.publishedPrice),
    ...(value.currency && { currency: value.currency.toUpperCase() }),
    totalAreaSqm: optionalIntegerOrNull(value.totalAreaSqm),
    coveredAreaSqm: optionalIntegerOrNull(value.coveredAreaSqm),
    rooms: optionalIntegerOrNull(value.rooms),
    bedrooms: optionalIntegerOrNull(value.bedrooms),
    bathrooms: optionalIntegerOrNull(value.bathrooms),
    garages: optionalIntegerOrNull(value.garages),
    ageYears: optionalIntegerOrNull(value.ageYears),
    orientation: optionalStringOrNull(value.orientation),
    ownerName: optionalStringOrNull(value.ownerName),
    ownerEmail: optionalStringOrNull(value.ownerEmail)
  };
}

export function getImageUploadDescription(availableImageSlots: number) {
  const slotLabel = availableImageSlots === 1 ? '1 imagen' : `${availableImageSlots} imágenes`;
  return `Podés seleccionar hasta ${slotLabel}. JPG, PNG o WebP de hasta 5 MB cada una.`;
}

export function getPropertySaveSuccessMessage(type: 'create' | 'edit', imageUploadCount: number) {
  if (imageUploadCount === 0) {
    return type === 'edit'
      ? 'Propiedad actualizada correctamente'
      : 'Propiedad creada correctamente';
  }

  const propertyAction = type === 'edit' ? 'actualizada' : 'creada';
  const imageLabel =
    imageUploadCount === 1 ? '1 imagen subida' : `${imageUploadCount} imágenes subidas`;
  return `Propiedad ${propertyAction} y ${imageLabel}.`;
}

export function formatAmountInput(value: number | '' | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value)
    : '';
}

export function parseAmountInput(value: string) {
  const normalizedValue = value.replace(/\D/g, '');
  return normalizedValue ? Number(normalizedValue) : '';
}

function optionalIntegerValue(value: number | '' | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalIntegerOrNull(value: number | '' | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function centsToAmount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value / 100 : undefined;
}

function amountToCents(value: number) {
  return Math.round(value * 100);
}

function optionalAmountToCentsOrNull(value: number | '' | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? amountToCents(value) : null;
}

function optionalStringOrNull(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
