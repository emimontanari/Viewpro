import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();

describe("feedback quota foundation migration (e2e)", () => {
	afterAll(() => prisma.$disconnect());

	it("makes the attempt table available to a PostgreSQL client", async () => {
		const rows = await prisma.$queryRaw<{ table: string | null }[]>`SELECT to_regclass('public.feedback_submission_attempts')::text AS table`;
		expect(rows[0]?.table).toBe("feedback_submission_attempts");
	});
});
