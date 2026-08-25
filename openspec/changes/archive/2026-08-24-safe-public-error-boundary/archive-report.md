# Archive Report: Safe Public Error Boundary

**Change**: `safe-public-error-boundary`
**Archived**: 2026-08-24
**Archived to**: `openspec/changes/archive/2026-08-24-safe-public-error-boundary/`
**Artifact store**: hybrid (OpenSpec files + Engram)
**Branch at close**: `chore/safe-public-error-boundary-operations`
**Reviewed SHA**: `c343ddee267ced73349c0405dadbae242a3ac212`
**Status at close**: closed, complete

## Final State (authoritative at close)

This section is the terminal record. `apply-progress.md` and `verify-report.md`
are intermediate snapshots and are superseded wherever they disagree.

| Fact | Final state | Source |
|---|---|---|
| Tasks | 14/14 complete, 0 unchecked | native `sdd-status`, archived `tasks.md` |
| Apply | `all_done` | native `sdd-status` |
| Verify | `all_done`, verdict `pass_with_warnings` | native `sdd-status`, verify-report |
| Requirements / scenarios | 5/5, 9/9 | verify-report |
| Blockers / CRITICAL findings | 0 / 0 | verify-report |
| `blockedReasons` | empty | native `sdd-status` |
| `reviewGate` | structurally absent | native `sdd-status` |
| Operations 4.1-4.3 | complete | orchestrator final-state facts |
| Issue #356 (`emimontanari/Viewpro`) | already closed as completed | orchestrator final-state facts |

### Review gate

Receipt-driven review is disabled for this clone, so `reviewGate` is structurally
absent from native status. Zero review code ran for this candidate; there is no
receipt to validate and nothing to block on. Archive proceeded under ordinary
repository policy. No review was started, enabled, or worked around.

### Operations closure (supersedes intermediate snapshots)

Operations 4.1-4.3 ran against an isolated, ephemeral deployed candidate built
from reviewed SHA `c343ddee267ced73349c0405dadbae242a3ac212`. The candidate was
fully torn down afterwards: route, application, environment, project, and the
temporary branch `candidate/356-c343ddee` were all deleted, and the endpoint no
longer resolves. No production resource was changed.

Deployed smoke results:

| Switch state | Body keys | Correlation |
|---|---|---|
| unset | `error,message,path,requestId,statusCode,timestamp` (legacy) | attacker `x-request-id` replaced with a fresh lowercase UUID v4; 3 distinct ids; header id equals body id |
| `false` | `error,message,path,requestId,statusCode,timestamp` (legacy) | same |
| `true` | exactly `errorCode,requestId,statusCode`, `errorCode` = catalog member `REQUEST_FAILED` | same |

Switch-off-first rollback was proven after the enabled state.

Because the candidate was torn down before verification began, `verify-report`
recorded the deployed half of 4.1-4.3 as operator-attested (SUGGESTION 4). At
close those operations are recorded as COMPLETE per the orchestrator's explicit
final-state facts. The reproducible half — the three-state local API matrix, both
consumer suites, and all three type-checks — was independently re-executed during
verification and passed (147 test executions, 0 failures; test and build exit
codes 0).

### Resolved since verification

`verify-report` WARNING 1 stated that Engram held only the `proposal` topic for
this change. That warning is STALE and RESOLVED: all artifact topics were
backfilled to current bytes before archive (IDs below). Do not treat it as an
outstanding gap.

## Artifact Lineage

### OpenSpec (archived paths)

| Artifact | Path |
|---|---|
| proposal | `openspec/changes/archive/2026-08-24-safe-public-error-boundary/proposal.md` |
| spec (delta) | `openspec/changes/archive/2026-08-24-safe-public-error-boundary/specs/safe-public-error-boundary/spec.md` |
| design | `openspec/changes/archive/2026-08-24-safe-public-error-boundary/design.md` |
| tasks | `openspec/changes/archive/2026-08-24-safe-public-error-boundary/tasks.md` |
| apply-progress | `openspec/changes/archive/2026-08-24-safe-public-error-boundary/apply-progress.md` |
| verify-report | `openspec/changes/archive/2026-08-24-safe-public-error-boundary/verify-report.md` |
| archive-report | `openspec/changes/archive/2026-08-24-safe-public-error-boundary/archive-report.md` |

### Engram observation IDs (project `viewpro`)

| Topic | Observation ID |
|---|---|
| `sdd/safe-public-error-boundary/proposal` | #8170 |
| `sdd/safe-public-error-boundary/spec` | #8175 (topic-keyed); duplicate untopic-keyed copy #8540 |
| `sdd/safe-public-error-boundary/design` | #8178 |
| `sdd/safe-public-error-boundary/tasks` | #8267 |
| `sdd/safe-public-error-boundary/apply-progress` | #8273 |
| `sdd/safe-public-error-boundary/verify-report` | #8538 |
| `sdd/safe-public-error-boundary/archive-report` | this report |

Note: two Engram observations carry the title `sdd/safe-public-error-boundary/spec`.
#8175 holds the `topic_key` and is canonical. #8540 was written later by the
verify session without a `topic_key`; its content was compared and is identical
to #8175. Recorded rather than deleted; the archive never mutates history.

## Specs Synced

| Domain | Action | Details |
|---|---|---|
| `safe-public-error-boundary` | Created | Full spec (no ADDED/MODIFIED/REMOVED/RENAMED sections); 5 requirements, 9 scenarios copied verbatim |

Source of truth updated: `openspec/specs/safe-public-error-boundary/spec.md`.

The delta artifact is a complete spec, not a delta, and no main spec existed at
that path, so the file was copied mechanically with `cp` and verified with an
empty `diff -r`. SHA-256 of both source and destination:
`4a45e8a1543151062bcfa3f2116869f177d10f03c978b05c4c4a3ea9417547ff`.

No existing main spec was modified or removed. The sibling capability
`openspec/specs/public-error-runtime-contract/spec.md` (predecessor change) was
left untouched.

## Mechanical Copy Evidence

All copies and moves used shell commands only (`cp`, `cp -R`, `git mv`). No file
content passed through a model Read/Write path.

- Step 2 (`diff -r` delta spec vs. main spec): empty, exit 0.
- Step 3 (`diff -r` pre-move recursive snapshot vs. archived folder): empty, exit 0.

## Preserved Local File

`openspec/changes/safe-public-error-boundary/exploration.md` was deliberately
EXCLUDED from the archive move by explicit orchestrator instruction. It is
pre-existing untracked local research and remains at its original path,
untracked and byte-identical (SHA-256
`c3a8b64f8961cb966b71ee5d2e32436028be96043421acc53ece5562e43da4e0`, unchanged
before and after). It was excluded from the Step 3 snapshot comparison for that
reason. Consequently the active change directory still exists on disk as a
container for that one untracked file; every SDD artifact has left it.

## Follow-ups (out of scope, deliberately deferred)

Deferred by the spec's "Explicit scope" clause. None is a defect of this change
and none was fixed here.

1. `viewpro-app/apps/viewpro-api/src/common/middleware/request-id.middleware.ts:9-10`
   still trusts an inbound `x-request-id` (`incomingRequestId?.trim() || randomUUID()`),
   unlike `apps/api`'s unconditional `randomUUID()`. Residual correlation-pinning
   surface on the sibling service.
2. `viewpro-app/apps/viewpro-web/src/lib/api-client.ts:168-180` still returns
   `details: body` plus server prose. Track alongside the ten feature parsers and
   57 BFF forwarders already listed as deferred.
3. Wording nit only, no code change needed: `tasks.md` task 3.2 says "production
   disabled". `apps/api/src/bootstrap/create-app.ts:43-45` has no `NODE_ENV`
   branch — production is off because the flag defaults to `false` when unset,
   which is exactly what the spec requires.

Also deferred by design and unchanged: actionable auth/invitation codes;
invitation/session/credential behavior; full Sentry/logging redesign; CI, root
package metadata, and cutover surfaces; #340/WU3a.

## Contradictions

None unresolved. The only conflict between sources — `verify-report` WARNING 1
(Engram incomplete) versus the orchestrator's final-state backfill facts — is
ranked and resolved above in favour of the higher-ranked launch-prompt facts,
corroborated by the observation IDs retrieved during this archive phase.

## SDD Cycle Complete

Planned, specified, designed, tasked, applied, verified, and archived.
