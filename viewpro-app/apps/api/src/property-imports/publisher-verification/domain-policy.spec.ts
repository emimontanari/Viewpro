import { describe, expect, it } from 'vitest';
import { evaluatePublisherDomainPolicy } from './domain-policy';

const base = {
  publisherEmail: 'agent@agency.example',
  userEmail: 'MANAGER@AGENCY.EXAMPLE',
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  membership: { tenantId: 'tenant-1', currentTenantId: 'tenant-1', role: 'PRINCIPAL_MANAGER', active: true },
};

describe('evaluatePublisherDomainPolicy', () => {
  it('allows only an exact normalized non-generic domain match', () => {
    expect(evaluatePublisherDomainPolicy(base)).toEqual({ eligible: true, continueProof: false });
    expect(evaluatePublisherDomainPolicy({ ...base, publisherEmail: 'agent@agency.example.evil' }))
      .toEqual({ eligible: false, continueProof: true });
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
    expect(evaluatePublisherDomainPolicy({ ...base, publisherEmail }))
      .toEqual({ eligible: false, continueProof: true });
  });

  it.each(['agent@gmail.com', 'agent@outlook.com', 'agent@yahoo.com'])('continues proof for generic domain %s', (publisherEmail) => {
    expect(evaluatePublisherDomainPolicy({ ...base, publisherEmail, userEmail: 'manager@gmail.com' }))
      .toEqual({ eligible: false, continueProof: true });
  });

  it.each([
    ['agent@gmail.com', 'manager@gmail.com'],
    ['agent@outlook.com', 'manager@outlook.com'],
    ['agent@yahoo.com', 'manager@yahoo.com'],
  ])('continues proof when both emails match generic domain %s', (publisherEmail, userEmail) => {
    expect(evaluatePublisherDomainPolicy({ ...base, publisherEmail, userEmail }))
      .toEqual({ eligible: false, continueProof: true });
  });

  it.each([
    { emailVerifiedAt: null },
    { membership: { ...base.membership, active: false } },
    { membership: { ...base.membership, role: 'MANAGER' } },
    { membership: { ...base.membership, currentTenantId: 'tenant-2' } },
    { userEmail: 'manager@other.example' },
  ])('continues proof unless all identity and membership requirements hold', (override) => {
    expect(evaluatePublisherDomainPolicy({ ...base, ...override }))
      .toEqual({ eligible: false, continueProof: true });
  });
});
