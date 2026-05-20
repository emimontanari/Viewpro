import * as z from 'zod';

export const PROPERTY_IMAGE_MAX_FILES = 5;
export const PROPERTY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PROPERTY_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const optionalNonNegativeInteger = z
  .union([
    z.number().int('Usá números enteros.').min(0, 'El valor no puede ser negativo.'),
    z.literal('')
  ])
  .optional();

export const productSchema = z.object({
  title: z.string().min(2, 'El título debe tener al menos 2 caracteres.').max(120),
  addressLine: z.string().min(2, 'La dirección es obligatoria.').max(180),
  city: z.string().min(2, 'La ciudad es obligatoria.').max(80),
  province: z.string().min(2, 'La provincia es obligatoria.').max(80),
  propertyType: z.enum(['HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OTHER'], {
    message: 'Seleccioná un tipo de propiedad.'
  }),
  operationType: z.enum(['SALE', 'RENT'], {
    message: 'Seleccioná un tipo de operación.'
  }),
  publishedPriceCents: z
    .union([
      z.number().int('Usá números enteros en centavos.').min(0, 'El precio no puede ser negativo.'),
      z.literal('')
    ])
    .optional(),
  currency: z.string().max(3, 'Usá un código de moneda de 3 letras.').optional(),
  ownerName: z.string().max(120, 'El nombre no puede superar 120 caracteres.').optional(),
  ownerEmail: z.union([z.string().email('Ingresá un email válido.'), z.literal('')]).optional(),
  totalAreaSqm: optionalNonNegativeInteger,
  coveredAreaSqm: optionalNonNegativeInteger,
  rooms: optionalNonNegativeInteger,
  bedrooms: optionalNonNegativeInteger,
  bathrooms: optionalNonNegativeInteger,
  garages: optionalNonNegativeInteger,
  ageYears: optionalNonNegativeInteger,
  orientation: z.string().max(16, 'La orientación no puede superar 16 caracteres.').optional(),
  image: z
    .custom<File[] | undefined>((value) => value === undefined || Array.isArray(value), {
      message: 'Seleccioná una imagen válida.'
    })
    .refine((files) => !files || files.length <= PROPERTY_IMAGE_MAX_FILES, 'Subí hasta 5 imágenes.')
    .refine(
      (files) => !files?.some((file) => file.size > PROPERTY_IMAGE_MAX_BYTES),
      'Cada imagen debe pesar hasta 5 MB.'
    )
    .refine(
      (files) => !files?.some((file) => !PROPERTY_IMAGE_MIME_TYPES.has(file.type)),
      'Las imágenes deben ser JPG, PNG o WebP.'
    )
    .optional()
});

export type ProductFormValues = z.infer<typeof productSchema>;
