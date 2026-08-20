## Exploration: Neon clean production cutover

### Current State
The production topology has separate product and platform PostgreSQL databases. Each backend uses a pooled `DATABASE_URL` at runtime and a direct `DIRECT_URL` for Prisma migrations. GitHub Actions separately uses `NEON_PROD_DIRECT_URL` and `NEON_PLATFORM_DIRECT_URL` for nightly logical backups to R2. Both APIs expose dependency-free liveness and database-backed readiness; current 200 liveness with 503 readiness is therefore consistent with exhausted Neon compute rather than dead containers.

`origin/develop@adc274b0e08e2034d982e4d250db3886612684d3` contains issue #327 Slices A–D.3: synchronization is demand-triggered, one batch at a time, and the unconditional timer is removed. Production `main` does not contain that correction. The platform backend auto-deploys from `main`, so assigning any fresh database URL while the old image can run would let unconditional polling touch the fresh projects and invalidate the clean Free-plan experiment.

The fresh product database needs migrations only; there is no production product seed, and tenant self-registration is the intended first-write path. The fresh platform database needs migrations plus the idempotent operator seed. Its cursor migration creates `platform_ingest_cursor(id=1, seqNo=0)`, and consolidated contracts require valid empty metrics and tenant-registry states. Product registration then emits the first `TENANT_REGISTERED` outbox event for demand-driven projection.

The abandonment boundary is all PostgreSQL state in both old projects: users, refresh/reset/verification tokens, tenants, memberships, product records, document metadata, notifications, outbox and command rows, operators, mirrors, cursor, audit rows, and payment ledger rows. It does not delete or migrate R2 document/image objects, R2 backup objects, Sentry events, or Resend history. Those external records remain under their own retention policies, while R2 business objects become orphaned because their database references are abandoned. Existing email links backed by abandoned token rows cease to work.

The current repository proves URL purposes but not deployed role names or grants. The target role model must be explicit per lane: a privileged direct migration/bootstrap role, a least-privilege pooled runtime role, and a read-only direct backup role. Human/provider administration must remain separate from application identities. If Neon or Prisma constraints force reuse of a default owner role, that exception and its expiry must be recorded; secret values, hosts, role names, project identifiers, and raw provider responses must remain outside Git and public receipts.

Current Neon plan documentation advertises 100 Free projects, 100 CU-hours, 0.5 GB storage, and 5 GB public transfer per month, while adjacent changelog material still reports a 70-project limit and the documentation does not establish that two projects created mid-period receive independent fresh allowances. Before provisioning, the live console or written Neon confirmation must establish actual current-organization slots, each fresh project's independent allowance in the current consumption period, reset semantics, and storage/network limits. A second Free organization/account is prohibited as a fallback unless Neon explicitly confirms that arrangement is policy-compliant rather than quota circumvention. Project transfer preserves credentials/connection strings and moves usage/billing under destination limits, so it does not provide a clean identity or guaranteed quota reset.

This is a security-sensitive, non-atomic configuration cutover. Dokploy, Vercel, GitHub Actions, and Neon do not share one secret-store transaction, so the plan must stage versioned environment generations, expose only redacted hashes/fingerprints in receipts, activate one controlled step at a time, and assign a compensating rollback owner per step. Production targets must be distinct from and denylisted against demo/staging identifiers; production must not receive demo-only environment variables. Database abandonment invalidates refresh/reset/verification rows but not every signed access token, so coordinated product backend/frontend access-secret rotation plus platform access/step-up rotation is required to invalidate old sessions. Old projects and old-generation backups must remain retained and access-controlled for the full one-month rollback/evidence window.

Issue routing remains separated: this change owns clean provisioning, no-restore bootstrap, configuration cutover, backup lineage, session invalidation, rollback receipts, and one-month evidence. Issue #327 owns the synchronization implementation and its release/evidence defects. Issue #290 PR2c remains paused and owns production-derived restore-drill proof; it must not be used as authority for this no-restore bootstrap.

### Affected Areas
- `openspec/changes/neon-idle-platform-sync/` — D.4 is the deployment gate and D.5 is post-deploy CU evidence; current focused evidence still lacks the required production-visible proof and failure alerting.
- `openspec/changes/production-database-restore-drill/` — establishes backup safety and remains paused; restore/transfer are explicitly separate from clean bootstrap.
- `docs/plans/2026-07-21-production-go-live-runbook.md` — defines the two-database topology, pooled/direct URL split, explicit migrations, operator seed, deployment order, and smoke checks.
- `docs/plans/2026-07-20-recta-final-execution.md` — live execution authority and remaining production-hardening context.
- `viewpro-app/apps/api/prisma/` — product migration history; no production seed is allowed.
- `viewpro-app/apps/viewpro-api/prisma/` — platform migrations, cursor bootstrap, and idempotent first-operator seed.
- `viewpro-app/apps/{api,viewpro-api}/src/health/` — readiness gates each new database with `SELECT 1`; liveness alone is insufficient.
- `viewpro-app/apps/viewpro-api/src/platform-data/` and `viewpro-app/apps/viewpro-web/src/features/platform-sync/` — demand-only synchronization, visible freshness, idle quietness, failure state, and rollback compatibility.
- `.github/workflows/db-backup.yml` — current direct-URL secrets and fixed old prefixes would mix generations; new lineage needs generation-specific prefixes and a first successful fresh backup.
- Dokploy `inmoview-api` and `viewpro-platform-api` environments — own backend pooled/direct URLs and backend secrets; updates are per application, not cross-service atomic.
- Vercel product and operator projects — product middleware shares the product `ACCESS_TOKEN_SECRET`; the operator frontend has no database secret. Environment changes take effect through new deployments, not atomically with Dokploy.
- GitHub Actions secrets — backup direct URLs must move to the fresh read-only roles without exposing values or deleting the retained old lineage.
- R2, Sentry, and Resend — retained external histories/objects are not part of the database reset and require explicit retention statements rather than deletion.

### Approaches
1. **Two fresh projects in the current Neon organization** — Provision one product and one platform project, migrate both, seed only the platform operator, release the no-poll backend candidate against old URLs first, then perform a controlled blue/green URL cutover.
   - Pros: Smallest identity and access expansion; clean per-project usage evidence; no restore complexity; preserves old projects for one month.
   - Cons: Blocked until current project slots and independent Free allowances are confirmed; provider limits may make two simultaneous old-plus-new pairs impossible; secret changes are not globally atomic.
   - Effort: Medium

2. **Two fresh projects in a new Neon organization/account** — Use the same migrations-only/product and migrations-plus-operator/platform bootstrap in a separately governed Free organization.
   - Pros: Strong usage and lineage separation; may avoid current-organization slot contention.
   - Cons: Requires explicit Neon policy approval, new account recovery/MFA/ownership controls, more secret and billing surfaces, and proof that this is not quota circumvention; it does not improve application cutover atomicity.
   - Effort: High

3. **Isolated one-month demo environment before live cutover** — Deploy the corrected stack against fresh non-production projects and observe it for one month before creating or cutting production.
   - Pros: Lowest immediate production risk and useful preflight evidence.
   - Cons: Does not satisfy #327 D.5, which requires the deployed production projects; demo traffic and idle patterns are not production evidence; duplicates provisioning and delays readiness by at least a month.
   - Effort: High

4. **Wait for the 2026-09-01 reset and reuse old projects** — Deploy #327 before reset, then continue with the existing projects.
   - Pros: No new provider identity, URLs, or backup lineage; lowest configuration effort.
   - Cons: Not a clean bootstrap, retains disposable rows, delays recovery, risks immediate renewed consumption if old polling reaches the reset projects, and removes the old-project rollback boundary if data is cleared in place.
   - Effort: Low

Transfer and restore are rejected for the stated goal. Transfer retains project identity, credentials, URLs, and data while moving usage/billing. Restore deliberately reintroduces abandoned rows and invokes #290 PR2c controls; neither produces a clean no-restore baseline.

### Recommendation
Use Approach 1, conditional on written/live-console confirmation that the current organization can hold four projects during the one-month window and that each fresh project receives an independent 100-CU-hour allowance. Use Approach 2 only if Approach 1 is impossible and Neon explicitly confirms the new organization/account arrangement is policy-compliant. Approach 3 may be an optional rehearsal but cannot replace production evidence. Reject Approach 4 because it conflicts with the clean baseline and preserves the current ambiguity.

The safe sequence is backend-first and generation-aware:

1. Freeze public/business writes and record redacted fingerprints for old projects, current images, environment revisions, backup prefixes, and rollback ownership. Retain the old projects and old-generation backups for the full one-month rollback/evidence window; do not let the current 30-day pruning job shorten that retained lineage, and require separate authority for disposition afterward.
2. Provision both fresh projects without traffic. Apply each repository's migrations through privileged direct URLs; seed only the platform operator. Prove migration parity, cursor `0`, exactly the intended operator baseline, product empty-state invariants, and 200 readiness through isolated deployment candidates.
3. Before any fresh URL is assigned or fresh production traffic is permitted, close #327 release gaps: a real visible projection proof within ten seconds (the current fake-clock test proves query invalidation, not matching rendered data), a deterministic elapsed-time idle test asserting zero feed/cursor/projection/database calls, sanitized synchronization-failure logging/Sentry capture plus an actionable alert, and an executable rollback receipt.
4. Promote the reviewed `develop` candidate to `main` through the controlled product-API release path and prove the no-poll `viewpro-api` image/digest and singleton topology while it still references the old generation. Auto-deploy behavior for both Dokploy and Vercel must be controlled so an old backend cannot restart against fresh URLs. No fresh production traffic may begin until this corrected-code deployment is proven.
5. Stage redacted, versioned environment sets. Rotate the platform `ACCESS_TOKEN_SECRET` and `STEP_UP_TOKEN_SECRET`; rotate the product `ACCESS_TOKEN_SECRET` in coordinated Dokploy/Vercel deployments. Product refresh tokens disappear with the old database, but rotating access secrets deliberately invalidates all old JWT cookies, including platform JWTs that `/auth/me` accepts without a database lookup. Keep `PLATFORM_CONTROL_SECRET` unchanged unless independently compromised, because rotating it adds a cross-backend atomicity dependency.
6. Cut the product backend to its fresh pooled runtime URL, then the platform backend to its fresh pooled runtime URL, with direct URLs retained only for controlled migration/backup roles. Gate each step on image identity, liveness, readiness, no-poll evidence, and redacted configuration fingerprints. Release frontends only after backend readiness; mixed-version compatibility is a safety net, not the normal sequence.
7. Run operator login, product self-registration, demand synchronization, visible ≤10s proof, R2 upload persistence, Resend, and Sentry smoke checks. Start new generation-specific backup prefixes and require one successful backup plus heartbeat before ending the maintenance window.
8. Begin #327 D.5 only after the corrected production deployment and fresh URL cutover. D.4 authorizes that release; D.5 then requires at least 24 hours and may close #327 if projected usage is ≤10 CU-hours/project. The maintainer's commercial gate is stricter: retain a full month of raw per-project CU, autosuspend, scheduled activity, and demand evidence before considering Launch. D.5 and the one-month cost decision are related but not equivalent.

Rollback has two boundaries. Before the first new product/business write, restore the complete old environment generation as a paired image-plus-URL action; never run a timer-bearing image against fresh projects. After the first new business write, reverting database URLs would lose those writes and is prohibited without explicit reconciliation/export authority; prefer roll-forward. The operator seed and migration ledger are bootstrap writes, but the irreversible business boundary begins when traffic is allowed to create product or operator activity beyond that baseline.

The review forecast is High for the overall delivery and exceeds the 400-line budget even if the operational change is mostly configuration. Keep the current single-PR default only for a planning-only artifact under 400 changed lines. Implementation should be sliced into independently reviewable work units: #327 proof/observability remediation, backup-lineage and runbook changes, release candidate/secret choreography, and the sanitized cutover/evidence receipt. Stop and re-slice any PR forecast at 390 lines; no size exception is justified.

### Risks
- Neon Free project count and organization/account policy are not reliably established by current documentation; provisioning must stop until confirmed.
- Dokploy, Vercel, and GitHub secret stores have no shared atomic transaction. A redacted version/fingerprint manifest and per-step rollback owner are mandatory.
- Production auto-deploy from `main` can race backend-first sequencing unless deployment triggers are explicitly controlled and receipts prove the running digest.
- The current #327 visible test proves invalidation at `t0+9s`, not actual matching projection render; idle proof is structural rather than an elapsed-time zero-I/O oracle.
- Synchronization failures are converted into in-memory status and UI state; caught failures currently do not reach the global Sentry exception filter, and no dedicated alert was found.
- Reusing current R2 backup prefixes would mix old and fresh database generations and make retention/rollback ambiguous.
- Old R2 document/image objects become orphaned after row abandonment; deleting them is out of scope and requires later explicit authority.
- Rotating the product access secret requires coordinated backend and Vercel middleware deployment; rotating only one side causes temporary session rejection.
- A stale or misapplied environment generation can cross-connect product/platform or production/demo lanes; target denylist checks and redacted endpoint fingerprints must gate every activation.
- Rolling back to old projects is not currently a healthy recovery path while their compute is suspended; after new writes it also becomes a data-loss path.
- A one-month demo cannot substitute for production D.5 evidence, and a 24-hour D.5 pass cannot substitute for the maintainer's one-month cost decision.
- The optional `security-review` skill is unavailable in the confirmed registry/filesystem. This exploration therefore applied repository/runbook-based security analysis directly; the missing optional skill is a non-blocking tooling fallback, not a phase or security-gate waiver.

### Ready for Proposal
Yes, conditionally. The proposal may formalize Approach 1 with Approach 2 as a provider-approved fallback, but it must encode hard stop gates for provider slots/policy, deployment-trigger control, target roles/grants, #327 proof and alert remediation, redacted secret-version receipts, first fresh backup, and the pre-write/post-write rollback boundary. It must keep #290 paused and must not authorize provisioning, cutover, or any external mutation.
