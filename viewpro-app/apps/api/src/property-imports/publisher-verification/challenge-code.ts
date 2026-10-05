import { createHmac, randomInt } from 'node:crypto'

const HMAC_VERSION = 'v1'
const CODE_PURPOSE = 'publisher-challenge-code-digest'
const RECIPIENT_PURPOSE = 'publisher-challenge-recipient-fingerprint'

export function createChallengeCode(random: (min: number, max: number) => number = randomInt): string {
  return random(0, 100_000_000).toString().padStart(8, '0')
}

export function normalizeRecipientAddress(address: string): string {
  const trimmed = address.trim()
  if (trimmed.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(trimmed)) {
    throw new Error('Invalid recipient address')
  }
  const separator = trimmed.lastIndexOf('@')
  const local = trimmed.slice(0, separator)
  const domain = trimmed.slice(separator + 1)
  const localAtoms = local.split('.')
  const labels = domain.split('.')
  const validLocal = local.length <= 64 && localAtoms.every((atom) =>
    atom.length > 0 && /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+$/i.test(atom),
  )
  const validDomain = domain.length <= 253 && labels.length >= 2 && labels.every((label) =>
    label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
  )
  if (!validLocal || !validDomain) throw new Error('Invalid recipient address')
  return `${local}@${domain.toLowerCase()}`
}

function hmac(secret: string | undefined, purpose: string, tuple: readonly string[]): string {
  const key = secret?.trim()
  if (!key || key.length < 32) throw new Error('Challenge HMAC secret is not configured securely')
  // JSON array encoding preserves tuple boundaries (unlike delimiter concatenation).
  const payload = JSON.stringify([HMAC_VERSION, purpose, ...tuple])
  const digest = createHmac('sha256', key).update(payload, 'utf8').digest('hex')
  return `${HMAC_VERSION}:${purpose}:${digest}`
}

export function createCodeDigest(
  secret: string | undefined,
  input: { tenantId: string; publisherId: string; challengeId: string; method: string; code: string },
): string {
  if (!/^\d{8}$/.test(input.code)) throw new Error('Invalid challenge code')
  return hmac(secret, CODE_PURPOSE, [input.tenantId, input.publisherId, input.challengeId, input.method, input.code])
}

export function createRecipientFingerprint(
  secret: string | undefined,
  tenantId: string,
  publisherId: string,
  address: string,
): string {
  const normalizedAddress = normalizeRecipientAddress(address)
  return hmac(secret, RECIPIENT_PURPOSE, [tenantId, publisherId, normalizedAddress])
}
