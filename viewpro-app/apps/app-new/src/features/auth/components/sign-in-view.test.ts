import { describe, expect, it } from 'vitest';
import { getPostSignInRedirect, getSafeSignInRedirect } from './sign-in-view';

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

describe('getPostSignInRedirect', () => {
  it('sends owner-only users to the owner portal by default', () => {
    expect(getPostSignInRedirect({ memberships: [] }, null)).toBe('/owner');
  });

  it('keeps explicit owner redirects for owner-only users', () => {
    expect(getPostSignInRedirect({ memberships: [] }, '/owner/properties/property-1')).toBe(
      '/owner/properties/property-1'
    );
  });

  it('does not send owner-only users to the tenant dashboard', () => {
    expect(getPostSignInRedirect({ memberships: [] }, '/dashboard')).toBe('/owner');
    expect(getPostSignInRedirect({ memberships: [] }, '/dashboard/seguimiento')).toBe('/owner');
  });

  it('keeps tenant members on the operational dashboard by default', () => {
    expect(
      getPostSignInRedirect(
        {
          memberships: [
            {
              id: 'membership-1',
              permissions: [],
              role: 'MANAGER',
              tenant: {
                id: 'tenant-1',
                name: 'ViewPro Demo Inmobiliaria',
                slug: 'viewpro-demo-inmobiliaria',
                status: 'ACTIVE'
              }
            }
          ]
        },
        null
      )
    ).toBe('/dashboard');
  });
});
