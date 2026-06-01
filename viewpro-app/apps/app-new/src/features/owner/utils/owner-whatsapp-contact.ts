import type { OwnerProperty, OwnerPropertyContact } from '../api/types';

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

export function buildOwnerPropertyWhatsappMessage(
  property: Pick<OwnerProperty, 'addressLine' | 'city' | 'province'>
) {
  const location = [property.addressLine, property.city, property.province]
    .filter(Boolean)
    .join(', ');

  return [
    `Hola, soy propietario de ${location}.`,
    'Quería hacer una consulta general sobre esta propiedad.'
  ].join('\n');
}

function getWhatsappPhoneDigits(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= MIN_WHATSAPP_DIGITS ? digits : null;
}
