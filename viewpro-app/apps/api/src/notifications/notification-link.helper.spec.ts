import { describe, expect, it } from 'vitest';
import { sanitizeOwnerNotificationLink } from './notification-link.helper';

const ASSET_ID = 'asset-abc';
const call = (linkHref: unknown) =>
	sanitizeOwnerNotificationLink({
		linkHref: linkHref as string | null | undefined,
		propertyAssetId: ASSET_ID,
	});

// ---------------------------------------------------------------------------
// Acceptance cases — S-S1..S-S4
// ---------------------------------------------------------------------------
describe('sanitizeOwnerNotificationLink — acceptance cases', () => {
	// S-S1 — FR-S2 regression guard: /owner root
	it('S-S1: returns /owner unchanged (regression guard)', () => {
		expect(call('/owner')).toBe('/owner');
	});

	// S-S2 — FR-S3 regression guard: param-less property path
	it('S-S2: returns param-less /owner/properties/{assetId} unchanged (regression guard)', () => {
		expect(call('/owner/properties/asset-abc')).toBe('/owner/properties/asset-abc');
	});

	// S-S3 — FR-S4 core new acceptance case: full deep-link
	it('S-S3: accepts full deep-link ?tab=documents&doc=req-123', () => {
		expect(call('/owner/properties/asset-abc?tab=documents&doc=req-123')).toBe(
			'/owner/properties/asset-abc?tab=documents&doc=req-123',
		);
	});

	// S-S4 — FR-S4 param-order must NOT matter
	it('S-S4: accepts deep-link with doc and tab in reversed order', () => {
		const result = call('/owner/properties/asset-abc?doc=req-123&tab=documents');
		expect(result).not.toBeNull();
		expect(result).toContain('tab=documents');
		expect(result).toContain('doc=req-123');
	});
});

// ---------------------------------------------------------------------------
// Rejection cases — S-S5..S-S16, fragment, duplicate doc
// ---------------------------------------------------------------------------
describe('sanitizeOwnerNotificationLink — rejection cases (SECURITY-CRITICAL)', () => {
	// S-S5 — FR-S5: unknown param → null
	it('S-S5: rejects unknown param (evil=x) → null', () => {
		expect(call('/owner/properties/asset-abc?tab=documents&doc=req-123&evil=x')).toBeNull();
	});

	// S-S6 — FR-S5: open redirect param → null
	it('S-S6: rejects redirect param → null', () => {
		expect(call('/owner/properties/asset-abc?redirect=http://evil.com')).toBeNull();
	});

	// S-S7 — FR-S6: wrong tab value → null
	it('S-S7: rejects tab=tracking with doc → null', () => {
		expect(call('/owner/properties/asset-abc?tab=tracking&doc=req-123')).toBeNull();
	});

	// S-S8 — FR-S10: doc alone (no tab) → null
	it('S-S8: rejects doc alone without tab → null', () => {
		expect(call('/owner/properties/asset-abc?doc=req-123')).toBeNull();
	});

	// S-S9 — FR-S7: protocol-relative → null
	it('S-S9: rejects protocol-relative URL → null', () => {
		expect(call('//evil.example.com/owner/properties/asset-abc')).toBeNull();
	});

	// S-S10 — FR-S7: absolute URL → null
	it('S-S10: rejects absolute URL with scheme → null', () => {
		expect(call('https://evil.example.com/owner/properties/asset-abc')).toBeNull();
	});

	// S-S11 — FR-S8: non-owner pathname → null
	it('S-S11: rejects /dashboard/product/engagement-id → null', () => {
		expect(call('/dashboard/product/engagement-id')).toBeNull();
	});

	// S-S12 — FR-S9: empty assetId segment → null
	it('S-S12: rejects /owner/properties/ (empty assetId) → null', () => {
		expect(call('/owner/properties/')).toBeNull();
	});

	// S-S13 — FR-S9: path traversal → null
	it('S-S13: rejects /owner/properties/../etc/passwd → null', () => {
		expect(call('/owner/properties/../etc/passwd')).toBeNull();
	});

	// S-S14 — empty string → null
	it('S-S14: rejects empty string → null', () => {
		expect(call('')).toBeNull();
	});

	// S-S15 (null) — null input → null (no throw)
	it('S-S15 (null): returns null for null input without throwing', () => {
		expect(call(null)).toBeNull();
	});

	// S-S15 (undefined) — undefined input → null (no throw)
	it('S-S15 (undefined): returns null for undefined input without throwing', () => {
		expect(call(undefined)).toBeNull();
	});

	// S-S16 — FR-S10: tab alone (without doc) → null
	it('S-S16: rejects ?tab=documents alone (without doc) → null', () => {
		expect(call('/owner/properties/asset-abc?tab=documents')).toBeNull();
	});

	// FR-S10 / D1 step 5 — empty doc value → null (doc= present but blank)
	it('rejects ?tab=documents&doc= (empty doc value) → null', () => {
		expect(call('/owner/properties/asset-abc?tab=documents&doc=')).toBeNull();
	});

	// Fragment rejection — D1 step 6
	it('rejects any URL fragment → null', () => {
		expect(call('/owner/properties/asset-abc?tab=documents&doc=req-123#evil')).toBeNull();
	});

	// Duplicate doc param — D1 step 5
	it('rejects duplicate doc param → null', () => {
		expect(
			call('/owner/properties/asset-abc?tab=documents&doc=req-123&doc=req-456'),
		).toBeNull();
	});

	// Tampered assetId in link — D1 step 4
	it('rejects tampered assetId (OTHER-ASSET) when propertyAssetId is asset-abc → null', () => {
		expect(
			sanitizeOwnerNotificationLink({
				linkHref: '/owner/properties/OTHER-ASSET?tab=documents&doc=req-123',
				propertyAssetId: 'asset-abc',
			}),
		).toBeNull();
	});
});
