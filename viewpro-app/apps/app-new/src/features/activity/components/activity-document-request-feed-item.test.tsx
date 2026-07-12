import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ActivityDocumentRequestItem } from '../api/types';
import { ActivityDocumentRequestFeedItem } from './activity-document-request-feed-item';

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

function buildDocumentRequestItem(
  overrides: Partial<ActivityDocumentRequestItem> = {}
): ActivityDocumentRequestItem {
  return {
    kind: 'document_request',
    id: 'doc-feed-item-1',
    tenantId: 'tenant-1',
    propertyEngagementId: 'engagement-42',
    documentRequestId: 'doc-request-1',
    createdAt: '2026-06-01T12:00:00.000Z',
    property: {
      id: 'prop-1',
      engagementId: 'engagement-42',
      assetId: 'asset-1',
      title: 'Casa demo',
      addressLine: 'Av. Siempreviva 742',
      city: 'Buenos Aires',
      province: 'CABA',
      operationType: 'SALE',
      status: 'ACTIVE_PUBLICATION',
      agents: []
    },
    owner: {
      id: 'owner-1',
      email: 'owner@example.com',
      firstName: 'Juana',
      lastName: 'Perez',
      ownerFirstName: 'Juana',
      ownerLastName: 'Perez',
      accessStatus: 'INVITED'
    },
    requestedBy: {
      id: 'seller-1',
      email: 'seller@example.com',
      firstName: 'Sofía'
    },
    documentRequest: {
      title: 'DNI del propietario',
      description: 'Frente y dorso.',
      status: 'PENDING',
      currentVersion: {
        id: 'version-1',
        originalFilename: 'dni-frente.pdf',
        status: 'UPLOADED',
        createdAt: '2026-06-01T12:00:00.000Z'
      }
    },
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Helper: deep-merge documentRequest overrides
// ---------------------------------------------------------------------------

function withDocumentRequest(
  patch: Partial<ActivityDocumentRequestItem['documentRequest']>
): Pick<ActivityDocumentRequestItem, 'documentRequest'> {
  const base = buildDocumentRequestItem().documentRequest;
  return { documentRequest: { ...base, ...patch } };
}

function withCurrentVersion(
  patch: Partial<
    NonNullable<ActivityDocumentRequestItem['documentRequest']['currentVersion']>
  >
): Pick<ActivityDocumentRequestItem, 'documentRequest'> {
  const base = buildDocumentRequestItem().documentRequest;
  return {
    documentRequest: {
      ...base,
      currentVersion: { ...base.currentVersion!, ...patch }
    }
  };
}

// ---------------------------------------------------------------------------
// S-1..S-5 — Document status badge: label + tone class
// ---------------------------------------------------------------------------

describe('ActivityDocumentRequestFeedItem — document status badge', () => {
  it('renders PENDING status badge with amber tone (S-1)', () => {
    render(<ActivityDocumentRequestFeedItem item={buildDocumentRequestItem()} />);

    const badge = screen.getByText('Pendiente');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/bg-amber-50/);
  });

  it('renders SUBMITTED status badge with sky tone (S-2)', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem(withDocumentRequest({ status: 'SUBMITTED' }))}
      />
    );

    // "Subida" appears for both the doc-status badge and potentially the version label.
    // The doc-status badge is the first "Subida" rendered (in the badge row).
    const badges = screen.getAllByText('Subida');
    const statusBadge = badges.find((el) => /bg-sky-50/.test(el.className));
    expect(statusBadge).toBeDefined();
    expect(statusBadge!.className).toMatch(/bg-sky-50/);
  });

  it('renders APPROVED status badge with emerald tone (S-3)', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem(withDocumentRequest({ status: 'APPROVED' }))}
      />
    );

    const badge = screen.getByText('Aprobada');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/bg-emerald-50/);
  });

  it('renders REJECTED status badge with red tone (S-4)', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem(withDocumentRequest({ status: 'REJECTED' }))}
      />
    );

    // "Rechazada" may appear multiple times (status badge + version label).
    // Find the one with the red tone class.
    const elements = screen.getAllByText('Rechazada');
    const statusBadge = elements.find((el) => /bg-red-50/.test(el.className));
    expect(statusBadge).toBeDefined();
    expect(statusBadge!.className).toMatch(/bg-red-50/);
  });

  it('renders CANCELLED status badge with muted tone (S-5)', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem(withDocumentRequest({ status: 'CANCELLED' }))}
      />
    );

    const badge = screen.getByText('Cancelada');
    expect(badge).toBeInTheDocument();
    // Tone class: "border-muted bg-muted/50 text-muted-foreground"
    expect(badge.className).toMatch(/bg-muted\/50/);
  });
});

// ---------------------------------------------------------------------------
// S-6..S-9 — Version status labels (scoped under "Estado del archivo")
// ---------------------------------------------------------------------------

function getVersionSection(): HTMLElement {
  const heading = screen.getByText('Estado del archivo');
  // The heading is inside a flex div; its parent is the panel div.
  return (heading.closest('div[class*="rounded-xl"]') ?? heading.parentElement!) as HTMLElement;
}

describe('ActivityDocumentRequestFeedItem — version status labels', () => {
  it('renders PENDING_UPLOAD version label (S-6)', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem(withCurrentVersion({ status: 'PENDING_UPLOAD' }))}
      />
    );

    const section = getVersionSection();
    expect(within(section).getByText('Pendiente de carga')).toBeInTheDocument();
  });

  it('renders UPLOADED version label (S-7)', () => {
    render(<ActivityDocumentRequestFeedItem item={buildDocumentRequestItem()} />);

    const section = getVersionSection();
    expect(within(section).getByText('Subida')).toBeInTheDocument();
  });

  it('renders APPROVED version label (S-8)', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem(withCurrentVersion({ status: 'APPROVED' }))}
      />
    );

    const section = getVersionSection();
    expect(within(section).getByText('Aprobada')).toBeInTheDocument();
  });

  it('renders REJECTED version label (S-9)', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem(withCurrentVersion({ status: 'REJECTED' }))}
      />
    );

    const section = getVersionSection();
    expect(within(section).getByText('Rechazada')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// S-10 — Null currentVersion fallback
// ---------------------------------------------------------------------------

describe('ActivityDocumentRequestFeedItem — null currentVersion fallback (S-10)', () => {
  it('renders "Sin archivo cargado" when currentVersion is null', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem(withDocumentRequest({ currentVersion: null }))}
      />
    );

    expect(screen.getByText('Sin archivo cargado')).toBeInTheDocument();
    // No .pdf filename should appear
    expect(screen.queryByText(/\.pdf$/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// S-11 — Fallback strings + link href
// ---------------------------------------------------------------------------

describe('ActivityDocumentRequestFeedItem — fallback strings and link target (S-11)', () => {
  it('renders fallback strings and correct link target', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem({
          owner: null,
          requestedBy: { id: 'r-1', firstName: null, email: '' } as never
        })}
      />
    );

    // Owner fallback: when owner is null, ownerLabel = 'Propietario'.
    // ActivityMeta renders both a label "Propietario" and a value "Propietario" — two matches.
    // Assert at least one instance is present.
    const propietarioElements = screen.getAllByText('Propietario');
    expect(propietarioElements.length).toBeGreaterThanOrEqual(1);

    // Requester fallback
    expect(screen.getByText('Solicitante no disponible')).toBeInTheDocument();

    // Link href
    const link = screen.getByRole('link', { name: /Ver propiedad/ });
    expect(link).toHaveAttribute('href', '/dashboard/product/engagement-42');
  });
});

// ---------------------------------------------------------------------------
// T-16 — Edge tests: null documentRequest + blank property title
// ---------------------------------------------------------------------------

describe('ActivityDocumentRequestFeedItem — edge cases (T-16)', () => {
  it('renders "Solicitud no disponible" when documentRequest is undefined', () => {
    const item = buildDocumentRequestItem({
      documentRequest: undefined as never as ActivityDocumentRequestItem['documentRequest']
    });
    render(<ActivityDocumentRequestFeedItem item={item} />);

    expect(screen.getByText('Solicitud no disponible')).toBeInTheDocument();
  });

  it('renders "Propiedad sin título" when property.title is blank whitespace', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem({
          property: { ...buildDocumentRequestItem().property, title: '   ' }
        })}
      />
    );

    expect(screen.getByText('Propiedad sin título')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-17 — Owner name precedence edge tests (3 cases)
// ---------------------------------------------------------------------------

describe('ActivityDocumentRequestFeedItem — owner name precedence (T-17)', () => {
  const baseOwner = {
    id: 'owner-1',
    email: 'fb@x.io',
    accessStatus: 'INVITED' as const
  };

  it('prefers owner snapshot names over user names', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem({
          owner: {
            ...baseOwner,
            ownerFirstName: 'Snap',
            ownerLastName: 'Name',
            firstName: 'User',
            lastName: 'Different'
          }
        })}
      />
    );

    expect(screen.getByText('Snap Name')).toBeInTheDocument();
    expect(screen.queryByText('User Different')).not.toBeInTheDocument();
  });

  it('falls back to user firstName+lastName when owner snapshot is blank', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem({
          owner: {
            ...baseOwner,
            ownerFirstName: '',
            ownerLastName: '',
            firstName: 'User',
            lastName: 'Name'
          }
        })}
      />
    );

    expect(screen.getByText('User Name')).toBeInTheDocument();
  });

  it('falls back to owner email when both name sources are blank', () => {
    render(
      <ActivityDocumentRequestFeedItem
        item={buildDocumentRequestItem({
          owner: {
            ...baseOwner,
            ownerFirstName: '',
            ownerLastName: '',
            firstName: null,
            lastName: null
          }
        })}
      />
    );

    expect(screen.getByText('fb@x.io')).toBeInTheDocument();
  });
});
