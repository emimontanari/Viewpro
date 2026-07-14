import { describe, expect, it } from 'vitest';
import { getSafeSignInRedirect } from './sign-in-view';

describe('getSafeSignInRedirect', () => {
  it('defaults sign-in to the dashboard', () => {
    expect(getSafeSignInRedirect(null)).toBe('/dashboard');
  });

  it('keeps safe dashboard redirect URLs', () => {
    expect(getSafeSignInRedirect('/dashboard')).toBe('/dashboard');
  });

  it('rejects external and unsafe redirects', () => {
    expect(getSafeSignInRedirect('https://evil.example/dashboard')).toBe('/dashboard');
    expect(getSafeSignInRedirect('/../dashboard')).toBe('/dashboard');
  });

  it('rejects non-dashboard paths (no owner/other routes in operator console)', () => {
    // Operator console only has /dashboard* as a safe redirect
    expect(getSafeSignInRedirect('/owner/properties/property-1')).toBe('/dashboard');
  });
});
