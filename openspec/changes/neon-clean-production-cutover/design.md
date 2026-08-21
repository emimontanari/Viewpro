# Design: Neon Clean Production Cutover

## Approach and Decisions

Write-freeze activation; fail closed; #327 remains authoritative.

| Decision | Choice and rationale |
|---|---|
| Candidate | Reconstruct `main@868dc70a025d208fd4d1f7ece52640cc92187e1e` + #331/#333/#334/#335/#336 + WU1 `faf870ab0a29e6a271b7391776fc2f9cf25c12ac` + WU2 `d53a57c04f34efd20fc825aff5c03115c9c6c99f` + later reviewed WU3a/WU3b/WU4–WU7 merges. Exclude #338/#341/#344/#351 and #314; reject hidden/optional dependencies. `3212c438f0ef5be886b090478acfba3a38d64102` is closure metadata only. Bind exact order, detached identity, final tree, and runtime/image digests; evidence never alters the tree. |
| Delivery | `sequential-to-develop` is the sole operational strategy: each slice starts from then-live `origin/develop`, targets `develop`, and the next starts only after review, green CI, merge, fetch, and overlap audit. The compatibility label is non-operational and never targets `main` or a parent branch. WU3b follows merged WU3a. Target/stop 350; native max 390 is never permission to cross 350; no exception or strategy mixing. |
| Authority | Neither slice creates a populated final manifest, assembles/promotes a real candidate, mutates/provisions a provider, runs D.4, deploys/routes traffic, creates production receipts, or exposes secrets. Read-only local validation grants no operational authority. |
| Rollback | Each PR is independently revertible. Old paired image/URLs remain pre-write eligible only after independent `200`; old `503` proves nothing. Post-write reversal needs reconciliation/export authority. Retain old Neon/backups ≥one month; never delete R2/Sentry/Resend. |

## WU3 Correction and Ownership

Native attempt 5 is terminal failed with evidence `sha256:e448a25dcbcaf1db88f994d05ef987bfecef4d044319320babe6ec61542496a2`; no reset/acquire/settle occurs in this planning PR. Split approval is complete via the maintainer interactive decision and Engram #8114; native reset remains phase-scoped. After this planning merge, WU3a starts in a fresh worktree from then-live `origin/develop` with explicit maintainer-authorized reset+acquire, then settles only after strict TDD, fresh 3-lens review, and final evidence. WU3b gets its own clean reset/acquire after WU3a merges and follows the same settlement gate.

| Slice | Autonomous boundary and files | Forecast / acceptance / rollback |
|---|---|---|
| WU3a | Own/rewrite `candidate.mjs` and baseline `candidate.spec.mjs`; reconcile/salvage only justified root `package.json`, root-importer lock entries, and additive `.github/workflows/ci.yml`. Own canonical repository/resolved Git authority, scrubbed env, detached identity/final-tree binding, porcelain-v2 `-z` cleanliness, and bounded TERM→KILL→confirmed-close/drain. Controlled temporary real-Git repositories/processes; no network/provider. | ~344; stop at 350. Strict RED→GREEN proves RED-CUT-01/02/04, real clean/dirty/detached repositories, substitution denial, timeout cleanup, frozen-lock install, and additive CI. Revert only these files. |
| WU3b | Narrowly extends WU3a exports in `candidate.mjs` for NUL tree parsing, path classification, and closed remediation/release-manifest validation, with matching `candidate.spec.mjs` additions; exclusively creates `release-manifest.v1.schema.json` and intentionally unpopulated `release-manifest.v1.template.json`. It may not alter WU3a process/repository authority. | ~182; stop at 350. Strict RED→GREEN proves versioned populated-release schema, tracked-manifest exact closure, template non-population, malformed NUL records/path disguises, hidden/optional dependencies, #314, excluded-patch classification, and RED-CUT-03. Revert only this extension/schema/template. |

Current failed-diff disposition: WU3a may rewrite the two candidate files and selectively salvage package/lock/CI after live-base reconciliation. Schema/template are deferred to WU3b. No root/worktree destructive cleanup.

## Preserved Contracts

Fresh lanes retain least privilege: migrator owns schema objects without superuser/role/database/replication authority; runtime has schema usage, table DML, and sequence use without ownership, membership, DDL, or database create; backup is read-only. Exceptions require expiry receipts. Lanes emit RFC-8785/JCS JSON; public versions/aliases/patches/digests and private HMAC-correlated raw receipts remain distinct, with immutable private manifest identity authoritative and aliases pinned/non-authoritative.

Activation remains freeze → bootstrap → stage images/receipts/inactive URLs → rotate access while retaining `PLATFORM_CONTROL_SECRET` → product backend → platform backend → frontends/fresh login → backups/heartbeats → checkpoint/resume. Old paired `200` is the only pre-write rollback qualification; backend rejection of old sessions/tokens remains mandatory. RED-CUT-05–13, provider/D.4/traffic gates, and retention/deletion boundaries are unchanged.

## Threat and RED Matrix

Documentation-like paths reject executable/disguised Markdown/MDX, `README.sh`, `requirements.txt`, and `CMakeLists.txt` (RED-CUT-03). Repository selection requires the canonical absolute repository and authorized resolved Git; deny `-C`, relative/alternate roots, and executable injection (RED-CUT-02). Commit state requires detached expected commits and explicit porcelain-v2 NUL-clean worktree/index; staged, unstaged, untracked, wrong HEAD/tree fail (RED-CUT-01). Process nonzero/signal/timeout/spawn/close-drain failure rejects with TERM→grace→KILL (RED-CUT-04). Push/PR commands are N/A.

## Existing Contracts and Downstream

Lane grants, RFC-8785/JCS receipts, HMAC-SHA256 private correlation, alias/direct-identity precedence, backend-first activation, session/token invalidation, and RED-CUT-05–13 remain unchanged. WU1 evidence remains complete in `platform-data/**` and `platform-sync/tenants/**`; WU2 remains complete in `observability/**`, fixture specs, and `remediation-manifest.v1.json`. WU4–WU7 retain scopes and 330–350/320–350/300–340/330–350 forecasts, but WU4 depends on reviewed-merged WU3b; conservative total becomes 2,391–2,641. After WU7 only, an external checkpoint may assemble a disposable read-only provisional candidate, create the populated private manifest off-Git, independently reproduce identities/digests, then require separate single-use authorization before promotion/provider/D.4/receipts. No proposal/spec amendment: splitting delivery and strengthening implementation evidence do not change capability semantics, authority, scenarios, or lifecycle order.
