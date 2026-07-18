/**
 * Header command-palette search box.
 *
 * Re-adds the starter's visible search affordance in the header. The button is
 * a trigger only — it dispatches the same window event the kbar palette already
 * listens for (COMMAND_PALETTE_OPEN_EVENT), so kbar stays the single source of
 * truth for the command palette.
 */
import * as React from 'react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import SearchInput from '../search-input';
import { COMMAND_PALETTE_OPEN_EVENT } from '../kbar/events';

afterEach(cleanup);

describe('SearchInput — header command-palette trigger', () => {
  it('renders a search affordance with the ⌘K hint', () => {
    render(<SearchInput />);

    expect(screen.getByRole('button')).toBeTruthy();
    expect(screen.getByText(/buscar/i)).toBeTruthy();
    expect(screen.getByText('K')).toBeTruthy();
  });

  it('dispatches the kbar open event on click (wires to existing kbar)', () => {
    const handler = vi.fn();
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handler);

    render(<SearchInput />);
    fireEvent.click(screen.getByRole('button'));

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handler);
  });
});
