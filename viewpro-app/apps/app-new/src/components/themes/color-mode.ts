export const COLOR_MODE_POLICY = {
  defaultMode: 'light',
  enableSystem: true,
  storageKey: 'theme',
  darkValue: 'dark',
  systemValue: 'system',
  darkMediaQuery: '(prefers-color-scheme: dark)',
  themeColorSelector: 'meta[name="theme-color"]',
  colors: {
    light: '#ffffff',
    dark: '#09090b'
  }
} as const;

export function buildThemeColorPreloadScript() {
  return `try {
  const policy = ${JSON.stringify(COLOR_MODE_POLICY)};
  const saved = window.localStorage.getItem(policy.storageKey);
  const isDark = saved === policy.darkValue || (saved === policy.systemValue && window.matchMedia?.(policy.darkMediaQuery).matches);
  if (isDark) document.querySelector(policy.themeColorSelector)?.setAttribute('content', policy.colors.dark);
} catch (_) {}`;
}
