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
import { describeTenantActivityItem, formatActivityTimestamp } from '../activity-feed-formatting';

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
