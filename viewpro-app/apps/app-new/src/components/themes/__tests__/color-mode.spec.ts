import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildThemeColorPreloadScript, COLOR_MODE_POLICY } from '../color-mode';

type StoredTheme = 'light' | 'dark' | 'system' | 'corrupt' | null;

function runPreload({
  savedTheme,
  prefersDark = false
}: {
  savedTheme: StoredTheme;
  prefersDark?: boolean;
}) {
  document.head.innerHTML = `<meta name="theme-color" content="${COLOR_MODE_POLICY.colors.light}">`;
  localStorage.clear();
  if (savedTheme !== null) localStorage.setItem(COLOR_MODE_POLICY.storageKey, savedTheme);

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: prefersDark }))
  );
  const writes = {
    clear: vi.spyOn(Storage.prototype, 'clear'),
    removeItem: vi.spyOn(Storage.prototype, 'removeItem'),
    setItem: vi.spyOn(Storage.prototype, 'setItem')
  };
  const initialValue = localStorage.getItem(COLOR_MODE_POLICY.storageKey);

  new Function(buildThemeColorPreloadScript())();

  return { initialValue, writes };
}

afterEach(() => {
  document.head.innerHTML = '';
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('color mode preload policy', () => {
  it.each([
    [null, false, COLOR_MODE_POLICY.colors.light],
    [null, true, COLOR_MODE_POLICY.colors.light],
    ['light', false, COLOR_MODE_POLICY.colors.light],
    ['light', true, COLOR_MODE_POLICY.colors.light],
    ['dark', false, COLOR_MODE_POLICY.colors.dark],
    ['dark', true, COLOR_MODE_POLICY.colors.dark],
    ['system', false, COLOR_MODE_POLICY.colors.light],
    ['system', true, COLOR_MODE_POLICY.colors.dark],
    ['corrupt', false, COLOR_MODE_POLICY.colors.light],
    ['corrupt', true, COLOR_MODE_POLICY.colors.light]
  ] as const)(
    'resolves saved %s with dark media %s to %s without changing storage',
    (savedTheme, prefersDark, expectedColor) => {
      const { initialValue, writes } = runPreload({ savedTheme, prefersDark });

      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
        'content',
        expectedColor
      );
      expect(localStorage.getItem(COLOR_MODE_POLICY.storageKey)).toBe(initialValue);
      expect(writes.setItem).not.toHaveBeenCalled();
      expect(writes.removeItem).not.toHaveBeenCalled();
      expect(writes.clear).not.toHaveBeenCalled();
    }
  );

  it('keeps the light meta when storage or the saved-system media lookup fails', () => {
    document.head.innerHTML = `<meta name="theme-color" content="${COLOR_MODE_POLICY.colors.light}">`;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied');
    });

    expect(() => new Function(buildThemeColorPreloadScript())()).not.toThrow();
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      COLOR_MODE_POLICY.colors.light
    );
  });

  it('keeps saved dark when matchMedia is unavailable', () => {
    document.head.innerHTML = `<meta name="theme-color" content="${COLOR_MODE_POLICY.colors.light}">`;
    localStorage.setItem(COLOR_MODE_POLICY.storageKey, 'dark');
    vi.stubGlobal('matchMedia', undefined);

    expect(() => new Function(buildThemeColorPreloadScript())()).not.toThrow();
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      COLOR_MODE_POLICY.colors.dark
    );
  });

  it.each([
    ['unavailable', undefined],
    [
      'throwing',
      () => {
        throw new Error('media denied');
      }
    ]
  ] as const)('fails light for saved system when matchMedia is %s', (_label, matchMedia) => {
    document.head.innerHTML = `<meta name="theme-color" content="${COLOR_MODE_POLICY.colors.light}">`;
    localStorage.setItem(COLOR_MODE_POLICY.storageKey, 'system');
    vi.stubGlobal('matchMedia', matchMedia);

    expect(() => new Function(buildThemeColorPreloadScript())()).not.toThrow();
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      COLOR_MODE_POLICY.colors.light
    );
  });

  it('is a no-op when the theme-color meta is missing', () => {
    localStorage.setItem(COLOR_MODE_POLICY.storageKey, 'system');
    vi.stubGlobal('matchMedia', () => {
      throw new Error('media denied');
    });

    expect(() => new Function(buildThemeColorPreloadScript())()).not.toThrow();
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
  });
});
