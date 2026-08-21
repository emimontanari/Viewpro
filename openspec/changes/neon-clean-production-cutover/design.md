# Design: Neon Clean Production Cutover

## Technical Approach

Preserve issue #340's seven WUs with one autonomous WU3 tooling/schema slice. WU3 qualifies an operator-supplied detached clean repository in a disposable isolated worktree; it never writes a populated manifest or grants provider authority. After WU7, operators may assemble provisionally and independently reproduce identities/digests before authorized promotion.

## Architecture Decisions

| Decision | Choice and rationale |
|---|---|
| Delivery | WU1→WU7 target `develop` from live `origin/develop`; review, green CI, merge, fetch, and overlap audit precede each successor. WU3 is 330–350; pause before >350; 390 is a hard stop, not continuation permission. |
| Identity | Versioned config pins `main@868dc70a025d208fd4d1f7ece52640cc92187e1e`, ordered #331 `b61798a9368c7930b8e4c716bd6b1458a946375e`, #333 `02b89779aff2e122deaff816c4d12d72a9bb90fd`, #334 `d70b905050d87d75803a5fdc620650714f8139e2`, #335 `e2d4c271a5dc4818e0b80ce207aa90d29e1005f8`, #336 `adc274b0e08e2034d982e4d250db3886612684d3`, WU1 `faf870ab0a29e6a271b7391776fc2f9cf25c12ac`, WU2 `d53a57c04f34efd20fc825aff5c03115c9c6c99f`, then ordered reviewed WU3–WU7 placeholders. It excludes #338/#341/#344/#351 and #314; `3212c438f0ef5be886b090478acfba3a38d64102` is closure metadata only. Exact commit/tree and digest reproduction remain authoritative. |
| Lean implementation | Use Node 22 built-ins and `node:test`; add no Vitest, AJV, dependency, or lockfile churn unless implementation proves a strict necessity and is replanned. Handwritten closed validators are viable for the small versioned contracts. |
| Trust boundary | Precondition: operator-created isolated worktree, trusted local Git metadata, and no hostile same-user mutation. Require canonical root, `shell:false`, internal args, scrubbed `GIT_*`, disabled hooks/fsmonitor/replacement, and porcelain-v2 `-z` cleanliness; independent post-WU7 reassembly is final defense. |

## Data Flow

```text
versioned config + explicit repo/expected commit/tree
  → closed identity/object/order/state checks
  → NUL final-tree + schema/template checks
  → qualification result only
  → post-WU7 provisional assembly → independent reassembly/digests
  → Step1 Freeze → Steps2-3 → closure/receipts → Steps4-10
```

## Authorizations and Ordered Activation

The ten-step sequence executes once. Step1 Freeze is the local fail-closed precondition and rollback boundary. Obtain and consume fresh single-use provisioning authority for Steps2 Bootstrap and3 Staging exactly once. After Step3 readiness/receipts and independent closure, obtain and consume separate fresh single-use activation authority and resume—not restart—the same sequence at Step4 through10. Neither authority is reusable; failure/retry requires fresh correctly scoped authorization.

1. **Freeze** — freeze writes; retain rollback lineage.
2. **Bootstrap** — migrate fresh Product/Platform projects; seed only platform operator.
3. **Staging** — stage redacted environments; prove readiness.
4. **Secret rotation** — rotate product/platform access and step-up secrets; invalidate old JWTs/cookies and abandoned refresh/reset/verification tokens; reject cross-generation writes; keep `PLATFORM_CONTROL_SECRET` unchanged unless separately authorized.
5. **Product backend** — cut to the fresh pooled URL after image/readiness gates.
6. **Platform backend** — cut to its fresh pooled URL after the same gates.
7. **Frontends** — release after both are ready.
8. **Fresh login/session validation** — verify operator login, registration, and old-session rejection.
9. **Backups/heartbeats** — start generation-specific backups; require both receipts.
10. **Checkpoint/resume** — record the external receipt; any missing receipt or failed step stops and requires fresh scoped authorization.

## File Changes

| File | Action | Description |
|---|---|---|
| `viewpro-app/scripts/production-cutover/candidate.v1.json` | Create | Prefix, exclusions, closure metadata, future-WU placeholders. |
| `viewpro-app/scripts/production-cutover/candidate.mjs` | Create | Qualification, final-tree classifier, validators, bounded runner. |
| `viewpro-app/scripts/production-cutover/candidate.spec.mjs` | Create | Node unit/local-Git tests. |
| `viewpro-app/scripts/production-cutover/release-manifest.v1.schema.json` | Create | Populated external-manifest contract. |
| `viewpro-app/scripts/production-cutover/release-manifest.v1.template.json` | Create | Unpopulated; cannot satisfy closure. |
| `.github/workflows/ci.yml` | Modify | Deterministic no-network WU3 tests; preserve #351 and job order. |

No package or lockfile change is planned.

## Interfaces / Contracts

Tool input is `{repository, config, expectedCommit, expectedTree}`. Closed validation rejects missing/non-commit, duplicate/reordered/stale/unauthorized identities, absent objects, detached HEAD/tree mismatch, and non-final-tree `git ls-tree -r -z` classification. It distinguishes regular, executable, symlink, and submodule modes; rejects disguises, hidden/optional dependencies, #314, excluded patches, and populated manifests. The schema closes prefix/WU1–WU7 identities, commit/tree and full-tree/runtime/image digests, tool/schema versions, private receipts, and unknown fields; the template carries none.

Normal subprocess failures—spawn, nonzero, signal, timeout, excess output—fail closed. TERM→KILL timeout requires confirmed close/drain and clears buffers, listeners, and timers.

## Threat / RED Matrix

| Boundary | Applicability and RED proof |
|---|---|
| Repository/commit/process | **Applicable**: canonical selection, detached exact commit/tree, porcelain-v2 NUL cleanliness, selector/config injection denial, and bounded failure cleanup (RED-CUT-01/02/04). |
| Final-tree/classifier/contracts | **Applicable**: robust malformed-NUL tests; symlink/submodule/executable modes; named disguises; hidden/optional dependency, #314, excluded patch, populated-manifest, exact remediation, complete schema, and unpopulated template cases (RED-CUT-03). |
| Hostile concurrent same-user mutation; Git replacement after preflight | **N/A**: the approved operator-controlled disposable worktree is the precondition. |
| Persistent descriptor capabilities; crash scavenging | **N/A**: no such capability store or lifecycle exists. |
| Push/PR/provider commands | **N/A**: WU3 performs none. |

## Testing Strategy

`node:test` covers validators and fake-process failures; local repositories cover detached/dirty/object/order/tree/NUL behavior. CI no-network; preserves #351/job order.

## Migration / Rollout

No migration. Forecast: seven WUs, 2,230–2,430 total; WU4 (330–350) follows WU3. Attempts 5 (`e448…`) and 6 (`666…`) remain failed evidence. Reset follows this PR in a fresh WU3 worktree with approval.

## Open Questions

None. Proposal/spec amendment: **No**; approved boundaries unchanged.
