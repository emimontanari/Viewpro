import { describe, expect, it } from 'vitest';
import type { OwnerPropertyContact } from '../api/types';
import {
  buildOwnerPropertyWhatsappHref,
  buildOwnerPropertyWhatsappMessage
} from './owner-whatsapp-contact';

const availableContact: OwnerPropertyContact = {
  available: true,
  targetType: 'tenant',
  displayLabel: 'Contactar inmobiliaria',
  whatsappPhone: '+54 9 351 000 0000'
};

const property = {
  addressLine: 'Av. Siempre Viva 123',
  city: 'Córdoba',
  province: 'Córdoba'
};

describe('owner WhatsApp contact utilities', () => {
  it('builds a wa.me URL with digits-only phone and encoded owner-visible property message', () => {
    const href = buildOwnerPropertyWhatsappHref({ contact: availableContact, property });

    expect(href).toMatch(/^https:\/\/wa\.me\/5493510000000\?text=/);
    expect(href).not.toContain('+');
    expect(href).toContain('Av.%20Siempre%20Viva%20123');
    expect(href).toContain('consulta%20general');
  });

  it('returns null when contact is unavailable or invalid', () => {
    expect(
      buildOwnerPropertyWhatsappHref({
        contact: {
          available: false,
          targetType: 'tenant',
          displayLabel: 'Contacto no configurado'
        },
        property
      })
    ).toBeNull();

    expect(
      buildOwnerPropertyWhatsappHref({
        contact: {
          available: true,
          targetType: 'tenant',
          displayLabel: 'Contactar inmobiliaria',
          whatsappPhone: '+54'
        },
        property
      })
    ).toBeNull();
  });

  it('builds message text from owner-visible property context only', () => {
    expect(buildOwnerPropertyWhatsappMessage(property)).toBe(
      'Hola, soy propietario de Av. Siempre Viva 123, Córdoba, Córdoba.\nQuería hacer una consulta general sobre esta propiedad.'
    );
  });
});
