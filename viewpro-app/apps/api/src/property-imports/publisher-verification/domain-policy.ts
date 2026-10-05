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

export interface PublisherDomainSignalResult {
  domainMatch: boolean;
  proofRequired: true;
}

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
 * Domain equality is context only, never claim proof. Inputs must be supplied from trusted
 * provider-published contact and current verified identity/membership sources by a future caller.
 */
export function evaluatePublisherDomainSignal(
  input: PublisherDomainPolicyInput,
): PublisherDomainSignalResult {
  const publisherDomain = normalizedEmailDomain(input.publisherEmail);
  const userDomain = normalizedEmailDomain(input.userEmail);
  const domainMatch = Boolean(
    publisherDomain &&
    userDomain &&
    publisherDomain === userDomain &&
    input.emailVerifiedAt instanceof Date &&
    Number.isFinite(input.emailVerifiedAt.getTime()) &&
    input.membership.active &&
    input.membership.role === 'PRINCIPAL_MANAGER' &&
    input.membership.tenantId === input.membership.currentTenantId,
  );
  return { domainMatch, proofRequired: true };
}
