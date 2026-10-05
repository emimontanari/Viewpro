import { describe, expect, it } from 'vitest';
import { evaluatePublisherDomainSignal } from './domain-policy';

const base = {
  publisherEmail: 'agent@agency.example',
  userEmail: 'MANAGER@AGENCY.EXAMPLE',
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  membership: { tenantId: 'tenant-1', currentTenantId: 'tenant-1', role: 'PRINCIPAL_MANAGER', active: true },
};

describe('evaluatePublisherDomainSignal', () => {
  it('signals an exact normalized domain match but always requires proof', () => {
    expect(evaluatePublisherDomainSignal(base)).toEqual({ domainMatch: true, proofRequired: true });
    expect(evaluatePublisherDomainSignal({ ...base, publisherEmail: 'agent@agency.example.evil' }))
      .toEqual({ domainMatch: false, proofRequired: true });
  });

  it.each([
    'bad-email',
    'agent@',
    '@agency.example',
    'agent@@agency.example',
    'a..b@agency.example',
    '.a@agency.example',
    'a>@agency.example',
  ])('fails closed for malformed publisher email %s', (publisherEmail) => {
    expect(evaluatePublisherDomainSignal({ ...base, publisherEmail }))
      .toEqual({ domainMatch: false, proofRequired: true });
  });

  it.each([
    ['agent@gmail.com', 'manager@gmail.com'],
    ['agent@fastmail.com', 'manager@fastmail.com'],
    ['agent@zoho.com', 'manager@zoho.com'],
  ])('signals matching public domain %s but still requires proof', (publisherEmail, userEmail) => {
    expect(evaluatePublisherDomainSignal({ ...base, publisherEmail, userEmail }))
      .toEqual({ domainMatch: true, proofRequired: true });
  });

  it.each([
    { emailVerifiedAt: null },
    { membership: { ...base.membership, active: false } },
    { membership: { ...base.membership, role: 'MANAGER' } },
    { membership: { ...base.membership, currentTenantId: 'tenant-2' } },
    { userEmail: 'manager@other.example' },
  ])('continues proof unless all identity and membership requirements hold', (override) => {
    expect(evaluatePublisherDomainSignal({ ...base, ...override }))
      .toEqual({ domainMatch: false, proofRequired: true });
  });
});
