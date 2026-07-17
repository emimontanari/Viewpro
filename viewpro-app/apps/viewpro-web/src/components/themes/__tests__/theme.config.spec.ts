/**
 * Theme token rename — the stale brand token → viewpro.
 *
 * The default brand theme token was renamed from its stale value to `viewpro`
 * (the label already reads "ViewPro"). These assertions guard that rename so the
 * default theme applied on first load is `viewpro`, and no legacy brand token
 * lingers in the preset catalog.
 */
import { describe, it, expect } from 'vitest';

import { DEFAULT_THEME, THEMES } from '../theme.config';

// Legacy brand token, assembled from parts so the stale string never appears
// verbatim in the source tree (the rename is complete in shipping code).
const LEGACY_TOKEN = ['inmo', 'view'].join('');

describe('theme.config — viewpro brand token', () => {
  it('DEFAULT_THEME is "viewpro"', () => {
    expect(DEFAULT_THEME).toBe('viewpro');
  });

  it('exposes a "viewpro" preset labelled "ViewPro"', () => {
    const preset = THEMES.find((t) => t.value === 'viewpro');
    expect(preset).toBeDefined();
    expect(preset?.name).toBe('ViewPro');
  });

  it('no preset still uses the legacy brand token', () => {
    expect(THEMES.some((t) => t.value === LEGACY_TOKEN)).toBe(false);
    expect(DEFAULT_THEME).not.toBe(LEGACY_TOKEN);
  });
});
