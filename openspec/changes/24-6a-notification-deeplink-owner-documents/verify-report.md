# Verification Report — Stage 24.6a Notification Deep-Linking: Owner Document Notifications

Date: 2026-06-22
Mode: hybrid (engram + openspec)
Verdict: **PASS**

---

## Completeness

| Artifact | Present | Notes |
|----------|---------|-------|
| spec.md | yes | 4 FR groups (P/S/F/R), 32 acceptance scenarios |
| design.md | yes | D1–D6, security-boundary rationale, audit commands |
| tasks.md | yes | 9 phases + JD round-1 fixes, all checked |
| apply-progress.md | yes | Status COMPLETE, all phases [x] |

All implementation tasks are checked. Two non-code gates intentionally left as informational pending:
9.5 seeded Playwright (live server) and 9.10 fresh-context PR review (pre-PR gate). Neither is an
unchecked implementation task. Acceptance checklist marks S-R6 as `pending (requires seeded server)`.

---

## Test execution evidence (re-run this verify pass — verbatim)

### API (from viewpro-app/apps/api)
Command: `pnpm vitest run src/notifications/notification-link.helper.spec.ts test/notification-producer.service.spec.ts test/owner-notifications.e2e-spec.ts`

```
 Test Files  3 passed (3)
      Tests  44 passed (44)
   Duration  3.73s
```

Per-file:
- `notification-link.helper.spec.ts` — **21 passed (21)** (sanitizer allowlist, all S-S1..S-S16 + fragment + duplicate + tampered + empty-doc)
- `notification-producer.service.spec.ts` — **8 passed (8)** (deep-link template all 3 owner doc types; internal + status-change unchanged)
- `owner-notifications.e2e-spec.ts` — **15 passed (15)** (DB available; round-trip + S-R1/R2/R3 regression)

### Frontend (from viewpro-app/apps/app-new)
Command: `pnpm vitest run src/features/owner/components/owner-document-requests.test.tsx src/features/owner/components/owner-property-detail.test.tsx`

```
 Test Files  2 passed (2)
      Tests  30 passed (30)
   Duration  1.84s
```
(owner-document-requests 22 + owner-property-detail 8 = 30, matching apply-progress JD round-1 totals.)

### Lint
Command: `viewpro-app/apps/app-new/node_modules/.bin/oxlint <9 changed files>` (pinned oxlint 1.66.0)
```
OXLINT_EXIT=0
```
Zero diagnostics on all 9 changed files. (Note: `npx oxlint` resolves to 1.71.0 from registry; the
repo-pinned 1.66.0 binary used here matches the apply-progress / CI binary. Both exit 0.)

### Seeded Playwright (NOT re-run this pass)
`pnpm test:seeded` (32/32 exit 0) was confirmed via a full run EARLIER this session; not re-run here
(needs live server ~2min). No regression expected from the new producer linkHref — the seed hardcodes
the OLD param-less format (seed-demo.mjs lines 1748/1762), which the sanitizer accepts via the FR-S3
fast-path. T07/T08/T17/T18a unaffected.

---

## Spec compliance matrix (every FR → passing assertion)

### Group P — Producer
| FR | Evidence | Status |
|----|----------|--------|
| FR-P1 all 3 types encode docId | producer.spec 13-55 (REQUESTED/APPROVED/REJECTED) + e2e round-trip | PASS |
| FR-P2 exact shape, no variation | producer.spec exact-string `linkHref`; sanitizer S-S3 verbatim return | PASS |
| FR-P3 no signature change | createDocumentOwnerNotification signature unchanged (src :250-276) | PASS |
| FR-P4 other types unaffected | DOCUMENT_UPLOADED `/dashboard/product/...` (:83); PROPERTY_STATUS_CHANGED `/owner/properties/{id}` (:126,:137) | PASS |

### Group S — Sanitizer (SECURITY-CRITICAL)
| FR | Evidence | Status |
|----|----------|--------|
| FR-S1 URL parse not string-eq | helper :62-78 `new URL` + origin + pathname assertions | PASS |
| FR-S2 /owner preserved | S-S1 unit | PASS |
| FR-S3 param-less path preserved | S-S2 unit + e2e S-R1 | PASS |
| FR-S4 deep-link accepted (closed {tab,doc}) | S-S3, S-S4 (param order) | PASS |
| FR-S5 unknown param → null | S-S5, S-S6 | PASS |
| FR-S6 tab != documents → null | S-S7 | PASS |
| FR-S7 protocol-relative / absolute → null | S-S9, S-S10 | PASS |
| FR-S8 non-/owner pathname → null | S-S11 | PASS |
| FR-S9 tampered/empty assetId, traversal → null | S-S12, S-S13, tampered-assetId unit | PASS |
| FR-S10 doc-alone, tab-alone, empty-doc → null | S-S8, S-S16, empty-doc unit | PASS |
| FR-S11 internal sanitizer untouched | git diff: no edits to sanitizeInternalNotificationLink / SAFE_INTERNAL_LINKS | PASS |
| (extra) fragment, duplicate doc → null | fragment unit, duplicate-doc unit | PASS |
| (extra) empty string, null, undefined → null | S-S14, S-S15(null), S-S15(undefined) | PASS |

Closed allowlist mechanism confirmed: `ALLOWED_OWNER_QUERY_PARAM_NAMES = new Set(['tab','doc'])`,
iterated with reject-on-first-unknown-key (helper :81-85) + duplicate rejection via
`getAll(key).length > 1` (:86-90). No if/else chain. No FR rejection scenario lacks a passing test.

### Group F — Frontend
| FR | Evidence | Status |
|----|----------|--------|
| FR-F1 read doc, thread highlightDocId | owner-property-detail :35, :167; opaque forwarder | PASS |
| FR-F2 doc survives tab activation | nuqs sibling param; real page-level S-F5 (Seguimiento→Documentos, data-highlight-doc stays req-123) | PASS |
| FR-F3 scroll + transient highlight | owner-document-requests :124-146 effect + :357 ring class; S-F1 asserts scroll AND highlight + 2s clear | PASS |
| FR-F4 absent doc → no-op | S-F2 | PASS |
| FR-F5 unmatched doc → graceful, no throw | S-F3; effect itemExists guard (:129-132) | PASS |
| FR-F6 no fire during loading | effect guards on `isSuccess` (:125); S-F4 | PASS |
| FR-F7 tab activation unchanged | tab nuqs :29-34 untouched | PASS |
| FR-F8 getSafeRelativeHref unchanged | notification-center.tsx git diff EMPTY; S-F6 regression | PASS |

### Group R — Regression
| FR | Evidence | Status |
|----|----------|--------|
| FR-R1 historical param-less works | e2e S-R1 (15/15 green) | PASS |
| FR-R2 /owner root unaffected | e2e S-R2 | PASS |
| FR-R3 baselines green | seed-demo.mjs git diff EMPTY; seeded smoke confirmed earlier session | PASS (see WARNING W1 for internal-e2e re-run scope) |
| FR-R4 24.5 link assertions reconciled | e2e 7.1 confirmed no doc-shape assertions existed; S-A8 cross-surface unchanged (:441) | PASS |

---

## Out-of-scope respected
- No internal-side (B): DOCUMENT_UPLOADED linkHref `/dashboard/product/{id}` unchanged. CONFIRMED.
- No movement/status (C): PROPERTY_STATUS_CHANGED / MOVEMENT_CREATED linkHref unchanged. CONFIRMED.
- Manager bandeja / internal sanitizer / frontend href guard: untouched (git diff). CONFIRMED.
- No DB schema change: linkHref is existing text column; no migration. CONFIRMED (no migration in diff).
- Changed-file set matches apply-progress manifest exactly (8 modified + 1 new spec). CONFIRMED.

---

## Issues

### CRITICAL
None.

### WARNING
- **W1 — Internal e2e (S-R4) and full-suite totals not independently re-run in this verify pass.**
  This pass re-ran the targeted slice (44 API + 30 FE) plus the static diff proof that
  `sanitizeInternalNotificationLink` is untouched. The apply-progress claims 750/750 API and 437/437 FE
  full-suite green and `notifications.e2e-spec.ts` unchanged. The internal-sanitizer no-change is proven
  by git diff (strong), but `notifications.e2e-spec.ts` was not executed in this verify pass. Risk is LOW
  (no producer/sanitizer change touches the internal path), but a full `pnpm --filter @viewpro/api test`
  before merge would close the gap to direct runtime evidence.

### SUGGESTION
- **S1 — Doc path drift in tasks/apply-progress.** tasks.md 8.2 and apply-progress 8.1 reference
  `viewpro-app/scripts/seed-demo.mjs`; the actual file is `viewpro-app/apps/api/scripts/seed-demo.mjs`.
  The invariant (seed unchanged) still holds — verified at the real path — but the doc path string is
  inaccurate. Cosmetic; no impact on the implementation.
- **S2 — oxlint version pinning.** `npx oxlint` pulls 1.71.0 from the registry while the repo-pinned
  binary is 1.66.0. Both exit 0 here, but standardizing the lint invocation on the pinned binary (as the
  JD round-1 note already established) avoids version drift in future gates.

---

## Final verdict: PASS

All 4 FR groups map to implemented, passing assertions. The sanitizer security boundary uses a closed
enumerated `{tab,doc}` allowlist with reject-on-first-unknown-key, duplicate rejection, origin assertion,
exact trusted-column pathname match, fragment rejection, and empty-doc rejection — every FR rejection
scenario (S-S5..S-S16 + fragment + duplicate + tampered + empty-doc) has a passing unit test. Out-of-scope
surfaces (internal B, movement/status C, manager bandeja, internal sanitizer, FE href guard, seed, DB
schema) are confirmed untouched by git diff. The single WARNING (W1) is a verify-pass scope note with LOW
risk, not a blocker for archive.

Recommended next: **sdd-archive**.
