import type {
  OwnerMovement,
  OwnerMovementContact,
  OwnerProperty,
  OwnerPropertyContact
} from '../api/types';
import {
  formatOwnerMovementDate,
  getOwnerMovementStatusLabel,
  getOwnerMovementTypeLabel
} from './owner-movement-labels';

const MIN_WHATSAPP_DIGITS = 8;

export function buildOwnerPropertyWhatsappHref({
  contact,
  property
}: {
  contact: OwnerPropertyContact;
  property: Pick<OwnerProperty, 'addressLine' | 'city' | 'province'>;
}) {
  if (!contact.available || !contact.whatsappPhone) {
    return null;
  }

  const phoneDigits = getWhatsappPhoneDigits(contact.whatsappPhone);

  if (!phoneDigits) {
    return null;
  }

  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(buildOwnerPropertyWhatsappMessage(property))}`;
}

export function buildOwnerMovementWhatsappHref({
  contact,
  movement,
  property
}: {
  contact: OwnerMovementContact;
  movement: Pick<OwnerMovement, 'createdAt' | 'newStatus' | 'type'>;
  property: Pick<OwnerProperty, 'addressLine' | 'city' | 'province'>;
}) {
  if (!contact.available || !contact.whatsappPhone) {
    return null;
  }

  const phoneDigits = getWhatsappPhoneDigits(contact.whatsappPhone);

  if (!phoneDigits) {
    return null;
  }

  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(buildOwnerMovementWhatsappMessage({ movement, property }))}`;
}

export function buildOwnerPropertyWhatsappMessage(
  property: Pick<OwnerProperty, 'addressLine' | 'city' | 'province'>
) {
  const location = formatOwnerPropertyLocation(property);

  return [
    `Hola, soy propietario de ${location}.`,
    'Quería hacer una consulta general sobre esta propiedad.'
  ].join('\n');
}

export function buildOwnerMovementWhatsappMessage({
  movement,
  property
}: {
  movement: Pick<OwnerMovement, 'createdAt' | 'newStatus' | 'type'>;
  property: Pick<OwnerProperty, 'addressLine' | 'city' | 'province'>;
}) {
  const lines = [
    `Hola, soy propietario de ${formatOwnerPropertyLocation(property)}.`,
    'Quería consultar por este movimiento:',
    '',
    `Tipo: ${getOwnerMovementTypeLabel(movement.type)}`
  ];

  if (movement.newStatus) {
    lines.push(`Estado: ${getOwnerMovementStatusLabel(movement.newStatus)}`);
  }

  lines.push(`Fecha: ${formatOwnerMovementDate(movement.createdAt)}`, '', 'Gracias.');

  return lines.join('\n');
}

function formatOwnerPropertyLocation(
  property: Pick<OwnerProperty, 'addressLine' | 'city' | 'province'>
) {
  return [property.addressLine, property.city, property.province].filter(Boolean).join(', ');
}

function getWhatsappPhoneDigits(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= MIN_WHATSAPP_DIGITS ? digits : null;
}
