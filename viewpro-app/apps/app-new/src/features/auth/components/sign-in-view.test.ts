import { describe, expect, it } from 'vitest';
import { getSafeSignInRedirect } from './sign-in-view';

describe('getSafeSignInRedirect', () => {
  it('defaults sign-in to the operational homepage', () => {
    expect(getSafeSignInRedirect(null)).toBe('/dashboard');
  });

  it('keeps safe dashboard redirect URLs', () => {
    expect(getSafeSignInRedirect('/dashboard/seguimiento?kind=movement')).toBe(
      '/dashboard/seguimiento?kind=movement'
    );
  });

  it('keeps safe owner redirect URLs', () => {
    expect(getSafeSignInRedirect('/owner/properties/property-1')).toBe(
      '/owner/properties/property-1'
    );
  });

  it('rejects external and unsafe redirects', () => {
    expect(getSafeSignInRedirect('https://evil.example/dashboard')).toBe('/dashboard');
    expect(getSafeSignInRedirect('https://evil.example/owner')).toBe('/dashboard');
    expect(getSafeSignInRedirect('/../dashboard')).toBe('/dashboard');
    expect(getSafeSignInRedirect('/owner/../dashboard')).toBe('/dashboard');
  });
});
