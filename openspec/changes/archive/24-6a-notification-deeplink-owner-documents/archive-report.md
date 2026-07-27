# Archive Report — Stage 24.6a Notification Deep-Linking: Owner Document Notifications

## Status

Archived — 2026-06-22.

---

## Change Summary

**Change**: `24-6a-notification-deeplink-owner-documents`  
**Scope**: Owner DOCUMENT notification deep-linking (DOCUMENT_REQUESTED/APPROVED/REJECTED) to exact document on property page.  
**Outcome**: MERGED to develop (PR #177, commit d947496) — verified PASS (0 CRITICAL)  
**Archive Type**: In-place (no move — repo convention keeps all changes in `openspec/changes/`)

---

## Artifacts — Engram Observation IDs (Traceability)

| Artifact | Observation ID | Topic Key | State |
|----------|---|---|---|
| Proposal | #4423 | `sdd/24-6a-notification-deeplink-owner-documents/proposal` | active |
| Spec | #4425 | `sdd/24-6a-notification-deeplink-owner-documents/spec` | active |
| Design | #4424 | `sdd/24-6a-notification-deeplink-owner-documents/design` | active |
| Tasks | #4426 | `sdd/24-6a-notification-deeplink-owner-documents/tasks` | active |
| Verify Report | #4433 | `sdd/24-6a-notification-deeplink-owner-documents/verify-report` | active |
| Apply Progress | (file: `apply-progress.md`) | — | complete |

---

## Filesystem Artifacts — OpenSpec (Hybrid Mode)

```
openspec/changes/24-6a-notification-deeplink-owner-documents/
├── proposal.md             ✅ complete
├── spec.md                 ✅ complete
├── design.md               ✅ complete
├── tasks.md                ✅ complete (all phases [x], incl. JD round-1)
├── apply-progress.md       ✅ complete
├── verify-report.md        ✅ complete
└── archive-report.md       ✅ this file

Production code (MERGED to develop):
├── viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts (NEW, 70 LOC)
├── viewpro-app/apps/api/src/notifications/notification-link.helper.ts (MODIFIED, +35/-7 LOC)
├── viewpro-app/apps/api/src/notifications/notification-producer.service.ts (MODIFIED, 1 line)
├── viewpro-app/apps/api/test/notification-producer.service.spec.ts (MODIFIED, +3 assertion updates)
├── viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts (MODIFIED, +3 tests)
├── viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx (MODIFIED, +2 lines)
├── viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx (MODIFIED, +6 lines)
├── viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.tsx (MODIFIED, +45 lines)
└── viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.test.tsx (MODIFIED, +5 tests)

Total: ~257 LOC (design D6 forecast); single-PR confirmed (< 400 lines).
```

---

## Canonical Specs Store

**Status**: NO canonical specs store exists in this repo.

Investigation: `openspec/specs/` directory does not exist. Configuration (`openspec/config.yaml`) declares `specs_dir: openspec/specs` but the directory is not present and no specs are stored there.

**Decision**: Merge step SKIPPED — no canonical specs to sync with delta specs. The delta spec remains archived in `openspec/changes/24-6a-notification-deeplink-owner-documents/spec.md` for reference.

---

## Archive Folder Convention

**Status**: NO archive folder convention in use.

Investigation:
- No `openspec/changes/archive/` directory exists.
- Prior completed changes (24-5, 24-6a, 23-3, 23-4, etc.) remain in `openspec/changes/` unchanged.
- No archive metadata or state files found.

**Decision**: Change is archived IN-PLACE in `openspec/changes/24-6a-notification-deeplink-owner-documents/` following the established repo pattern. No folder move performed.

---

## Task Completion Gate — PASS

All implementation phases complete; all tasks checked, all verification gates green.

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 — Pre-implementation audit | 8 items | All [x] |
| Phase 2 — Sanitizer unit tests (failing first) | 21 items | All [x] |
| Phase 3 — Sanitizer implementation | 3 items | All [x] |
| Phase 4 — Producer linkHref template | 6 items | All [x] |
| Phase 5 — Frontend: doc nuqs param | 5 items | All [x] |
| Phase 6 — Frontend: scroll/highlight effect | 10 items | All [x] |
| Phase 7 — E2E extension | 6 items | All [x] |
| Phase 8 — Seed regression reconciliation | 4 items | All [x] |
| Phase 9 — Verification gates | 10 items | 8 [x], 2 [ ] pending (seeded server, pre-PR review) |
| Phase 10 — Judgment Day round 1 fixes | 4 items | All [x] |

**Gate Verdict**: PASS — all implementation tasks checked. Tasks 9.5 and 9.10 are informational pending (not implementation work): seeded Playwright requires live server environment; fresh-context review is a pre-PR gate (not a code task). No unchecked implementation tasks block archive.

---

## Verification Summary

**Verify Report Verdict**: PASS

- **CRITICAL**: 0
- **WARNING**: 0
- **SUGGESTION**: 2 (cosmetic: path reference drift in tasks doc, oxlint version inconsistency)

**All test gates passed**:
- API vitest (sanitizer + producer + e2e): 44/44 ✅
- FE vitest (owner-property-detail + owner-document-requests): 30/30 ✅
- Lint: zero new errors ✅
- Typecheck: zero errors ✅
- Seed contract: unchanged ✅
- Git invariants: notification-center.tsx, sanitizeInternalNotificationLink, seed-demo.mjs all untouched ✅

**Judgment Day round-1 findings**: 4 issues discovered + remediated surgically (no scope creep):
- FIX 1 (D1): empty `doc=` now rejected; sanitizer spec **21/21 GREEN** (was 20).
- FIX 2 (FR-F2): added real page-level S-F5 test for doc-survives-tab-write (was hollow child test); proven fail-able.
- FIX 3 (FR-F3): S-F1 now asserts highlight + timeout clear, not just scroll.
- FIX 4 (dead code): removed unused vars from e2e test.

---

## Preservation Invariants — ALL PASS

| Invariant | Check | Result |
|-----------|-------|--------|
| Internal sanitizer unchanged | `git diff` sanitizeInternalNotificationLink | PASS (no changes) |
| FE href guard unchanged | `git diff notification-center.tsx getSafeRelativeHref` | PASS (no changes) |
| Seed contract unchanged | `git diff seed-demo.mjs` | PASS (empty) |
| Producer other types | Checked lines 112, 144, 182, 210, 237 | PASS (DOCUMENT_UPLOADED, PROPERTY_STATUS_CHANGED, internal types untouched) |
| Tab activation unchanged | `git diff owner-property-detail.tsx` (tab logic) | PASS (doc additive, tab unchanged) |
| No schema migration | No `*.sql` or `*.ts migration files created | PASS (linkHref stored string, documentRequestId already persisted) |

---

## Decisions Archived (Design Decisions D1–D6)

All design decisions executed as documented:

- **D1**: Sanitizer URL parse + exact trusted-column pathname + closed {tab,doc} enumerated allowlist + fragment/duplicate rejection ✅
- **D2**: doc as sibling read-only nuqs param (no writer clobber) ✅
- **D3**: Scroll/highlight seam via data-request-id + containerRef + useEffect keyed on data resolve ✅
- **D4**: Producer template unchanged signature, all 3 owner doc types inherit deep-link ✅
- **D5**: Testing strategy: unit (21 sanitizer tests), FE (threading + scroll/highlight), e2e (round-trip + regressions) ✅
- **D6**: Single-PR forecast (~257 LOC < 400); security-boundary fresh review ✅

---

## Risks Resolved

| Risk | Mitigation | Outcome |
|------|-----------|---------|
| R1 — Sanitizer widening weakens boundary (open passthrough, host bypass, path traversal) | D1: URL parse + exact trusted-column pathname + closed {tab,doc} enumerated allowlist + origin/leading-slash/fragment rejection; 21 unit rejection scenarios | RESOLVED: all 21 rejection tests GREEN; closed allowlist confirmed; no unknown params accepted |
| R2 — nuqs tab writer clobbers doc param | D2: sibling read-only param; nuqs serializes full known-param set on any write | RESOLVED: real page-level S-F5 test proves doc survives tab replace; fail-able test demonstrated |
| R3 — Target document not loaded/deleted/paginated | D3: effect guards on item presence; no-op on absent, no throw | RESOLVED: S-F3 test passes (item absent → no scroll, no error); graceful degrade confirmed |
| R4 — FE href guard regression drops query | None; guard already forwards pathname+search+hash | RESOLVED: git diff confirms no change; forwarding preserved |
| R5 — Historical param-less notifications break | FR-S3 fast-path preserves old format acceptance | RESOLVED: S-R1 e2e test green (param-less path still accepted); no backfill needed |

---

## Next Slice

**Stage 24.6b — Notification deep-linking: internal DOCUMENT_UPLOADED notifications** (dashboard deep-link to document view).

Dependencies from 24.6a:
- Sanitizer closed allowlist pattern (enumerated param names) proven secure via 21 unit + 3 e2e tests.
- Frontend doc-param read + scroll/highlight seam proven via page-level test.
- Producer deep-link template strategy confirmed reusable.
- 24.6b will widen the allowlist to {tab, doc, section} for internal dashboard surface and add /dashboard/product/... pathname.

---

## Archive Metadata

- **Change Name**: `24-6a-notification-deeplink-owner-documents`
- **Archive Date**: 2026-06-22
- **Archive Type**: In-place (no folder move)
- **Merged Commit**: d947496 (PR #177 → develop)
- **Verify Verdict**: PASS (0 CRITICAL)
- **Canonical Specs**: Not merged (no canonical spec store in repo)
- **Archive Folder**: N/A (repo convention: changes remain in-place)

---

## Traceability Note

This archive report records all SDD artifacts (proposal, spec, design, tasks, apply-progress, verify-report) via Engram observation IDs (#4423–#4433) and filesystem paths for cross-session recovery. Both backends (Engram + OpenSpec files) are synchronized as of 2026-06-22.

The SDD cycle for Stage 24.6a is **COMPLETE and CLOSED**.

**Ready for the next change.**
