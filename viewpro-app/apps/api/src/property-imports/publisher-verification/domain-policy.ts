export interface PublisherDomainPolicyInput {
  publisherEmail: string;
  userEmail: string;
  emailVerifiedAt: Date | null;
  membership: {
    tenantId: string;
    currentTenantId: string;
    role: string;
    active: boolean;
  };
}

export interface PublisherDomainPolicyResult {
  eligible: boolean;
  continueProof: boolean;
}

// Consumer mailbox providers are not evidence of an organization's domain.
const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'mail.com',
]);

function normalizedEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  // Deliberately narrow email syntax; malformed values fail closed.
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(normalized)) return null;
  const [local, domain] = normalized.split('@');
  if (!local || !domain || local.length > 64 || domain.length > 253 || domain.startsWith('.') || domain.endsWith('.')) return null;
  const localParts = local.split('.');
  if (localParts.some((part) => !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+$/i.test(part))) return null;
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((label) =>
    label.length === 0 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  )) return null;
  return domain;
}

/**
 * Pure eligibility decision only: this does not acquire trusted provider or identity provenance,
 * persist or approve a claim, nor prove provenance through caller-supplied input values.
 */
export function evaluatePublisherDomainPolicy(
  input: PublisherDomainPolicyInput,
): PublisherDomainPolicyResult {
  const publisherDomain = normalizedEmailDomain(input.publisherEmail);
  const userDomain = normalizedEmailDomain(input.userEmail);
  const eligible = Boolean(
    publisherDomain &&
    userDomain &&
    !GENERIC_EMAIL_DOMAINS.has(publisherDomain) &&
    publisherDomain === userDomain &&
    input.emailVerifiedAt instanceof Date &&
    Number.isFinite(input.emailVerifiedAt.getTime()) &&
    input.membership.active &&
    input.membership.role === 'PRINCIPAL_MANAGER' &&
    input.membership.tenantId === input.membership.currentTenantId,
  );

  // Generic/malformed/mismatched domains and ineligible identities continue through proof,
  // preserving later email-code fallback rather than rejecting the publisher claim.
  return { eligible, continueProof: !eligible };
}
