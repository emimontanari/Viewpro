export type CleanupStep = {
	name: string;
	run: () => Promise<void>;
};

export async function runCleanupSteps(steps: CleanupStep[]) {
	const failures: unknown[] = [];
	const failedStepNames: string[] = [];

	for (const step of steps) {
		try {
			await step.run();
		} catch (error) {
			failures.push(error);
			failedStepNames.push(step.name);
		}
	}

	if (failures.length > 0) {
		throw new AggregateError(failures, `Cleanup failed for: ${failedStepNames.join(", ")}`);
	}
}
