import { runCleanupSteps } from "./cleanup-steps";

type DeleteMany = {
	deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<unknown>;
};

export type PropertyProposalCleanupClient = {
	propertyEngagement: DeleteMany;
	propertyAsset: DeleteMany;
	propertyProposal: DeleteMany;
	tenant: DeleteMany;
	user: DeleteMany;
	$disconnect: () => Promise<void>;
};

export type PropertyProposalFixtureIds = {
	sourceEngagementIds: string[];
	orphanAssetIds: string[];
	proposalIds: string[];
	tenantIds: string[];
	userIds: string[];
};

type CleanupOptions = {
	disconnectTimeoutMs?: number;
};

const defaultDisconnectTimeoutMs = 5_000;

function disconnectByDeadline(client: PropertyProposalCleanupClient, timeoutMs: number) {
	return new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new Error(`Property proposal cleanup disconnect timed out after ${timeoutMs}ms`)),
			timeoutMs,
		);
		void client.$disconnect().then(resolve, reject).finally(() => clearTimeout(timeout));
	});
}

export async function withPropertyProposalCleanup<T>(
	createClient: () => PropertyProposalCleanupClient | Promise<PropertyProposalCleanupClient>,
	ids: PropertyProposalFixtureIds,
	work: (client: PropertyProposalCleanupClient) => Promise<T>,
	{ disconnectTimeoutMs = defaultDisconnectTimeoutMs }: CleanupOptions = {},
): Promise<T> {
	let client: PropertyProposalCleanupClient | undefined;
	let result!: T;
	const failures: unknown[] = [];

	try {
		client = await createClient();
		result = await work(client);
	} catch (error) {
		failures.push(error);
	}

	if (client) {
		try {
			await runCleanupSteps([
				{
					name: "source engagements",
					run: () => client.propertyEngagement.deleteMany({ where: { id: { in: ids.sourceEngagementIds } } }),
				},
				{
					name: "captured orphan assets",
					run: () => client.propertyAsset.deleteMany({ where: { id: { in: ids.orphanAssetIds } } }),
				},
				{
					name: "proposals",
					run: () => client.propertyProposal.deleteMany({ where: { id: { in: ids.proposalIds } } }),
				},
				{ name: "tenants", run: () => client.tenant.deleteMany({ where: { id: { in: ids.tenantIds } } }) },
				{ name: "users", run: () => client.user.deleteMany({ where: { id: { in: ids.userIds } } }) },
			]);
		} catch (error) {
			failures.push(error);
		}

		try {
			await disconnectByDeadline(client, disconnectTimeoutMs);
		} catch (error) {
			failures.push(error);
		}
	}

	if (failures.length > 0) {
		throw new AggregateError(failures, "Property proposal cleanup failed");
	}
	return result;
}
