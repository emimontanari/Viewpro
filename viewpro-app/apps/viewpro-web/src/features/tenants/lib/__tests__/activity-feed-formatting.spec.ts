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
