import { FeedbackType } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { SubmitFeedbackDto } from "../dto/submit-feedback.dto";

const valid = { type: FeedbackType.ERROR, description: "valid feedback" };
const errors = (body: object) => validate(plainToInstance(SubmitFeedbackDto, body));

describe("SubmitFeedbackDto", () => {
	it("accepts both feedback types and exact inclusive text boundaries", async () => {
		for (const type of [FeedbackType.ERROR, FeedbackType.SUGGESTION]) {
			expect(await errors({ ...valid, type, description: "x".repeat(10) })).toHaveLength(0);
			expect(await errors({ ...valid, type, description: "x".repeat(2000) })).toHaveLength(0);
		}
	});

	it("rejects enum, text, pathname, and canonical UUIDv4 boundary violations", async () => {
		for (const body of [
			{ ...valid, type: "error" }, { ...valid, description: "x".repeat(9) }, { ...valid, description: "x".repeat(2001) },
			{ ...valid, pathname: "/a?query" }, { ...valid, pathname: "/a#hash" }, { ...valid, pathname: "x".repeat(513) },
			{ ...valid, requestId: "A1234567-1234-4123-8123-123456789abc" }, { ...valid, requestId: "a1234567-1234-5123-8123-123456789abc" },
		]) expect(await errors(body)).not.toHaveLength(0);
		expect(await errors({ ...valid, pathname: "/", requestId: "a1234567-1234-4123-8123-123456789abc" })).toHaveLength(0);
	});
});
