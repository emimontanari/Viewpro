import { FeedbackType } from "@prisma/client";
import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SubmitFeedbackUseCase } from "../../use-cases/submit-feedback.use-case";
import {
	NoopFeedbackNotifier,
	ResendFeedbackNotifier,
	createFeedbackNotifier,
} from "../feedback-notifier.adapters";

const report = {
	id: "report-1", type: FeedbackType.ERROR, description: "hostile description", pathname: "/dashboard",
	requestId: "01234567-89ab-4def-8abc-0123456789ab", createdAt: new Date("2026-08-31T10:00:00.000Z"),
	tenantId: "tenant-1", userId: "user-1", user: { email: "member@example.com" }, tenant: { name: "Hostile tenant" },
};
const tenant = { tenantId: report.tenantId } as never;
const user = { id: report.userId } as never;
const body = { type: report.type, description: report.description } as never;

describe("feedback notifier", () => {
	it("persists before one notification and accepts a sanitized provider failure", async () => {
		const events: string[] = [];
		const create = vi.fn().mockImplementation(async () => { events.push("create"); return report; });
		const notify = vi.fn().mockImplementation(async () => { events.push("notify"); throw new Error("provider prose member@example.com"); });
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		const useCase = new SubmitFeedbackUseCase({ create } as never, { notify } as never);
		await expect(useCase.execute(tenant, user, body)).resolves.toEqual({ accepted: true });
		expect(events).toEqual(["create", "notify"]);
		expect(notify).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith({ reportId: report.id, timestamp: report.createdAt.toISOString(), category: "unknown", code: "FEEDBACK_NOTIFICATION_UNKNOWN" });
		expect(JSON.stringify(warn.mock.calls)).not.toMatch(/description|member@example.com|Hostile tenant|provider prose/);
		warn.mockRestore();
	});

	it("maps provider outcomes to closed diagnostics and never calls a provider in non-production", async () => {
		const send = vi.fn().mockResolvedValue({ error: { message: "rate limit" } });
		await expect(new ResendFeedbackNotifier("from@example.com", "to@example.com", { emails: { send } }).notify({ ...report, reportId: report.id, userEmail: report.user.email, tenantName: report.tenant.name })).rejects.toMatchObject({ category: "rate_limited", code: "RESEND_RATE_LIMITED" });
		expect(send).toHaveBeenCalledTimes(1);
		await expect(new NoopFeedbackNotifier().notify({ ...report, reportId: report.id, userEmail: report.user.email, tenantName: report.tenant.name })).resolves.toBeUndefined();
		expect(createFeedbackNotifier({ nodeEnv: "test", apiKey: "incidental", fromAddress: "from@example.com", feedbackRecipient: "to@example.com" })).toBeInstanceOf(NoopFeedbackNotifier);
	});

	it("does not notify when durable persistence rejects", async () => {
		const notify = vi.fn();
		await expect(new SubmitFeedbackUseCase({ create: vi.fn().mockRejectedValue(new Error("database failure")) } as never, { notify } as never).execute(tenant, user, body)).rejects.toThrow("database failure");
		expect(notify).not.toHaveBeenCalled();
	});

	it.each([
		["provider unavailable", "unavailable", "RESEND_UNAVAILABLE"],
		["recipient rejected", "rejected", "RESEND_REJECTED"],
	])("maps %s without preserving provider prose", async (message, category, code) => {
		const notifier = new ResendFeedbackNotifier("from@example.com", "to@example.com", { emails: { send: vi.fn().mockRejectedValue(new Error(message)) } });
		await expect(notifier.notify({ ...report, reportId: report.id, userEmail: report.user.email, tenantName: report.tenant.name })).rejects.toMatchObject({ category, code });
	});
});
