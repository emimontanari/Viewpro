import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Proves the shared lint config reaches the linter with its plugins active.
 *
 * `pnpm lint` reporting six successful tasks says the command ran, not that it
 * applied anything. The plugin list and rule severities in .oxlintrc.node.json
 * can be gutted while every workspace still exits 0, because most of what the
 * config adds — the promise, node and vitest plugins among them — is off in
 * oxlint's defaults. Nothing else in the repository would notice.
 *
 * The probe is a promise/param-names violation, which the shared config rejects
 * and oxlint's defaults do not flag at all, so a pass here can only come from
 * the config being loaded and its plugin enabled.
 *
 * Correction worth recording, because it is what this file was first written
 * for: oxlint is NOT silently disabled by a malformed config. A trailing comma
 * is tolerated (the format is JSONC), and a genuinely unparseable file exits 1.
 * Both were verified. Do not add a JSON.parse assertion here — it would be
 * stricter than the tool and fail on syntax oxlint accepts.
 */
describe("the shared lint config is live", () => {
	const workspaceRoot = process.cwd();
	const oxlintBin = resolve(workspaceRoot, "node_modules/.bin/oxlint");
	const configPath = resolve(workspaceRoot, "../../.oxlintrc.node.json");
	let probeDir: string;

	beforeAll(() => {
		probeDir = mkdtempSync(join(workspaceRoot, ".lint-config-probe-"));

		writeFileSync(
			join(probeDir, "probe.ts"),
			"export const probe = new Promise((foo, bar) => { bar(foo) })\n",
		);
	});

	afterAll(() => {
		rmSync(probeDir, { recursive: true, force: true });
	});

	function runLint() {
		try {
			execFileSync(oxlintBin, ["--config", configPath, "--deny-warnings", probeDir], {
				cwd: workspaceRoot,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			});
			return { exitCode: 0, output: "" };
		} catch (error) {
			const failure = error as { status?: number; stdout?: string; stderr?: string };
			return {
				exitCode: failure.status ?? 1,
				output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
			};
		}
	}

	it("rejects a file only this config's plugins can reject", () => {
		const result = runLint();

		expect(result.exitCode).not.toBe(0);
		expect(result.output).toContain("promise(param-names)");
	});
});
