import { describe, expect, it } from "vitest";
import {
	withPropertyProposalCleanup,
	type PropertyProposalCleanupClient,
} from "./property-proposal-cleanup";

const fixtureIds = {
	sourceEngagementIds: ["source"],
	orphanAssetIds: ["asset"],
	proposalIds: ["proposal"],
	tenantIds: ["tenant"],
	userIds: ["user"],
};

function flattenErrors(error: unknown): unknown[] {
	return error instanceof AggregateError ? error.errors.flatMap(flattenErrors) : [error];
}

function cleanupClient(order: string[], cleanupFailure?: Error, disconnectFailure?: Error) {
	function deleteMany(name: string) {
		return async () => {
			order.push(name);
			if (name === "asset" && cleanupFailure) throw cleanupFailure;
		};
	}

	return {
		propertyEngagement: { deleteMany: deleteMany("engagement") },
		propertyAsset: { deleteMany: deleteMany("asset") },
		propertyProposal: { deleteMany: deleteMany("proposal") },
		tenant: { deleteMany: deleteMany("tenant") },
		user: { deleteMany: deleteMany("user") },
		$disconnect: async () => {
			order.push("disconnect");
			if (disconnectFailure) throw disconnectFailure;
		},
	} satisfies PropertyProposalCleanupClient;
}

describe("withPropertyProposalCleanup", () => {
	it.each([
		[false, false, false],
		[true, false, false],
		[false, true, false],
		[false, false, true],
		[true, true, false],
		[true, false, true],
		[false, true, true],
		[true, true, true],
	])("preserves the work=%s cleanup=%s disconnect=%s outcome", async (workFails, cleanupFails, disconnectFails) => {
		const order: string[] = [];
		const workFailure = new Error("work failed");
		const cleanupFailure = new Error("asset cleanup failed");
		const disconnectFailure = new Error("disconnect failed");
		const client = cleanupClient(
			order,
			cleanupFails ? cleanupFailure : undefined,
			disconnectFails ? disconnectFailure : undefined,
		);

		let result: string | undefined;
		let received: unknown;
		try {
			result = await withPropertyProposalCleanup(() => client, fixtureIds, async () => {
				order.push("work");
				if (workFails) throw workFailure;
				return "work result";
			});
		} catch (error) {
			received = error;
		}

		const expected = [
			...(workFails ? [workFailure] : []),
			...(cleanupFails ? [cleanupFailure] : []),
			...(disconnectFails ? [disconnectFailure] : []),
		];
		const receivedErrors = received ? flattenErrors(received) : [];

		expect(order).toEqual(["work", "engagement", "asset", "proposal", "tenant", "user", "disconnect"]);
		expect(result).toBe(expected.length === 0 ? "work result" : undefined);
		expect(received instanceof AggregateError).toBe(expected.length > 0);
		expect(receivedErrors).toHaveLength(expected.length);
		expect(receivedErrors.map((error) => expected.indexOf(error))).toEqual(
			expected.map((_, index) => index),
		);
	});

	it("rejects a never-settling final disconnect by its deadline", async () => {
		const client = cleanupClient([]);
		client.$disconnect = () => new Promise<void>(() => undefined);

		let received: unknown;
		try {
			await withPropertyProposalCleanup(() => client, fixtureIds, async () => "done", {
				disconnectTimeoutMs: 20,
			});
		} catch (error) {
			received = error;
		}

		expect(received).toBeInstanceOf(AggregateError);
		expect(flattenErrors(received)[0]).toMatchObject({
			message: "Property proposal cleanup disconnect timed out after 20ms",
		});
	}, 500);
});
