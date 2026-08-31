import { describe, expect, it } from 'vitest';
import {
  DUAL_CONTEXT_CHOOSER_PATH,
  getPostSignInRedirect,
  getSafeSignInRedirect
} from './sign-in-view';

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

describe('getPostSignInRedirect for a dual-context identity', () => {
  const dual = { memberships: [{ id: 'm-1' }] as never, hasOwnerAccess: true };
  const sellerOnly = { memberships: [{ id: 'm-1' }] as never, hasOwnerAccess: false };
  const ownerOnly = { memberships: [], hasOwnerAccess: true };

  it('offers the chooser when the identity holds both contexts', () => {
    // #326: routing considered memberships first, so any membership kept the
    // /dashboard default and the owner portal was never offered — the dashboard
    // sidebar carries no link to it either.
    expect(getPostSignInRedirect(dual, null)).toBe(DUAL_CONTEXT_CHOOSER_PATH);
  });

  it('sends a seller-only identity straight to the dashboard', () => {
    expect(getPostSignInRedirect(sellerOnly, null)).toBe('/dashboard');
  });

  it('sends an owner-only identity straight to the owner portal', () => {
    expect(getPostSignInRedirect(ownerOnly, null)).toBe('/owner');
  });

  it('honours an explicit destination inside a context the identity holds', () => {
    // Someone following a link to a specific property should land on it, not be
    // stopped to answer a question they already answered by clicking.
    expect(getPostSignInRedirect(dual, '/owner/properties/p-1')).toBe('/owner/properties/p-1');
    expect(getPostSignInRedirect(dual, '/dashboard/product')).toBe('/dashboard/product');
  });

  it('does not let an external or protocol-relative redirect skip the chooser', () => {
    // Criterion 6: a redirect must not silently bypass the required choice.
    for (const hostile of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)']) {
      expect(getPostSignInRedirect(dual, hostile)).toBe(DUAL_CONTEXT_CHOOSER_PATH);
    }
  });

  it('honours an explicit owner destination for an owner-only identity', () => {
    expect(getPostSignInRedirect(ownerOnly, '/owner/properties/p-1')).toBe(
      '/owner/properties/p-1'
    );
  });

  it('never returns the chooser for an identity that has only one context', () => {
    // A chooser with one option is a dead click.
    expect(getPostSignInRedirect(sellerOnly, null)).not.toBe(DUAL_CONTEXT_CHOOSER_PATH);
    expect(getPostSignInRedirect(ownerOnly, null)).not.toBe(DUAL_CONTEXT_CHOOSER_PATH);
    expect(getPostSignInRedirect({ memberships: [], hasOwnerAccess: false }, null)).not.toBe(
      DUAL_CONTEXT_CHOOSER_PATH
    );
  });
});

