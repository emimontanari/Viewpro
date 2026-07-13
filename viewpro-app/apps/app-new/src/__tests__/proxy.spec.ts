import { describe, it, expect } from 'vitest';

/**
 * T-21 — proxy.ts isProtectedAppPath guards /admin paths.
 *
 * Spec: app-new-proxy-hardening — /admin Server-Side Protection (both scenarios)
 *
 * RED: Before T-21, isProtectedAppPath does not include /admin.
 *      These tests fail against the current implementation.
 * GREEN: After adding /admin to proxy.ts, all tests pass.
 */

// Import the exported function from proxy.ts.
// This import will FAIL until isProtectedAppPath is exported (RED phase).
// After T-21 implementation (export + /admin added), it becomes GREEN.
import { isProtectedAppPath } from '../proxy';

describe('isProtectedAppPath — /admin protection (T-21)', () => {
  it('/admin is protected', () => {
    expect(isProtectedAppPath('/admin')).toBe(true);
  });

  it('/admin/ is protected', () => {
    expect(isProtectedAppPath('/admin/')).toBe(true);
  });

  it('/admin/tenants is protected', () => {
    expect(isProtectedAppPath('/admin/tenants')).toBe(true);
  });

  it('/admin/tenants/tenant-1/status is protected', () => {
    expect(isProtectedAppPath('/admin/tenants/tenant-1/status')).toBe(true);
  });

  // Regression: existing protected paths remain protected
  it('/dashboard is still protected (regression)', () => {
    expect(isProtectedAppPath('/dashboard')).toBe(true);
  });

  it('/dashboard/overview is still protected (regression)', () => {
    expect(isProtectedAppPath('/dashboard/overview')).toBe(true);
  });

  it('/owner is still protected (regression)', () => {
    expect(isProtectedAppPath('/owner')).toBe(true);
  });

  // Unprotected paths must remain unprotected
  it('/public is NOT protected', () => {
    expect(isProtectedAppPath('/public')).toBe(false);
  });

  it('/ is NOT protected', () => {
    expect(isProtectedAppPath('/')).toBe(false);
  });

  it('/auth/sign-in is NOT protected', () => {
    expect(isProtectedAppPath('/auth/sign-in')).toBe(false);
  });

  it('/adminpage is NOT protected (no startsWith match for /admin/)', () => {
    // /adminpage does not start with '/admin/' and is not '/admin'
    expect(isProtectedAppPath('/adminpage')).toBe(false);
  });
});
