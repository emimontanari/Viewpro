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

// jsdom does not implement pointer capture or scrollIntoView, which
// @radix-ui/react-select (used by AuditFilterBar, audit-view Slice 4) relies
// on for its pointer-driven open/select interaction. Guarded so a real
// implementation (if one is ever polyfilled elsewhere) is never overridden.
for (const method of ['hasPointerCapture', 'releasePointerCapture', 'setPointerCapture']) {
  if (!(method in Element.prototype)) {
    Object.defineProperty(Element.prototype, method, {
      value: () => false,
      writable: true
    });
  }
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
