import * as z from 'zod';
import { manualMovementTypes } from '../constants/movement-options';

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
    .optional()
});

export type CreateProductMovementValues = z.infer<typeof createProductMovementSchema>;
