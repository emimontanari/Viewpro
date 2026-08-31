import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { FeedbackRateLimitGuard } from "../feedback-rate-limit.guard";
import { FEEDBACK_RATE_LIMIT_REPOSITORY } from "../feedback.repository";

const contextFor = (request: object) =>
	({ switchToHttp: () => ({ getRequest: () => request }) }) as ExecutionContext;

describe("FeedbackRateLimitGuard", () => {
	it("allows an authorized reservation", async () => {
		const reserveAttempt = vi.fn().mockResolvedValue("allowed");
		const guard = new FeedbackRateLimitGuard({ reserveAttempt } as never);
		const request = { user: { id: "user-1" }, tenantContext: { tenantId: "tenant-1" } };

		await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
		expect(reserveAttempt).toHaveBeenCalledWith({ tenantId: "tenant-1", userId: "user-1" });
	});

	it("rejects a consumed sixth reservation with safe 429 semantics", async () => {
		const guard = new FeedbackRateLimitGuard({ reserveAttempt: vi.fn().mockResolvedValue("limited") } as never);
		await expect(guard.canActivate(contextFor({ user: { id: "user-1" }, tenantContext: { tenantId: "tenant-1" } }))).rejects.toMatchObject({ status: 429 });
	});
});

void FEEDBACK_RATE_LIMIT_REPOSITORY;
