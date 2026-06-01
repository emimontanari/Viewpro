import { describe, expect, it } from 'vitest';
import type { OwnerMovementContact, OwnerPropertyContact } from '../api/types';
import {
  buildOwnerMovementWhatsappHref,
  buildOwnerMovementWhatsappMessage,
  buildOwnerPropertyWhatsappHref,
  buildOwnerPropertyWhatsappMessage
} from './owner-whatsapp-contact';

const availableContact: OwnerPropertyContact = {
  available: true,
  targetType: 'tenant',
  displayLabel: 'Contactar inmobiliaria',
  whatsappPhone: '+54 9 351 000 0000'
};

const availableMovementContact: OwnerMovementContact = {
  available: true,
  targetType: 'movement_author',
  displayLabel: 'Consultar responsable',
  whatsappPhone: '+54 9 351 111 2222'
};

const property = {
  addressLine: 'Av. Siempre Viva 123',
  city: 'Córdoba',
  province: 'Córdoba'
};

const movement = {
  createdAt: '2026-06-01T12:00:00.000Z',
  newStatus: 'OFFER_NEGOTIATION',
  type: 'STATUS_CHANGE'
};

describe('owner WhatsApp contact utilities', () => {
  it('builds a wa.me URL with digits-only phone and encoded owner-visible property message', () => {
    const href = buildOwnerPropertyWhatsappHref({ contact: availableContact, property });

    expect(href).toMatch(/^https:\/\/wa\.me\/5493510000000\?text=/);
    expect(href).not.toContain('+');
    expect(href).toContain('Av.%20Siempre%20Viva%20123');
    expect(href).toContain('consulta%20general');
  });

  it('returns null when property contact is unavailable or invalid', () => {
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

  it('builds a movement wa.me URL with structured movement context', () => {
    const href = buildOwnerMovementWhatsappHref({
      contact: availableMovementContact,
      movement,
      property
    });

    expect(href).toMatch(/^https:\/\/wa\.me\/5493511112222\?text=/);
    expect(href).not.toContain('+');

    const decodedMessage = decodeURIComponent(new URL(href ?? '').searchParams.get('text') ?? '');

    expect(decodedMessage).toContain('Av. Siempre Viva 123, Córdoba, Córdoba');
    expect(decodedMessage).toContain('Tipo: Cambio de estado');
    expect(decodedMessage).toContain('Estado: Negociación');
    expect(decodedMessage).toContain('Fecha: 01/06/2026');
    expect(decodedMessage).not.toContain('observation');
    expect(decodedMessage).not.toContain('nextStep');
    expect(decodedMessage).not.toContain('movement-1');
    expect(decodedMessage).not.toContain('5493511112222');
  });

  it('builds movement message without free-text observation or next step', () => {
    expect(
      buildOwnerMovementWhatsappMessage({
        movement,
        property
      })
    ).toBe(
      'Hola, soy propietario de Av. Siempre Viva 123, Córdoba, Córdoba.\nQuería consultar por este movimiento:\n\nTipo: Cambio de estado\nEstado: Negociación\nFecha: 01/06/2026\n\nGracias.'
    );
  });

  it('returns null when movement contact is unavailable or invalid', () => {
    expect(
      buildOwnerMovementWhatsappHref({
        contact: {
          available: false,
          targetType: 'movement_author',
          displayLabel: 'Contacto no configurado'
        },
        movement,
        property
      })
    ).toBeNull();

    expect(
      buildOwnerMovementWhatsappHref({
        contact: {
          available: true,
          targetType: 'movement_author',
          displayLabel: 'Consultar responsable',
          whatsappPhone: '+54'
        },
        movement,
        property
      })
    ).toBeNull();
  });
});
