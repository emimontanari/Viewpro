import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Guards a monorepo-wide property from inside a single workspace.
 *
 * Vitest rejects `.only` under CI on its own: `allowOnly` defaults to
 * `!process.env.CI`. That is why three of the four workspace configs never
 * mention it and are protected anyway — and it is also why the protection is
 * invisible. Nothing in the repository states it, so a dependency upgrade that
 * changed the default would reopen the hole inside a diff nobody reads as a
 * change to test policy.
 *
 * These cases make it visible: the first two pin the behaviour of the installed
 * Vitest in both directions, and the third proves no workspace opts back out.
 *
 * It lives in `apps/api` because this workspace already runs under the main CI
 * test gate; a package holding one guard would cost more than it explains.
 */
describe("focused tests are rejected under CI", () => {
	const workspaceRoot = process.cwd();
	const vitestBin = resolve(workspaceRoot, "node_modules/.bin/vitest");
	let probeDir: string;

	beforeAll(() => {
		// Inside the workspace so the probe config can resolve `vitest/config`.
		probeDir = mkdtempSync(join(workspaceRoot, ".focused-rejection-probe-"));

		writeFileSync(
			join(probeDir, "vitest.config.ts"),
			'import { defineConfig } from "vitest/config";\n' +
				"export default defineConfig({ test: { include: [\"probe.spec.ts\"] } });\n",
		);

		writeFileSync(
			join(probeDir, "probe.spec.ts"),
			'import { expect, it } from "vitest";\n' +
				'it.only("focused", () => { expect(1).toBe(1); });\n' +
				'it("not focused", () => { expect(1).toBe(1); });\n',
		);
	});

	afterAll(() => {
		rmSync(probeDir, { recursive: true, force: true });
	});

	function runProbe({ ci }: { ci: boolean }) {
		const env = { ...process.env };
		if (ci) {
			env.CI = "true";
		} else {
			delete env.CI;
		}

		try {
			const stdout = execFileSync(
				vitestBin,
				["run", "--root", probeDir, "--config", join(probeDir, "vitest.config.ts")],
				{ cwd: workspaceRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env },
			);
			return { exitCode: 0, output: stdout };
		} catch (error) {
			const failure = error as { status?: number; stdout?: string; stderr?: string };
			return {
				exitCode: failure.status ?? 1,
				output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
			};
		}
	}

	it("fails the run when a focused test is present and CI is set", () => {
		const focused = runProbe({ ci: true });

		expect(focused.exitCode).not.toBe(0);
		expect(focused.output).toContain("Unexpected .only modifier");
	});

	it("still allows focusing locally, where CI is not set", () => {
		const local = runProbe({ ci: false });

		expect(local.exitCode).toBe(0);
		expect(local.output).not.toContain("Unexpected .only modifier");
	});

	it("no workspace config re-enables focused tests under CI", () => {
		const workspacesRoot = resolve(workspaceRoot, "..");
		const offenders: string[] = [];

		for (const workspace of readdirSync(workspacesRoot, { withFileTypes: true })) {
			if (!workspace.isDirectory()) continue;

			for (const candidate of ["vitest.config.ts", "vitest.config.mts", "vitest.config.js"]) {
				let source: string;
				try {
					source = readFileSync(join(workspacesRoot, workspace.name, candidate), "utf8");
				} catch {
					continue;
				}

				// Only a value that ignores CI weakens the default.
				const declaration = source.match(/allowOnly\s*:\s*([^,\n]+)/);
				if (declaration && !declaration[1]!.includes("CI")) {
					offenders.push(`${workspace.name}/${candidate} sets allowOnly:${declaration[1]}`);
				}
			}
		}

		expect(offenders).toEqual([]);
	});
});
