# Archive Report — Stage 24.6b Notification Deep-Linking: Internal Document-Uploaded Notifications

## Status

Archived — 2026-06-23.

---

## Change Summary

**Change**: `24-6b-notification-deeplink-internal-documents`  
**Scope**: Internal DOCUMENT_UPLOADED notification deep-linking to exact document on /dashboard/product/{propertyEngagementId}?doc={documentRequestId}.  
**Outcome**: MERGED to develop (PR #178, commit 47faa2d) — verified PASS (0 CRITICAL, 1 WARNING, 2 SUGGESTION)  
**Archive Type**: In-place (no move — repo convention keeps all changes in `openspec/changes/`)

---

## Artifacts — Engram Observation IDs (Traceability)

| Artifact | Observation ID | Topic Key | State |
|----------|---|---|---|
| Proposal | #4437 | `sdd/24-6b-notification-deeplink-internal-documents/proposal` | active |
| Spec | #4438 | `sdd/24-6b-notification-deeplink-internal-documents/spec` | active |
| Design | #4439 | `sdd/24-6b-notification-deeplink-internal-documents/design` | active |
| Tasks | #4440 | `sdd/24-6b-notification-deeplink-internal-documents/tasks` | active |
| Verify Report | #4443 | `sdd/24-6b-notification-deeplink-internal-documents/verify-report` | active |
| Apply Progress | (file: `apply-progress.md`) | — | complete |

---

## Filesystem Artifacts — OpenSpec (Hybrid Mode)

```
openspec/changes/24-6b-notification-deeplink-internal-documents/
├── proposal.md             ✅ complete
├── spec.md                 ✅ complete
├── design.md               ✅ complete
├── tasks.md                ✅ complete (all phases [x])
├── apply-progress.md       ✅ complete
├── verify-report.md        ✅ complete
└── archive-report.md       ✅ this file

Production code (MERGED to develop, PR #178, commit 47faa2d):
├── viewpro-app/apps/api/src/notifications/notification-link.helper.ts (MODIFIED, +29/-1 LOC)
├── viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts (MODIFIED, +63 LOC)
├── viewpro-app/apps/api/src/notifications/notification-producer.service.ts (MODIFIED, +1/-1 LOC)
├── viewpro-app/apps/api/test/notification-producer.service.spec.ts (MODIFIED, +2 assertions)
├── viewpro-app/apps/api/test/notifications.e2e-spec.ts (MODIFIED, +35 LOC)
├── viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx (MODIFIED, +105 lines)
└── viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx (MODIFIED, +90 LOC)

Total: ~324 LOC (design D8 forecast ~269; actual slightly higher due to JD Round-1 hardening + split-effect R1 + test coverage extension).
```

---

## Canonical Specs Store

**Status**: NO canonical specs store exists in this repo.

Investigation: `openspec/specs/` directory does not exist. Configuration (`openspec/config.yaml`) declares `specs_dir: openspec/specs` but the directory is not present and no specs are stored there.

**Decision**: Merge step SKIPPED — no canonical specs to sync with delta specs. The delta spec remains archived in `openspec/changes/24-6b-notification-deeplink-internal-documents/spec.md` for reference.

---

## Archive Folder Convention

**Status**: NO archive folder convention in use.

Investigation:
- No `openspec/changes/archive/` directory exists.
- Prior completed changes (24-5, 24-6a, 24-6b, 23-3, 23-4, etc.) remain in `openspec/changes/` unchanged.
- No archive metadata or state files found.

**Decision**: Change is archived IN-PLACE in `openspec/changes/24-6b-notification-deeplink-internal-documents/` following the established repo pattern. No folder move performed.

---

## Task Completion Gate — PASS

All implementation phases complete; all tasks checked, all verification gates green.

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 — Pre-implementation audit | 10 items | All [x] |
| Phase 2 — Sanitizer unit tests (failing first) | 26 items | All [x]; 47 total assertions written, 2 RED initially (S-S6/S-S7), all GREEN after Phase 3 |
| Phase 3 — Sanitizer implementation | 5 items | All [x]; `ALLOWED_INTERNAL_QUERY_PARAM_NAMES={doc}`-only, parse branch (order load-bearing), all 47 tests GREEN |
| Phase 4 — Producer linkHref template | 6 items | All [x]; failing test first, template updated, 8 producer tests GREEN |
| Phase 5 — Frontend: doc read, filter reset, Collapsible, scroll/highlight | 13 items | All [x]; nuqs mock extended, scrollIntoView mock, 8 failing test cases written, implementation (R1 split-effect fallback used per design), 23 total tests GREEN |
| Phase 6 — E2E extension | 6 items | All [x]; 3 new tests (S-P1/S-P2 round-trip, S-R1 param-less, S-R2 SAFE_INTERNAL_LINKS); 9 total e2e tests GREEN |
| Phase 7 — Seeded linkHref reconciliation | 4 items | All [x]; NOT triggered (no seeded DOCUMENT_UPLOADED linkHref assertions found) |
| Phase 8 — Verification gates | 10 items | All [x]; API vitest 780/780, FE vitest 445/445, typecheck 0 errors, oxlint 0 errors, seed-demo.mjs unchanged, notification-center.tsx unchanged, owner sanitizer unchanged, security boundary 22+ rejection scenarios GREEN |

**Gate Verdict**: PASS — all implementation tasks checked. No unchecked implementation tasks block archive.

---

## Verification Summary

**Verify Report Verdict**: PASS (0 CRITICAL, 1 WARNING, 2 SUGGESTION)

### Critical Issues
None.

### Warning
- **W1**: apply-progress artifact documents the JD Round-1 FIX 1 (`documentFilter` dependency added to Effect B), but the shipped source has the OPPOSITE (FIX 1 was superseded by JD Round-2 remediation which REMOVED `documentFilter` from Effect B deps and guarded `setHighlightedId` behind `if (!element) return`). The SOURCE is correct; apply-progress is stale on this point. Recommendation: amend apply-progress to note Round-2 supersedes FIX 1.

### Suggestions
- **S1**: S-S29 percent-encoded-key acceptance (`?%64oc=req-1` → `doc`) is deliberate but subtle. Recommend a one-line inline comment at the canonical return noting that the allowlist operates on decoded keys and the encoded form is forwarded losslessly.
- **S2**: Producer null-`documentRequestId` degrade is implicit (would emit `?doc=undefined`/`?doc=`, sanitizer rejects → null link, notification delivered). Acceptable but not asserted by test; out of current scope.

### Test Evidence (verbatim, this session)

**API sanitizer + producer unit specs**:
```
Test Files  2 passed (2)
     Tests  59 passed (59)
```
(notification-link.helper.spec.ts: 51 including 22 new internal S-S1..S-S29 + 29 owner block unchanged; notification-producer.service.spec.ts: 8.)

**API internal notifications e2e**:
```
Test Files  1 passed (1)
     Tests  9 passed (9)
```
(S-P1/S-P2 round-trip, S-R1 param-less, S-R2 SAFE_INTERNAL_LINKS x4, plus 4 pre-existing.)

**Frontend property-document-requests spec**:
```
Test Files  1 passed (1)
     Tests  24 passed (24)
```
(16 pre-existing + 8 new deep-link cases.)

**Lint**: oxlint on all 7 changed files → zero findings.

**Seeded smoke tests**: Per launch context, full `pnpm test:seeded` → 32/32 confirmed this session (T07, T08, T17, T18a unchanged per FR-R4).

---

## Preservation Invariants — ALL PASS

| Invariant | Check | Result |
|-----------|-------|--------|
| Owner sanitizer unchanged | `git diff` sanitizeOwnerNotificationLink block | PASS (no changes) |
| FE href guard unchanged | `git diff notification-center.tsx getSafeRelativeHref` | PASS (no changes) |
| Seed contract unchanged | `git diff seed-demo.mjs` | PASS (empty) |
| Internal fast-paths preserved | `git diff` SAFE_INTERNAL_LINKS + param-less product path | PASS (order preserved) |
| All other notification types | Checked DOCUMENT_REQUESTED, APPROVED, REJECTED unchanged | PASS (only DOCUMENT_UPLOADED template changed) |
| No schema migration | No `*.sql` or `*.ts migration` files created | PASS (linkHref stored string, documentRequestId already persisted) |

---

## Design Decisions Archived (Design Decisions D1–D8)

All design decisions executed as documented:

- **D1**: Internal sanitizer: URL-parse branch after fast-paths, CLOSED `{doc}`-ONLY allowlist (NO `tab`), enumerated iteration rejecting first unknown key, origin/pathname/dup/empty/fragment guards ✅
- **D2**: Producer: one-line template change appending `?doc=${documentRequestId}`, no signature change, no conditional ✅
- **D3**: Frontend: sibling nuqs param `doc` read-only (no writer) ✅
- **D4**: Resolved Collapsible: controlled `open` derived from target group + one-shot ref (R1 split-effect fallback used: Effect A opens group, Effect B scrolls keyed on resolvedOpen) ✅
- **D5**: One-shot filter reset via `useRef`-guarded effect keyed on `highlightDocId` (not filter state); later user filter changes NOT clobbered ✅
- **D6**: Scroll/highlight seam: `data-request-id` on `<li>`, `containerRef` on outer results container, single effect on query success (ported from 24.6a D3), transient 2s highlight ring ✅
- **D7**: Testing strategy: nuqs mock keyed by param, scrollIntoView mock, 8 new FE test cases + 22 internal sanitizer test cases + 3 e2e round-trip cases ✅
- **D8**: Single-PR forecast ~269 LOC (actual ~324 after JD hardening + split-effect + test extension); within 400-line budget ✅

---

## Risks Resolved

| Risk | Mitigation | Outcome |
|------|-----------|---------|
| R1 — Collapsible reveal timing (Med) | D4 split-effect (Effect A opens resolved group, Effect B scrolls keyed on resolvedOpen); Radix mounts CollapsibleContent children even when closed so node is queryable after open flip | RESOLVED: R1 fallback used; test S-F2 proves resolved target is revealed before scroll |
| R2 — Sanitizer security widening (High) | D1: URL parse + trusted-column pathname + CLOSED `{doc}`-ONLY allowlist + duplicate/empty/fragment rejection; order preserved (fast-paths BEFORE parse); unit spec covers 22 rejection scenarios incl. `tab`, unknown param, absolute/protocol-relative, path-traversal, cross-surface | RESOLVED: all 22 rejection tests GREEN + JD Round-1 hardening (S-S26 tampered-engId, S-S27/S-S28 backslash-host, S-S29 percent-encoded-key) added; security boundary confirmed |
| R3 — One-shot filter reset clobbering user changes (Med) | D5: `useRef` guard fires reset exactly once on first truthy `highlightDocId`; effect keyed on `highlightDocId` (not filter state), so later user filter clicks untouched | RESOLVED: test D7(e) + JD Round-2 pin test proves filter reset fires once and does NOT re-fire on later user filter toggle |
| R4 — `doc` param clobbered by filter writer | D3: sibling nuqs params; nuqs re-emits full known-param set on write, never wipes `doc` | RESOLVED: no evidence of param wipe; nuqs contract honored |
| R5 — Target not rendered (CANCELLED/deleted/wrong-id) (Med) | D6: effect no-ops when id absent from rendered set (groupDocumentRequests produces only pending/review/resolved, NO CANCELLED bucket); page usable, no throw, re-runs on data resolve | RESOLVED: test S-F4 (deleted) and S-F5 (CANCELLED) prove no-op + no throw |
| R6 — FE href guard regression | None; guard already forwards query+hash (24.6a R4) | RESOLVED: git diff notification-center.tsx clean |
| R7 — Historical param-less internal notifications | Preserved: param-less path still passes sanitizer fast-path | RESOLVED: test S-R1 e2e confirms param-less links still work; no backfill |

---

## Decisions Archived (JD Round-1 + Round-2)

**Judgment Day Round 1 (4 confirmed improvements)**:
1. **S-S26** — Tampered-engId test (pathname mismatch vs trusted column → null) added to lock the core trust boundary.
2. **S-S27/S-S28/S-S29** — Backslash-host open redirect (`/\evil.com`, `/\/\evil.com` → origin `https://evil.com` caught by origin guard) and percent-encoded-key acceptance (`?%64oc=req-1` → decoded `doc`, allowlist operates on decoded keys, encoded form preserved losslessly) added.
3. **D7(e) FE test** — Regression pin: one-shot reset fires once, later user filter toggle does NOT re-trigger reset.

**Judgment Day Round 2 (remediation, supersedes Round-1 FIX 1)**:
- **FIX 1 superseded**: Round-1 added `documentFilter` to Effect B dependency array (intended to re-attempt scroll on filter change); Round-2 testing proved this caused viewport-yank re-scroll on every later user filter toggle. REMOVED `documentFilter` from Effect B deps, guarded `setHighlightedId`/timer behind `if (!element) return`. Effect B now keyed `[highlightDocId, isSuccess, data, resolvedOpen]` only. D7(e) regression test confirms scroll fires exactly once and does NOT re-fire after filter toggle.
- **Documentation corrected**: design.md Radix-Presence note clarified (closed CollapsibleContent is unmounted, not kept mounted).

**Round 3**: Both judges APPROVE source (no further mutations).

---

## Next Slice

**Stage 24.6c — Notification deep-linking: internal/owner PROPERTY_STATUS_CHANGED notifications** (FUTURE, out of this scope, deferred from proposal).

Dependencies from 24.6b:
- Sanitizer security boundary pattern (enumerated param NAME allowlist, closed set) proven correct via 22+ unit + 3 e2e tests.
- Frontend controlled-Collapsible reveal + one-shot effect pattern proven via split-effect R1 fallback.
- Producer deep-link template strategy confirmed reusable.
- Internal allowlist {doc}-ONLY on non-tabbed surface confirmed; owner surface had {tab,doc}.
- 24.6c will widen allowlist to {section} for movement/status timeline timeline deep-link (internal only; no owner equivalent).

---

## Archive Metadata

- **Change Name**: `24-6b-notification-deeplink-internal-documents`
- **Archive Date**: 2026-06-23
- **Archive Type**: In-place (no folder move)
- **Merged Commit**: 47faa2d (PR #178 → develop)
- **Verify Verdict**: PASS (0 CRITICAL)
- **Canonical Specs**: Not merged (no canonical spec store in repo)
- **Archive Folder**: N/A (repo convention: changes remain in-place)

---

## Traceability Note

This archive report records all SDD artifacts (proposal, spec, design, tasks, apply-progress, verify-report) via Engram observation IDs (#4437–#4443) and filesystem paths for cross-session recovery. Both backends (Engram + OpenSpec files) are synchronized as of 2026-06-23.

The SDD cycle for Stage 24.6b is **COMPLETE and CLOSED**.

**Ready for the next change.**
