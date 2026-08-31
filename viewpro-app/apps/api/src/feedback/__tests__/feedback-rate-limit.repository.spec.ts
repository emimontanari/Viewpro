import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaFeedbackRepository } from "../prisma-feedback.repository";

const prisma = new PrismaClient();
let tenantId: string;
let userId: string;

async function addPair() {
	const tenant = await prisma.tenant.create({ data: { name: randomUUID(), slug: randomUUID() } });
	const user = await prisma.user.create({ data: { email: `${randomUUID()}@test.local`, passwordHash: "hash", firstName: "Test" } });
	return { tenantId: tenant.id, userId: user.id };
}

describe("PrismaFeedbackRepository rate-limit reservation", () => {
	beforeEach(async () => {
		await prisma.feedbackSubmissionAttempt.deleteMany();
		({ tenantId, userId } = await addPair());
	});
	afterAll(() => prisma.$disconnect());

	it("allows five reservations and limits the sixth for one exact pair", async () => {
		const repository = new PrismaFeedbackRepository(prisma as never);
		const results = await Promise.all(Array.from({ length: 6 }, () => repository.reserveAttempt({ tenantId, userId })));
		expect(results.filter((result) => result === "allowed")).toHaveLength(5);
		expect(results.filter((result) => result === "limited")).toHaveLength(1);
		expect(await prisma.feedbackSubmissionAttempt.count({ where: { tenantId, userId } })).toBe(5);
	});

	it("expires the cutoff row and isolates each user and tenant pair", async () => {
		const repository = new PrismaFeedbackRepository(prisma as never);
		await prisma.feedbackSubmissionAttempt.create({ data: { tenantId, userId, attemptedAt: new Date(Date.now() - 600_000) } });
		const otherUser = await addPair();
		expect(await repository.reserveAttempt({ tenantId, userId })).toBe("allowed");
		expect(await repository.reserveAttempt({ tenantId, userId: otherUser.userId })).toBe("allowed");
		expect(await repository.reserveAttempt(otherUser)).toBe("allowed");
		expect(await prisma.feedbackSubmissionAttempt.count({ where: { tenantId, userId } })).toBe(1);
	});
});
