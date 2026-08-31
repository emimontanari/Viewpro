import type { INestApplication } from "@nestjs/common";
import { FeedbackType } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "../src/bootstrap/create-app";
import { PrismaService } from "../src/database/prisma.service";

const body = { type: FeedbackType.ERROR, description: "valid feedback" };

describe("feedback submission (e2e)", () => {
	let app: INestApplication;
	let prisma: PrismaService;
	beforeAll(async () => { app = await createApiApp(); await app.listen(0); prisma = app.get(PrismaService); });
	beforeEach(async () => {
		await prisma.feedbackReport.deleteMany(); await prisma.feedbackSubmissionAttempt.deleteMany();
		await prisma.propertyAssetOwner.deleteMany(); await prisma.propertyAgent.deleteMany();
		await prisma.propertyEngagement.deleteMany(); await prisma.propertyAsset.deleteMany();
		await prisma.refreshToken.deleteMany(); await prisma.tenantMembership.deleteMany(); await prisma.tenant.deleteMany(); await prisma.user.deleteMany();
	});
	afterAll(() => app.close());

	it("rejects unauthenticated and non-member callers without an attempt or report", async () => {
		await request(app.getHttpServer()).post("/api/feedback").send(body).expect(401);
		expect(await prisma.feedbackSubmissionAttempt.count()).toBe(0);
		const member = await session("member@example.com", "Member Homes");
		const other = await session("other@example.com", "Other Homes");
		await member.agent.post("/api/feedback").set("x-tenant-id", other.tenantId).send(body).expect(403);
		expect(await prisma.feedbackReport.count()).toBe(0);
		expect(await prisma.feedbackSubmissionAttempt.count()).toBe(0);
	});

	it("uses AuthGuard-populated identity and member tenant attribution for both types", async () => {
		const member = await session("active@example.com", "Active Homes");
		for (const type of [FeedbackType.ERROR, FeedbackType.SUGGESTION]) {
			await member.agent.post("/api/feedback").set("x-tenant-id", member.tenantId).send({ ...body, type }).expect(201);
		}
		expect(await prisma.feedbackReport.findMany({ orderBy: { type: "asc" } })).toEqual(expect.arrayContaining([
			expect.objectContaining({ tenantId: member.tenantId, userId: member.userId, type: FeedbackType.ERROR }),
			expect.objectContaining({ tenantId: member.tenantId, userId: member.userId, type: FeedbackType.SUGGESTION }),
		]));
	});

	it("forbids spoofed identity fields before persistence", async () => {
		const member = await session("spoof@example.com", "Spoof Homes");
		await member.agent.post("/api/feedback").set("x-tenant-id", member.tenantId).send({ ...body, userId: "attacker", tenantId: "attacker" }).expect(400);
		expect(await prisma.feedbackReport.count()).toBe(0);
	});

	async function session(email: string, tenantName: string) {
		const agent = request.agent(app.getHttpServer());
		const response = await agent.post("/api/auth/register-tenant").send({ whatsappPhone: "3510000000", email, password: "password123", firstName: "Member", tenantName }).expect(201);
		return { agent, userId: response.body.user.id as string, tenantId: response.body.memberships[0].tenant.id as string };
	}
});
