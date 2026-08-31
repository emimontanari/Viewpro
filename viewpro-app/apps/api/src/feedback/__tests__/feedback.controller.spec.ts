import { FeedbackType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { FeedbackController } from "../feedback.controller";
import { SubmitFeedbackUseCase } from "../use-cases/submit-feedback.use-case";

const tenant = { tenantId: "tenant-server" } as never;
const user = { id: "user-server", email: "member@example.com" };
const body = { type: FeedbackType.ERROR, description: "inert <script>" };

describe("FeedbackController", () => {
	it("passes only authenticated tenant and user attribution to the use case", async () => {
		const execute = vi.fn().mockResolvedValue({ accepted: true });
		const controller = new FeedbackController({ execute } as never);
		await expect(controller.submit(tenant, user, body)).resolves.toEqual({ accepted: true });
		expect(execute).toHaveBeenCalledWith(tenant, user, body);
	});
});

describe("SubmitFeedbackUseCase", () => {
	it("persists server-derived attribution and leaves a persistence failure unaccepted", async () => {
		const create = vi.fn().mockResolvedValue({
			id: "report-1", tenantId: "tenant-server", userId: "user-server", type: body.type,
			description: body.description, createdAt: new Date("2026-08-31T10:00:00.000Z"),
			user: { email: "member@example.com" }, tenant: { name: "Tenant" },
		});
		const useCase = new SubmitFeedbackUseCase({ create } as never, { notify: vi.fn() } as never);
		await expect(useCase.execute(tenant, user, body)).resolves.toEqual({ accepted: true });
		expect(create).toHaveBeenCalledWith({ ...body, tenantId: "tenant-server", userId: "user-server" });
		await expect(new SubmitFeedbackUseCase({ create: vi.fn().mockRejectedValue(new Error("database secret")) } as never, { notify: vi.fn() } as never).execute(tenant, user, body)).rejects.toThrow("database secret");
	});
});
