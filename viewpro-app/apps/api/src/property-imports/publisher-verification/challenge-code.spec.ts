import { describe, expect, it } from 'vitest'
import {
  createChallengeCode,
  createCodeDigest,
  createRecipientFingerprint,
  normalizeRecipientAddress,
} from './challenge-code'

const secret = 'a-secure-test-secret-that-is-at-least-32-chars'

 describe('publisher challenge code primitives', () => {
  it('requests the full eight-digit range and preserves leading zeroes', () => {
    let bounds: [number, number] | undefined
    expect(createChallengeCode((min, max) => {
      bounds = [min, max]
      return 7
    })).toBe('00000007')
    expect(bounds).toEqual([0, 100_000_000])
  })

  it('returns eight-digit codes with its default generator', () => {
    expect(createChallengeCode()).toMatch(/^\d{8}$/)
  })

  it('derives deterministic versioned HMACs with separate purposes and unambiguous tuples', () => {
    const input = { tenantId: 'tenant', publisherId: 'publisher', challengeId: 'challenge', method: 'EMAIL', code: '00000007' }
    const digest = createCodeDigest(secret, input)
    expect(digest).toMatch(/^v1:[a-z0-9_-]+:[a-f0-9]{64}$/)
    expect(createCodeDigest(secret, input)).toBe(digest)
    expect(createCodeDigest(secret, { ...input, challengeId: 'other' })).not.toBe(digest)
    expect(createCodeDigest(secret, { ...input, method: 'LISTING' })).not.toBe(digest)
    expect(createCodeDigest(secret, { ...input, tenantId: 'tenant|publisher' })).not.toBe(
      createCodeDigest(secret, { ...input, tenantId: 'tenant', publisherId: 'publisher|publisher' }),
    )
    expect(createRecipientFingerprint(secret, 'tenant', 'publisher', 'Agent@EXAMPLE.COM'))
      .not.toBe(digest)
  })

  it('keeps recipient scope stable across claims and methods but separates tenant, publisher and address', () => {
    const fingerprint = createRecipientFingerprint(secret, 'tenant', 'publisher', 'Agent@EXAMPLE.COM')
    expect(createRecipientFingerprint(secret, 'tenant', 'publisher', 'Agent@example.com')).toBe(fingerprint)
    expect(createRecipientFingerprint(secret, 'tenant', 'other', 'Agent@example.com')).not.toBe(fingerprint)
    expect(createRecipientFingerprint(secret, 'other', 'publisher', 'Agent@example.com')).not.toBe(fingerprint)
    expect(createRecipientFingerprint(secret, 'tenant', 'publisher', 'agent@example.com')).not.toBe(fingerprint)
  })

  it('trims outer whitespace, preserves local-part case, and lowercases only the domain', () => {
    expect(normalizeRecipientAddress('  Agent+tag@EXAMPLE.COM  ')).toBe('Agent+tag@example.com')
  })

  it.each(['bad-address', 'a@@example.com', '@example.com', 'a..b@example.com', 'a@localhost', 'a b@example.com'])('rejects malformed addresses without reflecting the input', (address) => {
    expect(() => normalizeRecipientAddress(address)).toThrow('Invalid recipient address')
  })

  it.each([undefined, '', '   ', 'short-secret'])('fails closed for missing or weak secrets', (weakSecret) => {
    expect(() => createRecipientFingerprint(weakSecret, 'tenant', 'publisher', 'a@example.com')).toThrow('Challenge HMAC secret is not configured securely')
  })

  it('measures secret strength after trimming', () => {
    expect(() => createRecipientFingerprint(` ${'x'.repeat(31)} `, 'tenant', 'publisher', 'a@example.com')).toThrow('Challenge HMAC secret is not configured securely')
    expect(createRecipientFingerprint(` ${'x'.repeat(32)} `, 'tenant', 'publisher', 'a@example.com')).toMatch(/^v1:/)
  })
})
