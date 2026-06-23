import { Inject, Injectable, Logger } from "@nestjs/common";
import { NotificationType, type PropertyEngagementStatus } from "@prisma/client";
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

export type PropertyStatusChangedOwnerNotificationInput = {
	tenantId: string;
	ownerUserIds: string[];
	propertyEngagementId: string;
	propertyAssetId: string;
	movementId: string;
	previousStatus?: PropertyEngagementStatus | null;
	newStatus: PropertyEngagementStatus;
};

export type StatusChangeRequestedNotificationInput = {
	tenantId: string;
	/** Resolved manager userIds (requester already excluded by caller). */
	recipientUserIds: string[];
	propertyEngagementId: string;
	targetStatus: string;
	requestedByUserId: string;
};

export type StatusChangeApprovedNotificationInput = {
	tenantId: string;
	/** Original requesting seller. */
	recipientUserId: string;
	propertyEngagementId: string;
	targetStatus: string;
};

export type StatusChangeRejectedNotificationInput = {
	tenantId: string;
	/** Original requesting seller. */
	recipientUserId: string;
	propertyEngagementId: string;
	resolutionComment: string;
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

	async notifyPropertyStatusChanged(
		input: PropertyStatusChangedOwnerNotificationInput,
	): Promise<void> {
		const recipientUserIds = [...new Set(input.ownerUserIds.filter(Boolean))];

		if (recipientUserIds.length === 0) {
			return;
		}

		try {
			await Promise.all(
				recipientUserIds.map((recipientUserId) =>
					this.notificationsRepository.createOwner({
						tenantId: input.tenantId,
						recipientUserId,
						type: NotificationType.PROPERTY_STATUS_CHANGED,
						title: "Property status updated",
						body: formatStatusChangeBody(input.previousStatus, input.newStatus),
						linkHref: `/owner/properties/${input.propertyAssetId}`,
						propertyEngagementId: input.propertyEngagementId,
						propertyAssetId: input.propertyAssetId,
						movementId: input.movementId,
					}),
				),
			);
		} catch (error) {
			this.logger.warn(
				`Failed to create ${NotificationType.PROPERTY_STATUS_CHANGED} owner notification: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Notifies all active managers in the tenant when a seller creates a
	 * status change request (FR-26). Requester must already be excluded from
	 * `recipientUserIds` by the caller (design §Producer call sites, issue #7).
	 */
	async notifyStatusChangeRequested(
		input: StatusChangeRequestedNotificationInput,
	): Promise<void> {
		const uniqueRecipients = [...new Set(input.recipientUserIds)].filter(Boolean);
		if (uniqueRecipients.length === 0) {
			return;
		}

		try {
			await Promise.all(
				uniqueRecipients.map((recipientUserId) =>
					this.notificationsRepository.createInternal({
						tenantId: input.tenantId,
						recipientUserId,
						type: NotificationType.STATUS_CHANGE_REQUESTED,
						title: "New status change request",
						body: `Requested status: ${input.targetStatus}`,
						linkHref: "/dashboard/status-change-requests",
						propertyEngagementId: input.propertyEngagementId,
					}),
				),
			);
		} catch (error) {
			this.logger.warn(
				`Failed to create ${NotificationType.STATUS_CHANGE_REQUESTED} notification: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Notifies the original requesting seller when their request is approved
	 * (FR-27). Called after the approval transaction commits (FR-30).
	 */
	async notifyStatusChangeApproved(
		input: StatusChangeApprovedNotificationInput,
	): Promise<void> {
		try {
			await this.notificationsRepository.createInternal({
				tenantId: input.tenantId,
				recipientUserId: input.recipientUserId,
				type: NotificationType.STATUS_CHANGE_APPROVED,
				title: "Status change approved",
				body: `Your status change to ${input.targetStatus} has been approved.`,
				linkHref: `/dashboard/product/${input.propertyEngagementId}`,
				propertyEngagementId: input.propertyEngagementId,
			});
		} catch (error) {
			this.logger.warn(
				`Failed to create ${NotificationType.STATUS_CHANGE_APPROVED} notification: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Notifies the original requesting seller when their request is rejected,
	 * including the manager's resolution comment in the body (FR-28).
	 * Called after the rejection transaction commits (FR-30).
	 */
	async notifyStatusChangeRejected(
		input: StatusChangeRejectedNotificationInput,
	): Promise<void> {
		try {
			await this.notificationsRepository.createInternal({
				tenantId: input.tenantId,
				recipientUserId: input.recipientUserId,
				type: NotificationType.STATUS_CHANGE_REJECTED,
				title: "Status change rejected",
				body: input.resolutionComment,
				linkHref: `/dashboard/product/${input.propertyEngagementId}`,
				propertyEngagementId: input.propertyEngagementId,
			});
		} catch (error) {
			this.logger.warn(
				`Failed to create ${NotificationType.STATUS_CHANGE_REJECTED} notification: ${
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
				linkHref: `/owner/properties/${input.propertyAssetId}?tab=documents&doc=${input.documentRequestId}`,
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

function formatStatusChangeBody(
	previousStatus: PropertyEngagementStatus | null | undefined,
	newStatus: PropertyEngagementStatus,
) {
	const newStatusLabel = formatStatusLabel(newStatus);

	if (!previousStatus) {
		return `Status changed to ${newStatusLabel}`;
	}

	return `${formatStatusLabel(previousStatus)} → ${newStatusLabel}`;
}

function formatStatusLabel(status: PropertyEngagementStatus) {
	const lowerCaseLabel = status.replaceAll("_", " ").toLowerCase();

	return lowerCaseLabel.charAt(0).toUpperCase() + lowerCaseLabel.slice(1);
}
