import { z } from 'zod';

const title = z.string().trim().min(1, 'Ingresá un título.').max(120, 'El título no puede superar 120 caracteres.');
const requiredText = z.string().trim().min(1, 'Este campo es obligatorio.');

export const propertyProposalDraftSchema = z.object({ title });
export const propertyProposalSubmitSchema = z.object({
  title, addressLine: requiredText, city: requiredText, province: requiredText,
  propertyType: z.enum(['HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OTHER']),
  operationType: z.enum(['SALE', 'RENT'])
});

export type PropertyProposalFormValues = {
  title: string; addressLine: string; city: string; province: string;
  propertyType: '' | 'HOUSE' | 'APARTMENT' | 'LAND' | 'COMMERCIAL' | 'OTHER';
  operationType: '' | 'SALE' | 'RENT';
};
