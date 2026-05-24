import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityFeed } from './activity-feed';
import type { ActivityKindFilter } from '../api/types';

type ActivityFeedProps = Parameters<typeof ActivityFeed>[0];

function renderActivityFeed(overrides: Partial<ActivityFeedProps> = {}) {
  const props: ActivityFeedProps = {
    isError: false,
    isFetching: false,
    isLoading: false,
    items: [],
    kind: 'all',
    page: 1,
    pageCount: 1,
    total: 0,
    onPageChange: vi.fn(),
    onRetry: vi.fn(),
    ...overrides
  };

  return render(<ActivityFeed {...props} />);
}

describe('ActivityFeed', () => {
  it.each([
    ['all', 'Sin actividad para mostrar'],
    ['movement', 'Sin movimientos para mostrar'],
    ['document_request', 'Sin documentos para mostrar']
  ] as Array<[ActivityKindFilter, string]>)(
    'keeps the feed shell visible for empty %s results',
    (kind, title) => {
      renderActivityFeed({ kind });

      expect(screen.getByRole('heading', { name: 'Últimas actualizaciones' })).toBeVisible();
      expect(screen.getByText('0 encontrados')).toBeVisible();
      expect(screen.getByRole('heading', { name: title })).toBeVisible();
    }
  );

  it('keeps the updating status inside the feed shell while refetching', () => {
    renderActivityFeed({ isFetching: true, kind: 'document_request' });

    expect(screen.getByRole('heading', { name: 'Últimas actualizaciones' })).toBeVisible();
    expect(screen.getByText('Actualizando…')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Sin documentos para mostrar' })).toBeVisible();
  });
});
