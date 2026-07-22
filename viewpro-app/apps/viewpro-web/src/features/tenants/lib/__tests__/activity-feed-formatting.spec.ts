/**
 * RED — pure formatting helpers for the tenant-detail activity feed
 * (platform-tenant-tracking PR2, T-20/23).
 *
 * `TenantActivityItem` is intentionally loose ([key:string]: unknown) —
 * mirrors the SAME loose convention already used on the ViewPro backend for
 * this exact endpoint (change-feed.client.ts `PlatformActivityFeedItem`).
 * These helpers read the known nested fields DEFENSIVELY, using fixtures
 * shaped exactly like apps/api's real mappers
 * (mapActivityFeedMovement/mapActivityFeedDocumentRequest —
 * apps/api/src/analytics/responses/activity-feed.response.ts).
 *
 * Tests cover:
 *   - describeTenantActivityItem(movement item) -> title/subtitle derived from
 *     real nested property/createdBy fields
 *   - describeTenantActivityItem(document_request item) -> title/subtitle
 *     derived from documentRequest/requestedBy fields
 *   - describeTenantActivityItem degrades gracefully when nested fields are
 *     missing/malformed (never throws)
 *   - formatActivityTimestamp(iso) -> es-AR short date/time string
 *   - formatActivityTimestamp(malformed) -> '—' fail-safe
 */

import { describe, it, expect } from 'vitest';
import type { TenantActivityItem } from '../../api/types';
import {
  buildTenantActivityDetail,
  describeTenantActivityItem,
  formatActivityTimestamp
} from '../activity-feed-formatting';

const MOVEMENT_ITEM: TenantActivityItem = {
  kind: 'movement',
  id: 'movement-1',
  tenantId: 'tenant-1',
  propertyEngagementId: 'engagement-1',
  type: 'STATUS_CHANGE',
  observation: 'Se actualizó el estado',
  createdBy: { id: 'user-1', email: 'agente@example.com', firstName: 'Lucía' },
  createdAt: '2026-07-15T10:00:00.000Z',
  property: {
    id: 'engagement-1',
    engagementId: 'engagement-1',
    assetId: 'asset-1',
    title: 'Depto en Palermo',
    addressLine: 'Av. Santa Fe 1234',
    city: 'CABA',
    province: 'Buenos Aires',
    operationType: 'SALE',
    status: 'ACTIVE',
    agents: []
  }
};

const DOCUMENT_REQUEST_ITEM: TenantActivityItem = {
  kind: 'document_request',
  id: 'document-request:doc-1',
  tenantId: 'tenant-1',
  propertyEngagementId: 'engagement-2',
  documentRequestId: 'doc-1',
  createdAt: '2026-07-14T09:00:00.000Z',
  property: {
    id: 'engagement-2',
    engagementId: 'engagement-2',
    assetId: 'asset-2',
    title: 'Casa en Nordelta',
    addressLine: 'Calle Falsa 123',
    city: 'Tigre',
    province: 'Buenos Aires',
    operationType: 'RENT',
    status: 'ACTIVE',
    agents: []
  },
  requestedBy: { id: 'user-2', email: 'operador@example.com', firstName: 'Martín' },
  documentRequest: {
    title: 'Escritura',
    description: null,
    status: 'PENDING',
    currentVersion: null
  }
};

describe('describeTenantActivityItem()', () => {
  it('a movement item derives title from property + subtitle from createdBy', () => {
    const result = describeTenantActivityItem(MOVEMENT_ITEM);

    expect(result.title).toContain('Depto en Palermo');
    expect(result.subtitle).toContain('Lucía');
  });

  it('maps every MovementType enum value to a Spanish label (no raw codes leak)', () => {
    const cases: Array<[string, string]> = [
      ['GENERAL_UPDATE', 'Actualización general'],
      ['INQUIRY', 'Consulta'],
      ['VISIT_SCHEDULED', 'Visita agendada'],
      ['VISIT_COMPLETED', 'Visita realizada'],
      ['OFFER_RECEIVED', 'Oferta recibida'],
      ['DOCUMENTATION_UPDATE', 'Actualización de documentación'],
      ['STATUS_CHANGE', 'Cambio de estado'],
      ['ARCHIVED', 'Archivado'],
      ['RESTORED', 'Restaurado']
    ];

    for (const [type, label] of cases) {
      const result = describeTenantActivityItem({ ...MOVEMENT_ITEM, type });
      expect(result.title).toContain(label);
      expect(result.title).not.toContain(type); // the raw enum code never renders
    }
  });

  it('a document_request item derives title from documentRequest + property, subtitle from requestedBy', () => {
    const result = describeTenantActivityItem(DOCUMENT_REQUEST_ITEM);

    expect(result.title).toContain('Escritura');
    expect(result.title).toContain('Casa en Nordelta');
    expect(result.subtitle).toContain('Martín');
  });

  it('falls back to email when createdBy.firstName is absent', () => {
    const item: TenantActivityItem = {
      ...MOVEMENT_ITEM,
      createdBy: { id: 'user-3', email: 'sin-nombre@example.com' }
    };

    const result = describeTenantActivityItem(item);
    expect(result.subtitle).toContain('sin-nombre@example.com');
  });

  it('degrades gracefully (never throws) when property/createdBy are missing entirely', () => {
    const bareMovement: TenantActivityItem = {
      kind: 'movement',
      id: 'movement-bare',
      createdAt: '2026-07-15T10:00:00.000Z'
    };

    expect(() => describeTenantActivityItem(bareMovement)).not.toThrow();
    const result = describeTenantActivityItem(bareMovement);
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.subtitle.length).toBeGreaterThan(0);
  });
});

describe('describeTenantActivityItem() — membership items (platform-user-activity-capture)', () => {
  const INVITED_ITEM: TenantActivityItem = {
    kind: 'membership',
    id: 'membership-invited:invitation-1',
    tenantId: 'tenant-1',
    createdAt: '2026-07-16T10:00:00.000Z',
    membershipEvent: 'INVITED',
    subject: { email: 'invitado@example.com', firstName: null },
    actor: { id: 'inviter-1', email: 'inviter@example.com', firstName: 'Lucía' }
  };

  const JOINED_ITEM: TenantActivityItem = {
    kind: 'membership',
    id: 'membership-joined:membership-1',
    tenantId: 'tenant-1',
    createdAt: '2026-07-16T11:00:00.000Z',
    membershipEvent: 'JOINED',
    subject: { id: 'member-1', email: 'nuevo@example.com', firstName: 'Martín' },
    actor: null
  };

  const DEACTIVATED_ITEM: TenantActivityItem = {
    kind: 'membership',
    id: 'membership-deactivated:membership-2',
    tenantId: 'tenant-1',
    createdAt: '2026-07-16T12:00:00.000Z',
    membershipEvent: 'DEACTIVATED',
    subject: { id: 'member-2', email: 'saliente@example.com', firstName: 'Ana' },
    actor: { id: 'actor-1', email: 'actor@example.com', firstName: 'Operador Uno' }
  };

  it('an INVITED item renders "Usuario invitado" with the invitee email + who invited them', () => {
    const result = describeTenantActivityItem(INVITED_ITEM);

    expect(result.title).toContain('Usuario invitado');
    expect(result.title).toContain('invitado@example.com');
    expect(result.subtitle).toContain('Lucía');
  });

  it('a JOINED item renders "Usuario se unió" with the member name, and NO invited-by actor', () => {
    const result = describeTenantActivityItem(JOINED_ITEM);

    expect(result.title).toContain('Usuario se unió');
    expect(result.title).toContain('Martín');
  });

  it('a DEACTIVATED item renders "Usuario desactivado" with the member + who deactivated them', () => {
    const result = describeTenantActivityItem(DEACTIVATED_ITEM);

    expect(result.title).toContain('Usuario desactivado');
    expect(result.title).toContain('Ana');
    expect(result.subtitle).toContain('Operador Uno');
  });

  it('a membership item is NEVER rendered via the documentRequest/requestedBy fallback path', () => {
    const result = describeTenantActivityItem(INVITED_ITEM);

    expect(result.title).not.toContain('Documento');
    expect(result.subtitle).not.toContain('Solicitado por');
  });

  it('falls back to email when subject/actor firstName is absent', () => {
    const item: TenantActivityItem = {
      ...DEACTIVATED_ITEM,
      subject: { id: 'member-3', email: 'sin-nombre@example.com' },
      actor: { id: 'actor-2', email: 'sin-nombre-actor@example.com' }
    };

    const result = describeTenantActivityItem(item);
    expect(result.title).toContain('sin-nombre@example.com');
    expect(result.subtitle).toContain('sin-nombre-actor@example.com');
  });

  it('degrades gracefully (never throws) when subject/actor are missing entirely', () => {
    const bareMembership: TenantActivityItem = {
      kind: 'membership',
      id: 'membership-invited:bare',
      createdAt: '2026-07-16T10:00:00.000Z',
      membershipEvent: 'INVITED'
    };

    expect(() => describeTenantActivityItem(bareMembership)).not.toThrow();
    const result = describeTenantActivityItem(bareMembership);
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.subtitle.length).toBeGreaterThan(0);
  });
});

describe('describeTenantActivityItem() — ROLE_CHANGED items (platform-role-change-activity, T10)', () => {
  const ROLE_CHANGED_ITEM: TenantActivityItem = {
    kind: 'membership',
    id: 'member-role-changed:event-1',
    tenantId: 'tenant-1',
    createdAt: '2026-07-17T10:00:00.000Z',
    membershipEvent: 'ROLE_CHANGED',
    subject: { id: 'member-1', email: 'member@example.com', firstName: 'Martín' },
    actor: { id: 'actor-1', email: 'owner@example.com', firstName: 'Ana' },
    previousRole: 'MANAGER',
    newRole: 'AGENT'
  };

  it('renders "Rol cambiado" with Spanish role labels (not raw enum codes), and NOT the document-request fallback', () => {
    const result = describeTenantActivityItem(ROLE_CHANGED_ITEM);

    expect(result.title).toBe('Rol cambiado · Martín: Encargado → Vendedor');
    expect(result.title).not.toContain('MANAGER');
    expect(result.title).not.toContain('AGENT');
    expect(result.title).not.toContain('Documento');
    expect(result.subtitle).toContain('Ana');
  });

  it('maps every TenantRole enum value to its Spanish label', () => {
    const cases: Array<[string, string]> = [
      ['PRINCIPAL_MANAGER', 'Encargado principal'],
      ['MANAGER', 'Encargado'],
      ['AGENT', 'Vendedor']
    ];

    for (const [role, label] of cases) {
      const result = describeTenantActivityItem({
        ...ROLE_CHANGED_ITEM,
        previousRole: role,
        newRole: role
      });
      expect(result.title).toContain(`${label} → ${label}`);
    }
  });

  it('degrades gracefully (never throws) when previousRole/newRole are missing', () => {
    const bareItem: TenantActivityItem = {
      kind: 'membership',
      id: 'member-role-changed:bare',
      createdAt: '2026-07-17T10:00:00.000Z',
      membershipEvent: 'ROLE_CHANGED'
    };

    expect(() => describeTenantActivityItem(bareItem)).not.toThrow();
    const result = describeTenantActivityItem(bareItem);
    expect(result.title.length).toBeGreaterThan(0);
  });
});

describe('describeTenantActivityItem() — movement, document_request, and existing membership items are unaffected by ROLE_CHANGED (T10 regression)', () => {
  it('still renders the movement item exactly as before', () => {
    const result = describeTenantActivityItem(MOVEMENT_ITEM);
    expect(result.title).toContain('Depto en Palermo');
    expect(result.subtitle).toContain('Lucía');
  });

  it('still renders the document_request item exactly as before', () => {
    const result = describeTenantActivityItem(DOCUMENT_REQUEST_ITEM);
    expect(result.title).toContain('Escritura');
    expect(result.subtitle).toContain('Martín');
  });

  it('still renders an INVITED membership item exactly as before', () => {
    const result = describeTenantActivityItem({
      kind: 'membership',
      id: 'membership-invited:invitation-1',
      tenantId: 'tenant-1',
      createdAt: '2026-07-16T10:00:00.000Z',
      membershipEvent: 'INVITED',
      subject: { email: 'invitado@example.com', firstName: null },
      actor: { id: 'inviter-1', email: 'inviter@example.com', firstName: 'Lucía' }
    });
    expect(result.title).toContain('Usuario invitado');
  });
});

describe('describeTenantActivityItem() — movement and document_request items are unaffected by the exhaustive switch', () => {
  it('still renders the movement item exactly as before', () => {
    const result = describeTenantActivityItem(MOVEMENT_ITEM);
    expect(result.title).toContain('Depto en Palermo');
    expect(result.subtitle).toContain('Lucía');
  });

  it('still renders the document_request item exactly as before', () => {
    const result = describeTenantActivityItem(DOCUMENT_REQUEST_ITEM);
    expect(result.title).toContain('Escritura');
    expect(result.subtitle).toContain('Martín');
  });
});

describe('formatActivityTimestamp()', () => {
  it('formats a valid ISO timestamp as an es-AR short date/time string', () => {
    const result = formatActivityTimestamp('2026-07-15T10:00:00.000Z');

    // es-AR "short" dateStyle renders DD/M/YY (Node ICU); assert the date
    // portion only, not the full locale-dependent string (avoids brittle
    // exact-format coupling with the time/AM-PM segment).
    expect(result).toMatch(/15\/7\/2?026|15\/07\/2?026|15\/7\/26|15\/07\/26/);
  });

  it('a malformed timestamp fails safe to "—"', () => {
    expect(formatActivityTimestamp('not-a-date')).toBe('—');
  });
});

describe('buildTenantActivityDetail', () => {
  const toMap = (fields: { label: string; value: string }[]) =>
    Object.fromEntries(fields.map((field) => [field.label, field.value]));

  it('surfaces who/when plus the movement technical fields', () => {
    const detail = toMap(
      buildTenantActivityDetail({
        ...MOVEMENT_ITEM,
        type: 'OFFER_RECEIVED',
        observation: 'Ofertaron por la propiedad',
        nextStep: 'Llamar al propietario',
        previousStatus: 'INQUIRIES_AND_VISITS',
        newStatus: 'OFFER_NEGOTIATION',
        interestLevel: 'HIGH',
        visitCount: 2,
        offerAmountCents: 15000000,
        source: 'MANUAL'
      })
    );

    expect(detail['Registrado por']).toBe('Lucía (agente@example.com)');
    expect(detail['Fecha y hora']).not.toBe('—');
    expect(detail['Tipo']).toBe('Oferta recibida');
    expect(detail['Observación']).toBe('Ofertaron por la propiedad');
    expect(detail['Próximo paso']).toBe('Llamar al propietario');
    expect(detail['Cambio de estado']).toBe('Consultas y visitas → Negociación de oferta');
    expect(detail['Nivel de interés']).toBe('Alto');
    expect(detail['Visitas']).toBe('2');
    expect(detail['Oferta']).toContain('150.000');
    expect(detail['Origen']).toBe('Manual');
    expect(detail['Propiedad']).toBe('Depto en Palermo');
    expect(detail['Dirección']).toBe('Av. Santa Fe 1234, CABA, Buenos Aires');
  });

  it('omits absent movement fields instead of emitting blanks', () => {
    const detail = toMap(buildTenantActivityDetail(MOVEMENT_ITEM));

    expect(detail['Observación']).toBe('Se actualizó el estado');
    expect('Próximo paso' in detail).toBe(false);
    expect('Oferta' in detail).toBe(false);
    expect('Cambio de estado' in detail).toBe(false);
  });

  it('surfaces the requested document and uploaded file for a document request', () => {
    const detail = toMap(
      buildTenantActivityDetail({
        ...DOCUMENT_REQUEST_ITEM,
        requestedBy: { id: 'user-2', email: 'encargado@example.com', firstName: 'Marta' },
        documentRequest: {
          title: 'Escritura',
          description: 'Escritura de la propiedad',
          status: 'SUBMITTED',
          currentVersion: { originalFilename: 'escritura.pdf', status: 'UPLOADED' }
        }
      })
    );

    expect(detail['Solicitado por']).toBe('Marta (encargado@example.com)');
    expect(detail['Documento']).toBe('Escritura');
    expect(detail['Estado']).toBe('Enviado');
    expect(detail['Archivo']).toBe('escritura.pdf · Subido');
  });

  it('never throws on a malformed item and still returns the timestamp', () => {
    const detail = toMap(
      buildTenantActivityDetail({
        kind: 'movement',
        id: 'x',
        createdAt: 'not-a-date'
      } as TenantActivityItem)
    );

    expect(detail['Fecha y hora']).toBe('—');
  });
});
