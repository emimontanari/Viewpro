import '@testing-library/jest-dom/vitest';

// jsdom does not implement ResizeObserver, which cmdk (Command) — used by the
// shared DataTable faceted filter / view-options popovers — depends on. Provide
// a no-op polyfill so those components can mount under test.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
