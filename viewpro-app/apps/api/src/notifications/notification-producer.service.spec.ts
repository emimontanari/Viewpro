import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationsRepository } from './notifications.repository';
import { NotificationProducerService } from './notification-producer.service';

// ---------------------------------------------------------------------------
// Minimal repository mock
// ---------------------------------------------------------------------------
function makeRepositoryMock(): NotificationsRepository {
	return {
		createOwner: vi.fn().mockResolvedValue(undefined),
		createInternal: vi.fn().mockResolvedValue(undefined),
		findManyByRecipient: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 }),
		markAsRead: vi.fn().mockResolvedValue(undefined),
		countUnread: vi.fn().mockResolvedValue(0),
	} as unknown as NotificationsRepository;
}

// ---------------------------------------------------------------------------
// notifyPropertyStatusChanged — linkHref shape (S-P1, S-P2, S-P3, S-P4)
// ---------------------------------------------------------------------------
describe('notifyPropertyStatusChanged — linkHref shape (24.6c)', () => {
	let repository: NotificationsRepository;
	let service: NotificationProducerService;

	beforeEach(() => {
		repository = makeRepositoryMock();
		service = new NotificationProducerService(repository);
	});

	// S-P1 — FR-P1/FR-P2: exact deep-link linkHref shape
	it('S-P1: emits linkHref = /owner/properties/{assetId}?tab=tracking&movement={movementId}', async () => {
		await service.notifyPropertyStatusChanged({
			tenantId: 'tenant-1',
			ownerUserIds: ['user-1'],
			propertyEngagementId: 'eng-1',
			propertyAssetId: 'asset-abc',
			movementId: 'mov-123',
			newStatus: 'ACTIVE_PUBLICATION',
		});

		expect(vi.mocked(repository.createOwner)).toHaveBeenCalledWith(
			expect.objectContaining({
				linkHref: '/owner/properties/asset-abc?tab=tracking&movement=mov-123',
			}),
		);
	});

	// S-P2 — FR-P2: exact shape — tab before movement, no trailing slash, no extra params
	it('S-P2: linkHref is exactly tab=tracking&movement={id} (no extra params, correct order)', async () => {
		await service.notifyPropertyStatusChanged({
			tenantId: 'tenant-1',
			ownerUserIds: ['user-1'],
			propertyEngagementId: 'eng-1',
			propertyAssetId: 'asset-xyz',
			movementId: 'mov-456',
			newStatus: 'OFFER_NEGOTIATION',
		});

		const call = vi.mocked(repository.createOwner).mock.calls[0]![0];
		expect(call.linkHref).toBe(
			'/owner/properties/asset-xyz?tab=tracking&movement=mov-456',
		);
		expect(call.linkHref).not.toContain('doc=');
		expect(call.linkHref).not.toMatch(/\/$|&$|\?$/);
	});

	// S-P3 — FR-P4: all fanned-out recipients receive the SAME linkHref
	it('S-P3: all fanned-out recipients receive identical linkHref', async () => {
		await service.notifyPropertyStatusChanged({
			tenantId: 'tenant-1',
			ownerUserIds: ['user-1', 'user-2', 'user-3'],
			propertyEngagementId: 'eng-1',
			propertyAssetId: 'asset-abc',
			movementId: 'mov-789',
			newStatus: 'INQUIRIES_AND_VISITS',
		});

		const calls = vi.mocked(repository.createOwner).mock.calls;
		expect(calls).toHaveLength(3);
		const linkHrefs = calls.map((c) => c[0]!.linkHref);
		expect(new Set(linkHrefs).size).toBe(1);
		expect(linkHrefs[0]).toBe('/owner/properties/asset-abc?tab=tracking&movement=mov-789');
	});
});
