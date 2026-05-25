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

  it('rejects external and unsafe redirects', () => {
    expect(getSafeSignInRedirect('https://evil.example/dashboard')).toBe('/dashboard');
    expect(getSafeSignInRedirect('/../dashboard')).toBe('/dashboard');
  });
});
