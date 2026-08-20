# Production Cutover Lineage Specification

## Requirements

### Requirement: Clean Bootstrap Allowlist

Only Product migration ledger/schema and Platform cursor `0`/one-operator/empty-metrics are allowed; no old/demo/nonallowlisted row. Provisioning requires current-org/independent-Free/provider-policy receipts; paid/unapproved orgs prohibited.

#### Scenario: Bootstrap
- GIVEN fresh projects
- WHEN the allowlist receipt is evaluated
- THEN zero invariants, cursor `0`, operator count, empty metrics, and no old/demo row pass

#### Scenario: Provisioning block
- GIVEN a slot, allowance, or policy receipt is absent
- WHEN provisioning is requested
- THEN provisioning and traffic fail closed

### Requirement: Role and Lane Isolation

Lanes MUST use privileged-direct migration/bootstrap, least-privilege pooled runtime, and read-only-direct backup identities; production/demo endpoints differ; default-owner exceptions require approved time-bounded documentation.

#### Scenario: Lane receipt
- GIVEN a receipt lists roles/targets/grants and owner exceptions
- WHEN activation is evaluated
- THEN it passes only for distinct endpoints and a current approved exception

### Requirement: Generation Authority

Remediation gates only WU3-WU7 implementation/compatibility. Provider-mutation/D.4/production-receipt/traffic require verified external post-WU7 release-manifest covering exact reviewed WU1-WU7 identities, known prefix, full-tree/runtime-path/image digests, tool/schema versions/private receipts. Read-only provider qualification is separately authorized/no mutation. Redacted receipts bind image/endpoints/backup-lineage/secrets/deployment/rollback/exact-#327-candidate. Traffic requires #327 proof/alerts, D.1-D.2, readiness, singleton, non-timer/non-stale image. Non-atomic changes fail closed.

#### Scenario: Candidate failure
- GIVEN the final manifest is absent/unverified/incomplete or a binding/proof/alert/readiness/singleton/image check fails
- WHEN fresh traffic is requested
- THEN admission fails; projects remain isolated

#### Scenario: Alias failure
- GIVEN a public opaque alias is unresolved/retargeted or disagrees with its pinned manifest digest/private receipt identity
- WHEN provider, D.4, receipt, or traffic authority is evaluated
- THEN it fails closed; the direct immutable manifest digest and private receipt identity take precedence over alias resolution

### Requirement: Cutover/Invalidation

Cutover MUST readiness-gate product then platform backends, then frontends; reject cross-generation writes; invalidate product JWTs/cookies, platform JWTs/step-up, abandoned DB-backed refresh/reset/verification tokens. `PLATFORM_CONTROL_SECRET` stays unchanged unless separately authorized.

#### Scenario: Promotion/invalidation
- GIVEN each predecessor is ready and old artifacts exist
- WHEN sequence and invalidation checks complete
- THEN only the next layer receives traffic; old artifacts are rejected; no cross-generation write is accepted

### Requirement: Rollback and Retention Boundary

Before first business write, paired old image/URLs MAY return; later URL rollback requires reconciliation/export authority; roll-forward is default. Old Neon/projects/backups remain one month. R2 business objects/Sentry/Resend MUST NOT be deleted or get new retention.

#### Scenario: Boundary protection
- GIVEN a business write occurred or retention is active
- WHEN unauthorized rollback or deletion is requested
- THEN the request is refused; retained lineage is protected

### Requirement: Backup/Evidence Gates

Generation-specific backup-lineage/backup/heartbeat pass before maintenance ends; pruning MUST NOT remove old rollback artifacts during month. The 24-hour internal pilot needs #327 D.5, doesn't redefine it, never authorizes public launch. One-month evidence records per-project raw CU/autosuspension/scheduled-activity/demand-history/generation-identity; only informs commercial decision, never paid plans/public launch/deletion/broader release.

#### Scenario: Evidence incomplete
- GIVEN a requested progression lacks its corresponding receipt
- WHEN the receipt gate is evaluated
- THEN missing fresh-lane backup/heartbeat blocks maintenance completion/write resumption
- AND missing #327 D.5 blocks internal pilot and #327 verify/archive
- AND missing one-month/retention evidence blocks commercial decision and cutover verify/archive
- AND a later missing receipt never retroactively blocks an already-satisfied progression gate

### Requirement: Lifecycle Order

#327 stays active; D.5 follows deployment; #327 verify/archive follows D.5; cutover verify/archive follows #327/month/retention gates. Post-WU7-review/CI/merge, tooling MAY read-only assemble provisional isolated candidate from known-prefix+WU1-WU7 patches in disposable local worktree; no provider/traffic authority. Compute deterministic full-tree/runtime-path digests; create populated release-manifest in private evidence outside candidate Git; independently reassemble identities/verify exact digests. Only reproduction plus separate single-use authorization permits candidate-promotion/provider-mutation/D.4/production-receipts. Instance/public evidence MUST never enter/alter bound tree.

#### Scenario: Receipt order
- GIVEN a predecessor receipt is missing
- WHEN verify/archive is requested
- THEN it is blocked

#### Scenario: External closure
- GIVEN WU7 is reviewed, merged, and a provisional local assembly exists
- WHEN independent manifest reproduction does not verify its recorded digests
- THEN candidate-promotion/provider-mutation/D.4/production-receipts/traffic remain blocked
