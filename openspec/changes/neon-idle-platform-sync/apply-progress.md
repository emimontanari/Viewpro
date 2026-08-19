# Apply Progress: Slice A — complete (attempt 2 correction)
## Scope
- `slice-a-coordinator-timeout` (A.1–A.3); timer retained; no B–D, payload, DB cancellation, or multi-replica scope.
## Preserved history
- Attempt 1 blocked: `pnpm --filter @viewpro/platform-api test -- src/platform-data/__tests__/platform-data-poll-job.spec.ts` exited 1 before tests because frozen install omitted generated `@prisma-platform/client`; lockfile unchanged.
- Prior attempt-2 RED: six stale `undefined` assertions failed against the discriminated outcome contract.
## TDD Cycle Evidence
| Task | Safety net | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| A.1 | 589 prior tests passed | `vitest ...change-feed... --testTimeout=1000`: stalled body timed out | 26 feed; 36 coordinator/poll/feed | timeout cleanup moved to body `finally` |
| A.2 | same | Prior RED preserved; correction adds no fabricated RED | real `IngestService` projection/cursor stages pass | outcome coverage consolidated |
| A.3 | same | Prior RED preserved | timer/coordinator suite passes | scope checked |
## Work Unit Evidence
| Focused | `vitest`: coordinator/poll/feed 36; ingest/audit 39; module DI 1 passed. |
| Runtime | N/A: process-local coordinator; real `IngestService` seam exercises durable-stage outcomes. |
| Rollback | Revert only Slice-A platform-data coordinator/client/ingest/job/module and tests. |
## Verification
- GREEN: `pnpm --filter @viewpro/platform-api typecheck` and `git diff --check` passed.
- Refactor/scope: no timer removal, payload validation, DB cancellation, or multi-replica work.
## Candidate Evidence
- Changed lines: 338 additions plus deletions; A.1–A.3 checked, B–D unchecked.
- Candidate method: SHA-256 of `git diff --binary --full-index b61798a9368c7930b8e4c716bd6b1458a946375e -- . ':(exclude)openspec/changes/neon-idle-platform-sync/apply-progress.md'` followed by sorted untracked `git diff --binary --full-index --no-index /dev/null <file>`, excluding this file.
- Candidate diff SHA-256: `2e638c507659bcf17b184df919f01a2475c19d9ee45cba09779349c97d0c1b27`.
- Canonical payload (UTF-8, exact shown bytes plus one LF): `{"attempt":2,"attemptToken":"sha256:3bf68b28efa07273038ecb2ffd12eb626319df16724347b5630065ff7615d9bf","base":"b61798a9368c7930b8e4c716bd6b1458a946375e","candidateDiff":"sha256:2e638c507659bcf17b184df919f01a2475c19d9ee45cba09779349c97d0c1b27","red":"stalled-body:1 failed timeout","green":"feed:26;coordinator-poll-feed:36;ingest-audit:39;module:1;typecheck;diff-check","changedLines":338}`.
- Evidence SHA-256: `082465c946b0be20b919d6c118a074e00743dcda73e3b0e096899b8f3809c982`; distinct from failed attempt-1 `sha256:d18a2e9403d5a383791c88a67ccef24d97bc2503a6de8d1c2c9ca0e66703e8bd`.
