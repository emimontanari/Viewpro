import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type {
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

@Injectable()
export class PrismaOwnerInvitationsRepository
	implements OwnerInvitationsRepository
{
	constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

	findByTokenHash(tokenHash: string): Promise<OwnerInvitationDetails | null> {
		return this.prisma.ownerInvitation.findUnique({
			where: { tokenHash },
			select: ownerInvitationSelect,
		});
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

			if (invitation.status === "ACCEPTED" || invitation.acceptedAt) {
				return { status: "alreadyAccepted" };
			}

			if (invitation.status === "REVOKED" || invitation.revokedAt) {
				return { status: "revoked" };
			}

			if (invitation.expiresAt.getTime() <= input.now.getTime()) {
				return { status: "expired" };
			}

			const existingUser = await tx.user.findUnique({
				where: { email: invitation.email },
			});

			if (existingUser) {
				return { status: "userAlreadyExists" };
			}

			const updatedInvitation = await tx.ownerInvitation.updateMany({
				where: {
					id: invitation.id,
					status: "PENDING",
					acceptedAt: null,
					revokedAt: null,
					expiresAt: { gt: input.now },
				},
				data: {
					status: "ACCEPTED",
					acceptedAt: input.now,
				},
			});

			if (updatedInvitation.count === 0) {
				return { status: "alreadyAccepted" };
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
}
