import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailSender } from '../email/email-sender.port';
import type { UsersRepository } from '../users/users.repository';
import type { NotificationsRepository } from './notifications.repository';
import { NotificationProducerService } from './notification-producer.service';

function makeDeps() {
	const usersRepository = {
		findById: vi.fn().mockResolvedValue({ id: 'user-1', email: 'owner@example.com' }),
	} as unknown as UsersRepository;
	const emailSender = {
		sendOwnerNotification: vi.fn().mockResolvedValue(undefined),
	} as unknown as EmailSender;
	const configService = {
		get: vi.fn().mockReturnValue('https://app.inmoview.app'),
	} as unknown as ConfigService;
	return { usersRepository, emailSender, configService };
}

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
		const { usersRepository, emailSender, configService } = makeDeps();
		service = new NotificationProducerService(repository, usersRepository, emailSender, configService);
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

describe('owner notification email (best-effort)', () => {
	function build() {
		const repository = makeRepositoryMock();
		const { usersRepository, emailSender, configService } = makeDeps();
		const service = new NotificationProducerService(
			repository,
			usersRepository,
			emailSender,
			configService,
		);
		return { service, usersRepository, emailSender };
	}

	const documentInput = {
		tenantId: 'tenant-1',
		ownerUserId: 'user-1',
		propertyEngagementId: 'eng-1',
		propertyAssetId: 'asset-abc',
		documentRequestId: 'doc-1',
		documentTitle: 'DNI frente',
	};

	it('emails the owner when a document is requested', async () => {
		const { service, emailSender } = build();

		await service.notifyDocumentRequested(documentInput);

		expect(emailSender.sendOwnerNotification).toHaveBeenCalledTimes(1);
		const payload = vi.mocked(emailSender.sendOwnerNotification).mock.calls[0]![0];
		expect(payload.to).toBe('owner@example.com');
		expect(payload.notificationType).toBe('DOCUMENT_REQUESTED');
		expect(payload.url).toContain('/owner/properties/asset-abc');
		expect(payload.url).toContain('https://app.inmoview.app');
	});

	it('does not email when the owner user is missing', async () => {
		const { service, usersRepository, emailSender } = build();
		vi.mocked(usersRepository.findById).mockResolvedValue(null);

		await service.notifyDocumentRequested(documentInput);

		expect(emailSender.sendOwnerNotification).not.toHaveBeenCalled();
	});

	it('never throws when email delivery fails (best-effort)', async () => {
		const { service, emailSender } = build();
		vi.mocked(emailSender.sendOwnerNotification).mockRejectedValue(new Error('smtp down'));

		await expect(service.notifyDocumentRequested(documentInput)).resolves.toBeUndefined();
	});
});
