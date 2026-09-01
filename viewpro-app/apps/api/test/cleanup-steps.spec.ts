import { expect, it } from "vitest";
import { runCleanupSteps } from "./cleanup-steps";

it("attempts later cleanup steps in order after an earlier failure and surfaces every failure", async () => {
	const order: string[] = [];
	const firstFailure = new Error("remove candidate schema failed");
	const secondFailure = new Error("remove seed records failed");

	let cleanupError: unknown;
	try {
		await runCleanupSteps([
			{
				name: "remove candidate schema",
				run: async () => {
					order.push("remove candidate schema");
					throw firstFailure;
				},
			},
			{
				name: "restore expected schema",
				run: async () => {
					order.push("restore expected schema");
				},
			},
			{
				name: "remove seed records",
				run: async () => {
					order.push("remove seed records");
					throw secondFailure;
				},
			},
		]);
	} catch (error) {
		cleanupError = error;
	}

	expect(order).toEqual([
		"remove candidate schema",
		"restore expected schema",
		"remove seed records",
	]);
	expect(cleanupError).toBeInstanceOf(AggregateError);
	expect((cleanupError as AggregateError).errors).toEqual([firstFailure, secondFailure]);
});

it("keeps dependency-safe cleanup order when every step succeeds", async () => {
	const order: string[] = [];

	await expect(
		runCleanupSteps([
			{ name: "restore candidate schema", run: async () => void order.push("restore candidate schema") },
			{ name: "remove seed records", run: async () => void order.push("remove seed records") },
		]),
	).resolves.toBeUndefined();

	expect(order).toEqual(["restore candidate schema", "remove seed records"]);
});
