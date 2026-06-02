import { Inject, Injectable, Logger } from "@nestjs/common";
import { NotificationType } from "@prisma/client";
import {
	NOTIFICATIONS_REPOSITORY,
	type CreateOwnerNotificationInput,
	type NotificationsRepository,
} from "./notifications.repository";

export type DocumentOwnerNotificationInput = {
	tenantId: string;
	ownerUserId?: string | null;
	propertyEngagementId: string;
	propertyAssetId: string;
	documentRequestId: string;
	documentTitle: string;
};

export type DocumentUploadedInternalNotificationInput = {
	tenantId: string;
	requestedByUserId?: string | null;
	propertyEngagementId: string;
	propertyAssetId: string;
	documentRequestId: string;
	documentTitle: string;
};

@Injectable()
export class NotificationProducerService {
	private readonly logger = new Logger(NotificationProducerService.name);

	constructor(
		@Inject(NOTIFICATIONS_REPOSITORY)
		private readonly notificationsRepository: NotificationsRepository,
	) {}

	notifyDocumentRequested(
		input: DocumentOwnerNotificationInput,
	): Promise<void> {
		return this.createDocumentOwnerNotification(input, {
			type: NotificationType.DOCUMENT_REQUESTED,
			title: "Document requested",
		});
	}

	notifyDocumentApproved(
		input: DocumentOwnerNotificationInput,
	): Promise<void> {
		return this.createDocumentOwnerNotification(input, {
			type: NotificationType.DOCUMENT_APPROVED,
			title: "Document approved",
		});
	}

	notifyDocumentRejected(
		input: DocumentOwnerNotificationInput,
	): Promise<void> {
		return this.createDocumentOwnerNotification(input, {
			type: NotificationType.DOCUMENT_REJECTED,
			title: "Document rejected",
		});
	}

	async notifyDocumentUploaded(
		input: DocumentUploadedInternalNotificationInput,
	): Promise<void> {
		if (!input.requestedByUserId) {
			return;
		}

		try {
			await this.notificationsRepository.createInternal({
				tenantId: input.tenantId,
				recipientUserId: input.requestedByUserId,
				type: NotificationType.DOCUMENT_UPLOADED,
				title: "Document uploaded",
				body: input.documentTitle,
				linkHref: `/dashboard/product/${input.propertyEngagementId}`,
				propertyEngagementId: input.propertyEngagementId,
				propertyAssetId: input.propertyAssetId,
				documentRequestId: input.documentRequestId,
			});
		} catch (error) {
			this.logger.warn(
				`Failed to create ${NotificationType.DOCUMENT_UPLOADED} internal notification: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	private async createDocumentOwnerNotification(
		input: DocumentOwnerNotificationInput,
		config: Pick<CreateOwnerNotificationInput, "type" | "title">,
	): Promise<void> {
		if (!input.ownerUserId) {
			return;
		}

		try {
			await this.notificationsRepository.createOwner({
				tenantId: input.tenantId,
				recipientUserId: input.ownerUserId,
				type: config.type,
				title: config.title,
				body: input.documentTitle,
				linkHref: `/owner/properties/${input.propertyAssetId}`,
				propertyEngagementId: input.propertyEngagementId,
				propertyAssetId: input.propertyAssetId,
				documentRequestId: input.documentRequestId,
			});
		} catch (error) {
			this.logger.warn(
				`Failed to create ${config.type} owner notification: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
}
