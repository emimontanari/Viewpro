import { Inject, Injectable } from "@nestjs/common";
import type { OwnerInvitation, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { normalizeEmail } from "../auth/utils/slugify";
import type {
	AcceptExistingOwnerInvitationInput,
	AcceptOwnerInvitationInput,
	AcceptOwnerInvitationResult,
	OwnerInvitationDetails,
	OwnerInvitationsRepository,
} from "./owner-invitations.repository";

const ownerInvitationSelect = {
	id: true,
	propertyAssetOwnerId: true,
	email: true,
	status: true,
	expiresAt: true,
	acceptedAt: true,
	revokedAt: true,
	propertyAssetOwner: {
		select: {
			id: true,
			ownerEmail: true,
			ownerFirstName: true,
			ownerLastName: true,
			accessStatus: true,
			userId: true,
			propertyAsset: {
				select: {
					id: true,
					title: true,
					addressLine: true,
					city: true,
					province: true,
				},
			},
		},
	},
} satisfies Prisma.OwnerInvitationSelect;

type SelectedOwnerInvitation = Prisma.OwnerInvitationGetPayload<{
	select: typeof ownerInvitationSelect;
}>;

@Injectable()
export class PrismaOwnerInvitationsRepository
	implements OwnerInvitationsRepository
{
	constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

	async findByTokenHash(
		tokenHash: string,
	): Promise<OwnerInvitationDetails | null> {
		const invitation = await this.prisma.ownerInvitation.findUnique({
			where: { tokenHash },
			select: ownerInvitationSelect,
		});

		if (!invitation) {
			return null;
		}

		return this.withEmailRegistered(invitation);
	}

	findUserByEmail(email: string) {
		return this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
	}

	acceptForNewOwner(
		input: AcceptOwnerInvitationInput,
	): Promise<AcceptOwnerInvitationResult> {
		return this.prisma.$transaction(async (tx) => {
			const invitation = await tx.ownerInvitation.findUnique({
				where: { tokenHash: input.tokenHash },
				include: { propertyAssetOwner: true },
			});

			if (!invitation) {
				return { status: "notFound" };
			}

			const availability = mapInvitationAvailability(invitation, input.now);
			if (availability !== "available") {
				return { status: availability };
			}

			const existingUser = await tx.user.findUnique({
				where: { email: invitation.email },
			});

			if (existingUser) {
				return { status: "userAlreadyExists" };
			}

			const updatedInvitation = await markInvitationAccepted(
				tx,
				invitation.id,
				input.now,
			);
			if (updatedInvitation.status !== "accepted") {
				return updatedInvitation;
			}

			const user = await tx.user.create({
				data: {
					email: invitation.email,
					passwordHash: input.passwordHash,
					firstName: input.firstName,
					lastName: input.lastName ?? null,
				},
			});

			await tx.propertyAssetOwner.update({
				where: { id: invitation.propertyAssetOwnerId },
				data: {
					userId: user.id,
					accessStatus: "ACTIVE",
				},
			});

			return { status: "accepted", user };
		});
	}

	acceptForExistingOwner(
		input: AcceptExistingOwnerInvitationInput,
	): Promise<AcceptOwnerInvitationResult> {
		return this.prisma.$transaction(async (tx) => {
			const invitation = await tx.ownerInvitation.findUnique({
				where: { tokenHash: input.tokenHash },
				include: { propertyAssetOwner: true },
			});

			if (!invitation) {
				return { status: "notFound" };
			}

			const availability = mapInvitationAvailability(invitation, input.now);
			if (availability !== "available") {
				return { status: availability };
			}

			const user = await tx.user.findUnique({ where: { id: input.userId } });
			if (!user) {
				return { status: "notFound" };
			}

			if (
				normalizeEmail(user.email) !== normalizeEmail(invitation.email) ||
				normalizeEmail(invitation.propertyAssetOwner.ownerEmail) !==
					normalizeEmail(invitation.email)
			) {
				return { status: "emailMismatch" };
			}

			if (
				invitation.propertyAssetOwner.userId &&
				invitation.propertyAssetOwner.userId !== user.id
			) {
				return { status: "emailMismatch" };
			}

			const updatedInvitation = await markInvitationAccepted(
				tx,
				invitation.id,
				input.now,
			);
			if (updatedInvitation.status !== "accepted") {
				return updatedInvitation;
			}

			await tx.propertyAssetOwner.update({
				where: { id: invitation.propertyAssetOwnerId },
				data: {
					userId: user.id,
					accessStatus: "ACTIVE",
				},
			});

			return { status: "accepted", user };
		});
	}

	private async withEmailRegistered(
		invitation: SelectedOwnerInvitation,
	): Promise<OwnerInvitationDetails> {
		const existingUser = await this.prisma.user.findUnique({
			where: { email: normalizeEmail(invitation.email) },
			select: { id: true },
		});

		return { ...invitation, emailRegistered: Boolean(existingUser) };
	}
}

function mapInvitationAvailability(
	invitation: Pick<
		OwnerInvitation,
		"status" | "acceptedAt" | "revokedAt" | "expiresAt"
	>,
	now: Date,
) {
	if (invitation.status === "ACCEPTED" || invitation.acceptedAt) {
		return "alreadyAccepted";
	}

	if (invitation.status === "REVOKED" || invitation.revokedAt) {
		return "revoked";
	}

	if (invitation.expiresAt.getTime() <= now.getTime()) {
		return "expired";
	}

	return "available";
}

type MarkInvitationAcceptedResult =
	| { status: "accepted" }
	| { status: "alreadyAccepted" };

async function markInvitationAccepted(
	tx: Prisma.TransactionClient,
	invitationId: string,
	now: Date,
): Promise<MarkInvitationAcceptedResult> {
	const updatedInvitation = await tx.ownerInvitation.updateMany({
		where: {
			id: invitationId,
			status: "PENDING",
			acceptedAt: null,
			revokedAt: null,
			expiresAt: { gt: now },
		},
		data: {
			status: "ACCEPTED",
			acceptedAt: now,
		},
	});

	if (updatedInvitation.count === 0) {
		return { status: "alreadyAccepted" };
	}

	return { status: "accepted" };
}
