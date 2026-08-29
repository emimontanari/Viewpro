# Delta for Dependency Security

## ADDED Requirements

### Requirement: Remediate the approved advisory only
The change MUST remediate only `GHSA-ggr8-5vv4-36mx` at high severity; two low and three moderate findings MUST remain documented out of scope.
#### Scenario: Compliant
- GIVEN clean `develop` reports `GHSA-ggr8-5vv4-36mx`
- WHEN evaluated
- THEN it is absent; low/moderate findings remain documented
#### Scenario: Rejected
- GIVEN scope alters another advisory, Prisma version, or broad policy
- WHEN reviewed
- THEN the gate fails; the change MUST NOT merge

### Requirement: Preserve scoped resolution
Resolution MUST replace `deepmerge-ts` only under `@prisma/config@6.19.2`, preserve Prisma `6.19.2`, and leave unrelated consumers unchanged.
#### Scenario: Compliant
- GIVEN both API paths resolve `@prisma/config@6.19.2`
- WHEN the production graph is inspected
- THEN those edges resolve `deepmerge-ts` 8.x with no vulnerable 7.1.5
#### Scenario: Consumer
- GIVEN another package consumes `deepmerge-ts`
- WHEN scoped resolution is evaluated
- THEN its version and ancestry remain unchanged

### Requirement: Keep installation deterministic
Clean/frozen installs with pnpm 10.13.1 MUST succeed; resolution MUST reproduce the lockfile without unrelated churn.
#### Scenario: Compliant
- GIVEN artifacts and installed state are removed
- WHEN clean and frozen installs run
- THEN both succeed and reproduce the approved graph
#### Scenario: Drift
- GIVEN frozen install fails or unrelated entries change
- WHEN reviewed
- THEN the gate fails and the change MUST NOT be merged

### Requirement: Prove Prisma compatibility and clean output
Product/platform APIs MUST pass Prisma validate/generate on `6.19.2`, checks, and clean outputs; no-config-only evidence MUST NOT suffice.
#### Scenario: Compliant
- GIVEN isolated localhost test databases are ready
- WHEN both workspaces validate, generate, and run checks
- THEN both pass and generated clients work
#### Scenario: Rejected
- GIVEN either workspace fails or leaves unexpected tracked generated changes
- WHEN evidence is reviewed
- THEN the gate fails and rollback is required

### Requirement: Bind PR B verification to its final candidate
Native CI is necessary but insufficient. After PR B's last commit, its exact final head SHA MUST retain an all-workspace focused-test source scan with no `describe.only`, `it.only`, or `test.only`; `pnpm --filter @viewpro/api exec vitest run --allowOnly=false --retry=0`; `pnpm --filter @viewpro/platform-api exec vitest run --allowOnly=false --retry=0`; and passing native CI.
Any new commit invalidates all candidate results; any scan, direct, or native failure MUST block merge. This approved equivalent candidate-bound guard changes no Vitest configuration.
#### Scenario: Changed candidate
- GIVEN a new PR B commit after candidate verification
- WHEN merge readiness is evaluated
- THEN all candidate results are invalid and the required scan, direct checks, and native CI rerun on the new final head

### Requirement: Use a safe localhost-only destructive lifecycle
Destructive checks MUST use a reviewed `POSTGRES_16_ALPINE_IMAGE` matching `postgres:16-alpine@sha256:<64-hex>`, generate per-run credentials, use `env -i` rather than `.env`, fail closed on occupied ports/names or probe/tool/daemon/permission errors, bound readiness, create/protect a unique procedure-owned parent directory, reserve unique nonexistent `--cidfile` paths without creating files, register an exit/signal trap before startup, let Docker create the files and reject existing ones, then tolerate absence/partial starts/interrupts while reading exact IDs only from files there, removing only those files/IDs, and removing the owned directory on every exit.
#### Scenario: Compliant
- GIVEN required localhost ports and names are free
- WHEN databases are provisioned, used, and checks complete
- THEN only localhost is exposed; CID-file IDs/files and the owned directory are removed even if stopping fails
#### Scenario: Rejected
- GIVEN a port/name is occupied, a probe/tool/daemon/permission error occurs, or a database never becomes ready
- WHEN checks start or wait
- THEN no destructive check runs, cleanup executes, and the gate fails

### Requirement: Require the exact audit result
`pnpm audit --prod --audit-level high` MUST exit 0; low/moderate residual findings MUST be documented, not hidden.
#### Scenario: Compliant
- GIVEN graph, lockfile, and compatibility gates pass
- WHEN the exact production audit runs
- THEN it exits 0; residual low/moderate findings are documented
#### Scenario: Rejected
- GIVEN the exact audit exits nonzero
- WHEN merge readiness is evaluated
- THEN the change MUST remain blocked

### Requirement: Roll back atomically on failure
Any selector/install/compatibility/output/audit/API failure MUST restore prior manifest, lockfile, graph, and hydrated/generated state; ignored generated outputs MUST be snapshotted, archived, and hashed before any `node_modules` or generated-state deletion, then restored from that preserved snapshot and hash-verified; merge blocking MUST remain active.
#### Scenario: Rollback
- GIVEN a required gate fails after remediation begins
- WHEN rollback completes
- THEN prior graph/generated state is hash-verified after restoration and vulnerable ancestry is verifiable
#### Scenario: Unproven
- GIVEN a prior artifact, snapshot, hash, or status cannot be restored or verified
- WHEN assessed
- THEN acceptance fails and merges remain blocked

### Requirement: Keep PR #324 isolated
This MUST remain an independent issue #325 fix. PR #324 MUST remain unchanged and may update, rerun, or rebase only after PR B and #328 both merge green and #325 closure is authorized.
#### Scenario: Sequence
- GIVEN PR B and #328 both merge green and #325 closure is authorized
- WHEN PR #324 updates from the fixed base
- THEN PR #324 may update from the fixed base and rerun CI without this fix in its diff
#### Scenario: Early
- GIVEN either PR has not merged green or #325 closure is not authorized
- WHEN PR #324 changes or reruns for this fix
- THEN the workflow MUST reject that action and preserve isolation
