import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type {
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
}
