import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PortalChooserView } from './portal-chooser-view';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('PortalChooserView', () => {
  it('offers both destinations to a dual-context identity', () => {
    render(<PortalChooserView />);

    // Queried by the primary label of each card: both descriptions mention
    // "propiedades", so a looser query matches both and proves nothing.
    expect(
      screen.getByRole('link', { name: /trabajar en la inmobiliaria/i })
    ).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /ver mis propiedades/i })).toHaveAttribute(
      'href',
      '/owner'
    );
  });

  it('offers exactly two destinations, both internal', () => {
    // Criterion 6: the chooser is not a place to introduce a new redirect
    // surface. Both destinations are literals owned by this component.
    render(<PortalChooserView />);

    const links = screen.getAllByRole('link');

    expect(links).toHaveLength(2);
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(href.startsWith('/')).toBe(true);
      expect(href.startsWith('//')).toBe(false);
    }
  });

  it('is reachable by keyboard', async () => {
    // Both destinations are real links, so they are focusable and activate with
    // Enter without any handler of ours.
    const user = userEvent.setup();
    render(<PortalChooserView />);

    await user.tab();

    expect(screen.getAllByRole('link')).toContain(document.activeElement);
  });

  it('says why it is asking', () => {
    // A chooser with no explanation reads as an error screen.
    render(<PortalChooserView />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
