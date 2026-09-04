import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

function model(name: string) {
	return schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`, "m"))?.[0] ?? "";
}

describe("property proposal Prisma schema contract", () => {
	it("declares tenant-owned proposal, immutable round, and decision models with typed snapshots", () => {
		expect(schema).toMatch(
			/enum PropertyProposalStatus \{\s*BORRADOR\s*EN_REVISION\s*APROBADA\s*RECHAZADA\s*\}/,
		);
		expect(schema).toMatch(
			/enum PropertyProposalReviewOutcome \{\s*APPROVED\s*REJECTED\s*\}/,
		);

		for (const name of [
			"PropertyProposal",
			"PropertyProposalReviewRound",
			"PropertyProposalReviewDecision",
		]) {
			expect(model(name)).toMatch(/\n\s*tenantId\s+String/m);
		}

		const proposal = model("PropertyProposal");
		expect(proposal).toMatch(/proposedByUserId\s+String/);
		expect(proposal).toMatch(/state\s+PropertyProposalStatus\s+@default\(BORRADOR\)/);
		expect(proposal).toMatch(/version\s+Int\s+@default\(1\)/);
		expect(proposal).toMatch(/@@unique\(\[id, tenantId\]\)/);

		const round = model("PropertyProposalReviewRound");
		expect(round).toMatch(/roundNumber\s+Int/);
		expect(round).toMatch(/@@unique\(\[proposalId, roundNumber\]\)/);
		for (const field of [
			"title",
			"addressLine",
			"city",
			"province",
			"propertyType",
			"operationType",
			"totalAreaSqm",
			"coveredAreaSqm",
			"rooms",
			"bedrooms",
			"bathrooms",
			"garages",
			"ageYears",
			"orientation",
			"ownerName",
			"ownerEmail",
			"publishedPriceCents",
			"currency",
		]) {
			expect(round).toMatch(new RegExp(`\\b${field}\\s+`));
		}

		const decision = model("PropertyProposalReviewDecision");
		expect(decision).toMatch(/outcome\s+PropertyProposalReviewOutcome/);
		expect(decision).toMatch(/reviewRoundId\s+String\s+@unique/);
	});

	it("keeps direct engagements nullable while enforcing a unique same-tenant proposal source relation", () => {
		const engagement = model("PropertyEngagement");
		expect(engagement).toMatch(/sourceProposalId\s+String\?/);
		expect(engagement).toMatch(
			/sourceProposal\s+PropertyProposal\?\s+@relation\(fields: \[sourceProposalId, tenantId\], references: \[id, tenantId\], onDelete: NoAction, onUpdate: Restrict\)/,
		);
		expect(engagement).toMatch(/sourceProposalId\s+String\?\s+@unique/);
		expect(model("PropertyProposal")).toMatch(/sourceEngagement\s+PropertyEngagement\?/);
	});
});
