/**
 * Client-side behavior for the redesigned tenant activity feed
 * (feat/web-tenant-detail-redesign). Presentation-only: the same items render
 * with the same titles; these tests exercise the NEW local-state category
 * filter, the visible-count label, aria-pressed, date separators, and confirm
 * the filter composes with "Cargar más" WITHOUT any fetch (the feed receives
 * items purely via props).
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { TenantActivityItem } from '@/features/tenants/api/types';

// Mock fetchDocumentReadUrl before importing the component (Slice 2b, 2b.7).
vi.mock('@/features/tenants/api/service', () => ({
  fetchDocumentReadUrl: vi.fn()
}));

import { fetchDocumentReadUrl } from '@/features/tenants/api/service';
import { TenantActivityFeed } from '../tenant-activity-feed';

const mockFetchDocumentReadUrl = vi.mocked(fetchDocumentReadUrl);

// Two calendar days, one item of each category:
//  - membership (user)      2026-07-15
//  - movement STATUS_CHANGE (update)   2026-07-15
//  - movement INQUIRY (inquiry)        2026-07-14
//  - document_request (deed)           2026-07-14
const ITEMS: TenantActivityItem[] = [
  {
    kind: 'membership',
    id: 'user-1',
    membershipEvent: 'INVITED',
    subject: { firstName: 'Ana' },
    actor: { firstName: 'Ops' },
    createdAt: '2026-07-15T12:00:00.000Z'
  },
  {
    kind: 'movement',
    id: 'update-1',
    type: 'STATUS_CHANGE',
    createdAt: '2026-07-15T10:00:00.000Z'
  },
  {
    kind: 'movement',
    id: 'inquiry-1',
    type: 'INQUIRY',
    createdAt: '2026-07-14T10:00:00.000Z'
  },
  {
    kind: 'document_request',
    id: 'deed-1',
    createdAt: '2026-07-14T09:00:00.000Z'
  }
];

function renderFeed(overrides: Partial<React.ComponentProps<typeof TenantActivityFeed>> = {}) {
  const props = {
    items: ITEMS,
    hasMore: false,
    isLoadingMore: false,
    onLoadMore: vi.fn(),
    tenantId: 'tenant-1',
    ...overrides
  };
  render(<TenantActivityFeed {...props} />);
  return props;
}

async function expandItem(testId: string) {
  const user = userEvent.setup();
  const item = screen.getByTestId(testId);
  await user.click(within(item).getByRole('button'));
  return user;
}

describe('TenantActivityFeed — category filter', () => {
  it('shows all items and all filter chips by default ("Todos" active)', () => {
    renderFeed();

    expect(screen.getByTestId('tenant-activity-item-user-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-activity-item-update-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-activity-item-inquiry-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-activity-item-deed-1')).toBeTruthy();

    expect(screen.getByTestId('tenant-activity-filter-all').getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('filtering by "Usuarios" shows only membership items and hides the rest', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-user'));

    expect(screen.getByTestId('tenant-activity-item-user-1')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-item-update-1')).toBeNull();
    expect(screen.queryByTestId('tenant-activity-item-inquiry-1')).toBeNull();
    expect(screen.queryByTestId('tenant-activity-item-deed-1')).toBeNull();
  });

  it('filtering by "Escrituras" shows only document_request items', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-deed'));

    expect(screen.getByTestId('tenant-activity-item-deed-1')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-item-user-1')).toBeNull();
    expect(screen.queryByTestId('tenant-activity-item-inquiry-1')).toBeNull();
  });

  it('filtering by "Consultas" shows only INQUIRY movements', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-inquiry'));

    expect(screen.getByTestId('tenant-activity-item-inquiry-1')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-item-update-1')).toBeNull();
  });

  it('filtering by "Actualizaciones" shows non-inquiry movements', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-update'));

    expect(screen.getByTestId('tenant-activity-item-update-1')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-item-inquiry-1')).toBeNull();
  });

  it('"Todos" restores every item after another filter was active', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-user'));
    expect(screen.queryByTestId('tenant-activity-item-deed-1')).toBeNull();

    await user.click(screen.getByTestId('tenant-activity-filter-all'));
    expect(screen.getByTestId('tenant-activity-item-deed-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-activity-item-user-1')).toBeTruthy();
  });

  it('reflects the active chip via aria-pressed', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-user'));

    expect(screen.getByTestId('tenant-activity-filter-user').getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(screen.getByTestId('tenant-activity-filter-all').getAttribute('aria-pressed')).toBe(
      'false'
    );
  });
});

describe('TenantActivityFeed — visible-count label', () => {
  it('shows the total event count by default', () => {
    renderFeed();
    expect(screen.getByText('(4 eventos)')).toBeTruthy();
  });

  it('updates the count to the visible items after filtering', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-user'));
    expect(screen.getByText('(1 evento)')).toBeTruthy();
  });
});

describe('TenantActivityFeed — date separators', () => {
  it('renders a day-separator heading per distinct calendar day', () => {
    renderFeed();
    // Level-3 headings are the per-day separators (the section title is h2).
    const separators = screen.getAllByRole('heading', { level: 3 });
    // Two distinct days across the fixture (2026-07-15 and 2026-07-14).
    expect(separators.length).toBe(2);
  });

  it('only renders separators for days that still have visible items after filtering', async () => {
    const user = userEvent.setup();
    renderFeed();

    // "Usuarios" leaves a single item on 2026-07-15 → exactly one separator.
    await user.click(screen.getByTestId('tenant-activity-filter-user'));
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(1);
  });
});

describe('TenantActivityFeed — "Cargar más" composition (no fetch)', () => {
  it('keeps the filter active and calls the parent-provided onLoadMore (no internal fetch)', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    renderFeed({ hasMore: true, onLoadMore });

    await user.click(screen.getByTestId('tenant-activity-filter-user'));
    await user.click(screen.getByRole('button', { name: /cargar más/i }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    // Filter is still applied (still only the membership item shows).
    expect(screen.getByTestId('tenant-activity-item-user-1')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-item-deed-1')).toBeNull();
  });

  it('renders the empty state (not the list) when there are no items at all', () => {
    renderFeed({ items: [] });
    expect(screen.getByTestId('tenant-activity-empty')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-list')).toBeNull();
  });
});

describe('TenantActivityFeed — expandable detail', () => {
  it('reveals the technical detail (who/when) when a row is expanded', async () => {
    const user = userEvent.setup();
    renderFeed();

    // Collapsed: the detail panel is not mounted.
    expect(screen.queryByText('Realizado por')).toBeNull();

    const item = screen.getByTestId('tenant-activity-item-user-1');
    await user.click(within(item).getByRole('button'));

    // Expanded: the panel surfaces the subject, actor and timestamp.
    expect(await screen.findByText('Usuario')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Realizado por')).toBeTruthy();
    expect(screen.getByText('Ops')).toBeTruthy();
    expect(screen.getByText('Fecha y hora')).toBeTruthy();
  });
});

/**
 * operator-activity-media (Slice 1) — RED: property-image thumbnail strip in
 * the collapsible detail panel.
 *
 * Spec: activity-feed-property-images — images shown inline in the detail
 *   panel; Design D8: rendered via next/image (remote pattern already
 *   whitelisted, next.config.ts:13-15), sourced defensively via
 *   readPropertyImages — a missing/empty `images` field never crashes and
 *   simply omits the strip.
 */
describe('TenantActivityFeed — property image thumbnail strip', () => {
  const ITEM_WITH_IMAGES: TenantActivityItem = {
    kind: 'movement',
    id: 'movement-with-images',
    type: 'STATUS_CHANGE',
    createdAt: '2026-07-16T10:00:00.000Z',
    property: {
      title: 'Depto en Palermo',
      images: [
        { id: 'img-1', url: 'https://cdn.example.com/img-1.jpg', isPrimary: true, originalFilename: 'front.jpg' },
        { id: 'img-2', url: 'https://cdn.example.com/img-2.jpg', isPrimary: false, originalFilename: 'back.jpg' }
      ]
    }
  };

  const ITEM_WITHOUT_IMAGES: TenantActivityItem = {
    kind: 'movement',
    id: 'movement-without-images',
    type: 'STATUS_CHANGE',
    createdAt: '2026-07-16T09:00:00.000Z',
    property: { title: 'Casa en Nordelta', images: [] }
  };

  const ITEM_WITH_MISSING_IMAGES_FIELD: TenantActivityItem = {
    kind: 'movement',
    id: 'movement-missing-images-field',
    type: 'STATUS_CHANGE',
    createdAt: '2026-07-16T08:00:00.000Z',
    property: { title: 'Casa sin campo images' }
  };

  it('renders a thumbnail per image when the expanded item has property.images', async () => {
    const user = userEvent.setup();
    renderFeed({ items: [ITEM_WITH_IMAGES] });

    const item = screen.getByTestId('tenant-activity-item-movement-with-images');
    await user.click(within(item).getByRole('button'));

    const strip = await screen.findByTestId('tenant-activity-image-strip');
    expect(within(strip).getAllByRole('img')).toHaveLength(2);
    expect(within(strip).getByAltText('front.jpg')).toBeTruthy();
    expect(within(strip).getByAltText('back.jpg')).toBeTruthy();
  });

  it('omits the thumbnail strip when the expanded item has an empty property.images array', async () => {
    const user = userEvent.setup();
    renderFeed({ items: [ITEM_WITHOUT_IMAGES] });

    const item = screen.getByTestId('tenant-activity-item-movement-without-images');
    await user.click(within(item).getByRole('button'));

    // Panel still expands (other detail fields render) but no image strip.
    expect(await screen.findByText('Propiedad')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-image-strip')).toBeNull();
  });

  it('does not crash and omits the strip when property.images is entirely absent from the wire', async () => {
    const user = userEvent.setup();
    renderFeed({ items: [ITEM_WITH_MISSING_IMAGES_FIELD] });

    const item = screen.getByTestId('tenant-activity-item-movement-missing-images-field');
    await user.click(within(item).getByRole('button'));

    expect(await screen.findByText('Propiedad')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-image-strip')).toBeNull();
  });
});

/**
 * operator-activity-media (Slice 2b, task 2b.7) — RED: "Ver documento" action
 * button in the collapsible detail panel.
 *
 * Spec: operator-document-read — on-demand signed URL mint, permission-gated,
 *   never embedded in the feed payload; each click re-mints (no caching).
 * Design: visible only for a `document_request` item with a `currentVersion`
 *   present; click -> fetchDocumentReadUrl(tenantId, versionId) ->
 *   window.open(url, '_blank', 'noopener') on success; inline "Sin permiso"
 *   message on 403; other errors surface a generic inline message without
 *   breaking the rest of the panel.
 */
describe('TenantActivityFeed — "Ver documento" action button', () => {
  const DOCUMENT_ITEM_WITH_VERSION: TenantActivityItem = {
    kind: 'document_request',
    id: 'deed-with-version',
    createdAt: '2026-07-16T10:00:00.000Z',
    documentRequest: {
      title: 'Escritura',
      description: null,
      status: 'SUBMITTED',
      currentVersion: { id: 'version-1', originalFilename: 'escritura.pdf', status: 'UPLOADED' }
    }
  };

  const DOCUMENT_ITEM_WITHOUT_VERSION: TenantActivityItem = {
    kind: 'document_request',
    id: 'deed-without-version',
    createdAt: '2026-07-16T09:00:00.000Z',
    documentRequest: {
      title: 'Escritura',
      description: null,
      status: 'PENDING',
      currentVersion: null
    }
  };

  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetchDocumentReadUrl.mockReset();
    // window persists across tests within this file (jsdom is created once per
    // test file), so vi.spyOn reuses the SAME underlying mock on repeat calls
    // and does NOT clear its prior call history — mockRestore() first ensures
    // every test gets a truly fresh spy with an empty call log.
    if (openSpy) {
      openSpy.mockRestore();
    }
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('shows the "Ver documento" button when the item has an uploaded currentVersion', async () => {
    renderFeed({ items: [DOCUMENT_ITEM_WITH_VERSION] });

    await expandItem('tenant-activity-item-deed-with-version');

    expect(await screen.findByRole('button', { name: 'Ver documento' })).toBeTruthy();
  });

  it('omits the button when the item has no currentVersion (nothing uploaded yet)', async () => {
    renderFeed({ items: [DOCUMENT_ITEM_WITHOUT_VERSION] });

    await expandItem('tenant-activity-item-deed-without-version');

    expect(await screen.findByText('Escritura')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver documento' })).toBeNull();
  });

  it('on click, fetches the read URL and opens it in a new tab', async () => {
    mockFetchDocumentReadUrl.mockResolvedValueOnce({
      url: 'https://storage.example/read/escritura.pdf',
      expiresInSeconds: 300,
      originalFilename: 'escritura.pdf',
      mimeType: 'application/pdf'
    });
    renderFeed({ items: [DOCUMENT_ITEM_WITH_VERSION] });
    const user = await expandItem('tenant-activity-item-deed-with-version');

    const button = await screen.findByRole('button', { name: 'Ver documento' });
    await user.click(button);

    expect(mockFetchDocumentReadUrl).toHaveBeenCalledWith('tenant-1', 'version-1');
    expect(openSpy).toHaveBeenCalledWith('https://storage.example/read/escritura.pdf', '_blank', 'noopener');
  });

  it('shows an inline "Sin permiso" message on 403 and does not open a tab', async () => {
    renderFeed({ items: [DOCUMENT_ITEM_WITH_VERSION] });
    const user = await expandItem('tenant-activity-item-deed-with-version');
    mockFetchDocumentReadUrl.mockRejectedValueOnce({ status: 403, message: 'Insufficient permissions' });

    const button = await screen.findByRole('button', { name: 'Ver documento' });
    await user.click(button);

    expect(await screen.findByText('Sin permiso para ver este documento.')).toBeTruthy();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('shows a generic inline error message on a non-403 failure without breaking the rest of the panel', async () => {
    renderFeed({ items: [DOCUMENT_ITEM_WITH_VERSION] });
    const user = await expandItem('tenant-activity-item-deed-with-version');
    mockFetchDocumentReadUrl.mockRejectedValueOnce({ status: 502, message: 'Failed to reach InmoView' });

    const button = await screen.findByRole('button', { name: 'Ver documento' });
    await user.click(button);

    expect(await screen.findByText('Failed to reach InmoView')).toBeTruthy();
    expect(openSpy).not.toHaveBeenCalled();
    // The rest of the panel is untouched.
    expect(screen.getByText('Escritura')).toBeTruthy();
  });

  it('re-fetches on every click — never caches the previously minted URL', async () => {
    mockFetchDocumentReadUrl
      .mockResolvedValueOnce({
        url: 'https://storage.example/read/escritura-1.pdf',
        expiresInSeconds: 300,
        originalFilename: 'escritura.pdf',
        mimeType: 'application/pdf'
      })
      .mockResolvedValueOnce({
        url: 'https://storage.example/read/escritura-2.pdf',
        expiresInSeconds: 300,
        originalFilename: 'escritura.pdf',
        mimeType: 'application/pdf'
      });
    renderFeed({ items: [DOCUMENT_ITEM_WITH_VERSION] });
    const user = await expandItem('tenant-activity-item-deed-with-version');

    const button = await screen.findByRole('button', { name: 'Ver documento' });
    await user.click(button);
    await user.click(button);

    expect(mockFetchDocumentReadUrl).toHaveBeenCalledTimes(2);
    expect(openSpy).toHaveBeenNthCalledWith(1, 'https://storage.example/read/escritura-1.pdf', '_blank', 'noopener');
    expect(openSpy).toHaveBeenNthCalledWith(2, 'https://storage.example/read/escritura-2.pdf', '_blank', 'noopener');
  });
});
