import { NotificationType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { NotificationProducerService } from "../src/notifications/notification-producer.service";
import type { NotificationsRepository } from "../src/notifications/notifications.repository";

describe("NotificationProducerService", () => {
	it("creates an OWNER notification when a document is requested for a linked owner", async () => {
		const repository = makeRepository();
		const producer = new NotificationProducerService(repository);

		await producer.notifyDocumentRequested(makeDocumentNotificationInput());

		expect(repository.createOwner).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			recipientUserId: "owner-1",
			type: NotificationType.DOCUMENT_REQUESTED,
			title: "Document requested",
			body: "Property deed",
			linkHref: "/owner/properties/property-1",
			propertyEngagementId: "engagement-1",
			propertyAssetId: "property-1",
			documentRequestId: "request-1",
		});
	});

	it("creates OWNER notifications for document approval and rejection", async () => {
		const repository = makeRepository();
		const producer = new NotificationProducerService(repository);
		const input = makeDocumentNotificationInput();

		await producer.notifyDocumentApproved(input);
		await producer.notifyDocumentRejected(input);

		expect(repository.createOwner).toHaveBeenNthCalledWith(1, {
			tenantId: "tenant-1",
			recipientUserId: "owner-1",
			type: NotificationType.DOCUMENT_APPROVED,
			title: "Document approved",
			body: "Property deed",
			linkHref: "/owner/properties/property-1",
			propertyEngagementId: "engagement-1",
			propertyAssetId: "property-1",
			documentRequestId: "request-1",
		});
		expect(repository.createOwner).toHaveBeenNthCalledWith(2, {
			tenantId: "tenant-1",
			recipientUserId: "owner-1",
			type: NotificationType.DOCUMENT_REJECTED,
			title: "Document rejected",
			body: "Property deed",
			linkHref: "/owner/properties/property-1",
			propertyEngagementId: "engagement-1",
			propertyAssetId: "property-1",
			documentRequestId: "request-1",
		});
	});

	it("does not create owner notifications when the request has no linked owner user", async () => {
		const repository = makeRepository();
		const producer = new NotificationProducerService(repository);

		await producer.notifyDocumentRequested(
			makeDocumentNotificationInput({ ownerUserId: null }),
		);

		expect(repository.createOwner).not.toHaveBeenCalled();
	});

	it("creates an INTERNAL notification when an owner uploads a requested document", async () => {
		const repository = makeRepository();
		const producer = new NotificationProducerService(repository);

		await producer.notifyDocumentUploaded(
			makeDocumentUploadNotificationInput(),
		);

		expect(repository.createInternal).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			recipientUserId: "agent-1",
			type: NotificationType.DOCUMENT_UPLOADED,
			title: "Document uploaded",
			body: "Property deed",
			linkHref: "/dashboard/product/engagement-1",
			propertyEngagementId: "engagement-1",
			propertyAssetId: "property-1",
			documentRequestId: "request-1",
		});
		expect(repository.createOwner).not.toHaveBeenCalled();
	});

	it("does not create internal upload notifications without a requester", async () => {
		const repository = makeRepository();
		const producer = new NotificationProducerService(repository);

		await producer.notifyDocumentUploaded(
			makeDocumentUploadNotificationInput({ requestedByUserId: null }),
		);

		expect(repository.createInternal).not.toHaveBeenCalled();
		expect(repository.createOwner).not.toHaveBeenCalled();
	});

	it("swallows repository errors", async () => {
		const repository = makeRepository({
			createOwner: vi
				.fn()
				.mockRejectedValue(new Error("notifications unavailable")),
			createInternal: vi
				.fn()
				.mockRejectedValue(new Error("internal notifications unavailable")),
		});
		const producer = new NotificationProducerService(repository);

		await expect(
			producer.notifyDocumentRequested(makeDocumentNotificationInput()),
		).resolves.toBeUndefined();
		await expect(
			producer.notifyDocumentUploaded(makeDocumentUploadNotificationInput()),
		).resolves.toBeUndefined();
	});
});

function makeRepository(
	overrides: Partial<NotificationsRepository> = {},
): NotificationsRepository {
	return {
		createInternal: vi.fn(),
		createOwner: vi.fn().mockResolvedValue({}),
		listInternalForRecipient: vi.fn(),
		countUnreadInternalForRecipient: vi.fn(),
		markInternalRead: vi.fn(),
		markAllInternalRead: vi.fn(),
		listOwnerForRecipient: vi.fn(),
		countUnreadOwnerForRecipient: vi.fn(),
		markOwnerRead: vi.fn(),
		markAllOwnerRead: vi.fn(),
		...overrides,
	} as NotificationsRepository;
}

function makeDocumentNotificationInput(
	overrides: Partial<
		Parameters<NotificationProducerService["notifyDocumentRequested"]>[0]
	> = {},
): Parameters<NotificationProducerService["notifyDocumentRequested"]>[0] {
	return {
		tenantId: "tenant-1",
		ownerUserId: "owner-1",
		propertyEngagementId: "engagement-1",
		propertyAssetId: "property-1",
		documentRequestId: "request-1",
		documentTitle: "Property deed",
		...overrides,
	};
}

type DocumentUploadNotificationInput = {
	tenantId: string;
	requestedByUserId?: string | null;
	propertyEngagementId: string;
	propertyAssetId: string;
	documentRequestId: string;
	documentTitle: string;
};

function makeDocumentUploadNotificationInput(
	overrides: Partial<DocumentUploadNotificationInput> = {},
): DocumentUploadNotificationInput {
	return {
		tenantId: "tenant-1",
		requestedByUserId: "agent-1",
		propertyEngagementId: "engagement-1",
		propertyAssetId: "property-1",
		documentRequestId: "request-1",
		documentTitle: "Property deed",
		...overrides,
	};
}
