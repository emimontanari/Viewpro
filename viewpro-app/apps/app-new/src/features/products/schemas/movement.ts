import * as z from 'zod';
import { manualMovementTypes } from '../constants/movement-options';

export const labelColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser un código hex de 6 dígitos (ej: #FF5733).');

const builtInOutcomeValues = [
  'EN_CAPTACION',
  'DOCUMENTACION_PENDIENTE',
  'PREPARANDO_PUBLICACION',
  'PUBLICACION_ACTIVA',
  'CONSULTAS_Y_VISITAS',
  'NEGOCIACION_OFERTA',
  'RESERVA_INICIADA',
  'DOCUMENTACION_FINAL',
  'CERRADO',
  'CANCELADO'
] as const;

export const createProductMovementSchema = z.object({
  type: z.enum(manualMovementTypes, {
    message: 'Seleccioná un tipo de actualización.'
  }),
  observation: z
    .string()
    .trim()
    .min(1, 'La observación es obligatoria.')
    .max(2000, 'La observación no puede superar 2000 caracteres.'),
  nextStep: z
    .string()
    .trim()
    .max(500, 'El próximo paso no puede superar 500 caracteres.')
    .transform((value) => value || undefined)
    .optional(),
  newStatus: z
    .enum([
      'CAPTURE',
      'DOCUMENTATION_PENDING',
      'PUBLICATION_PREPARATION',
      'ACTIVE_PUBLICATION',
      'INQUIRIES_AND_VISITS',
      'OFFER_NEGOTIATION',
      'RESERVATION_STARTED',
      'FINAL_DOCUMENTATION',
      'CLOSED',
      'CANCELLED'
    ])
    .optional(),
  // Encoded as "builtIn:<ENUM>" | "custom:<uuid>" from the combobox
  outcome: z
    .union([
      z.string().startsWith('builtIn:'),
      z.string().startsWith('custom:')
    ])
    .optional()
});

export type CreateProductMovementValues = z.infer<typeof createProductMovementSchema>;

/**
 * Decodes the combobox-encoded outcome string into the API payload shape.
 */
export function decodeOutcome(
  encoded: string | undefined
): { builtIn: (typeof builtInOutcomeValues)[number] } | { customLabelId: string } | undefined {
  if (!encoded) return undefined;
  if (encoded.startsWith('builtIn:')) {
    const value = encoded.replace('builtIn:', '') as (typeof builtInOutcomeValues)[number];
    return { builtIn: value };
  }
  if (encoded.startsWith('custom:')) {
    return { customLabelId: encoded.replace('custom:', '') };
  }
  return undefined;
}
