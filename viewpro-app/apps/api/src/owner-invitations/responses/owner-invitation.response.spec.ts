import { OwnerInvitationStatus, PropertyAssetOwnerAccessStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { OwnerInvitationDetails } from "../owner-invitations.repository";
import { mapOwnerInvitation } from "./owner-invitation.response";

const details = (
	overrides: Partial<OwnerInvitationDetails> = {},
): OwnerInvitationDetails =>
	({
		id: "inv-1",
		propertyAssetOwnerId: "own-1",
		email: "ana@example.com",
		emailRegistered: false,
		status: OwnerInvitationStatus.PENDING,
		expiresAt: new Date("2026-09-30T00:00:00.000Z"),
		acceptedAt: null,
		revokedAt: null,
		propertyEngagement: { tenant: { name: "Inmobiliaria Sur" } },
		propertyAssetOwner: {
			id: "own-1",
			ownerEmail: "ana@example.com",
			ownerFirstName: "Ana",
			ownerLastName: "Owner",
			accessStatus: PropertyAssetOwnerAccessStatus.INVITED,
			userId: null,
			propertyAsset: {
				id: "asset-1",
				title: "Depto Centro",
				addressLine: "Av. Colón 1234",
				city: "Córdoba",
				province: "Córdoba",
			},
		},
		...overrides,
	}) as OwnerInvitationDetails;

describe("mapOwnerInvitation", () => {
	it("names the agency that sent the invitation", () => {
		expect(mapOwnerInvitation(details()).agencyName).toBe("Inmobiliaria Sur");
	});

	it("reports no agency rather than guessing one", () => {
		// An invitation created before the engagement was recorded has no
		// authoritative agency. The acceptance surface shows the generic copy.
		expect(
			mapOwnerInvitation(details({ propertyEngagement: null })).agencyName,
		).toBeNull();
	});

	it("still keeps the street address out of the payload", () => {
		// Pinned by #419 and re-pinned here, because this change adds a new field
		// to the same response: whoever holds the link is not necessarily the
		// invited owner until they accept.
		const response = mapOwnerInvitation(details());

		expect(JSON.stringify(response)).not.toContain("Av. Colón 1234");
		expect(response.property).not.toHaveProperty("addressLine");
	});

	it("exposes the agency name and nothing else about the tenant", () => {
		// Criterion 6 of #303: the acceptance surface identifies who invited you,
		// it does not hand over the tenant record.
		const response = mapOwnerInvitation(details()) as Record<string, unknown>;

		expect(response).not.toHaveProperty("tenantId");
		expect(response).not.toHaveProperty("propertyEngagement");
		expect(response).not.toHaveProperty("propertyEngagementId");
	});
});
