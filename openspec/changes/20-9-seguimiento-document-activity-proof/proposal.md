# Proposal — Stage 20.9 Seguimiento Document Activity Proof

**Status:** proposed, ready to enter SDD `sdd-spec` after acceptance.
**Origin:** `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`. Final MVP plan Phase B (post-26.3) audit row "Seguimiento doc activity proof". Investigation completed on 2026-06-16 after 20.11 (Seguimiento filter corrections) merged.
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase B. Slice 3 in the development-mode-reframed handoff after 26.6a and 20.11 closed.

## Slice contract

```txt
Stage: 20
Slice: 20.9 — Seguimiento document activity proof
Objective: prove the document activity surface inside the Seguimiento feed across all document lifecycle states with automated tests, without redesigning the feature.
Evidence needed: component tests for ActivityDocumentRequestFeedItem covering all 5 doc statuses + 4 version statuses, use case tests for document_request mapping across all lifecycle states, seeded fixtures covering APPROVED + CANCELLED (currently missing), and seeded Playwright smoke that focalises on the document-card render and the document_request kind filter.
Do not touch: document storage, document panel redesign, document upload flow, new document workflows, the activity feed data model, the API 403 guard, or the 26.2 deterministic seed contract.
Done: every confirmed lifecycle state has a green test, the feed renders document activity correctly across states, and the seeded smoke proves the document-card flow end-to-end.
Next slice: 23.3 — WhatsApp tenant contact configuration (UI editor).
```

## Investigation summary (2026-06-16)

After 20.11 merged, I audited the document side of the activity feed end-to-end. The code is **structurally clean** — the bug surface is small. The audit row is about **proof**, not new behavior.

### What works today

- `ActivityDocumentRequestFeedItem` (`apps/app-new/src/features/activity/components/activity-document-request-feed-item.tsx`) renders the document card with: property badges (operation type + engagement status), document title + description, current version filename + status, owner display name, requester display name, timestamp, "Ver propiedad" CTA. All 5 doc statuses (`PENDING`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED`) and 4 version statuses (`PENDING_UPLOAD`, `UPLOADED`, `APPROVED`, `REJECTED`) have label + color-tone mappings.
- `ListActivityFeedUseCase` (`apps/api/src/analytics/use-cases/list-activity-feed.use-case.ts`) handles `kind: 'document_request'`, the mixed `kind: 'all'` merge, sorts by `createdAt desc`, and (post-20.11) filters by date + Responsable correctly.
- `PrismaDocumentsRepository.listActivityRequests` filters by tenant + viewer scope + assigned-agent + date range, with the post-20.11 `toExclusive` boundary discipline.
- `ActivityFeed` (`apps/app-new/src/features/activity/components/activity-feed.tsx`) dispatches between movement and document items by `kind`.

### Gaps confirmed by inspection

1. **No component test for `ActivityDocumentRequestFeedItem`.** `fd activity-document-request viewpro-app/apps/app-new/src` returns only the implementation file; no `.test.tsx` sibling exists.
2. **Use case unit tests cover only PENDING.** `analytics.use-cases.spec.ts` includes one document fixture with `status: 'PENDING'`. The other 4 doc statuses are not asserted on, even though the component handles them.
3. **Seed lifecycle coverage is incomplete.** `seed-demo.mjs` currently produces:
   - PENDING doc requests
   - SUBMITTED doc requests (with version)
   - REJECTED doc requests (with rejection reason)
   - **Missing**: APPROVED doc requests and CANCELLED doc requests. Both states render in the UI; neither is exercised by any test or smoke today.
4. **Seeded smoke is non-focal.** `demo-smoke.spec.ts` line 88 asserts `.getByText(/Ingresó una consulta calificada|Solicitud documental|Escritura/i)` — an OR regex that passes if any of the three appears. No test specifically asserts that a document card with its specific structure (badges, owner, version metadata, status tone) renders.
5. **No smoke for the `kind=document_request` filter.** The UI exposes a "Documentos" pill in `ActivityFilters` that swaps the feed to docs-only, but no seeded smoke proves the swap behaves as expected with seeded data.

### Out of scope confirmed by inspection

- Document storage adapter, signed URL TTL, document panel redesign — explicitly named in the audit's "Do not touch" list.
- New document workflows (multi-version negotiation, attachments, comments) — none exist in 20.9.
- API 403 guards or permissions — handled by the existing visibility filter; no change.
- The seed's 26.2 deterministic contract — additive fixtures only.

## Scope

- **Component test for `ActivityDocumentRequestFeedItem`** at `viewpro-app/apps/app-new/src/features/activity/components/activity-document-request-feed-item.test.tsx`:
  - Renders all 5 doc statuses with correct label + tone class.
  - Renders all 4 version statuses with correct label.
  - Renders the "no current version" path ("Sin archivo cargado").
  - Renders fallback strings for missing property title, missing owner, missing requester.
  - Asserts the "Ver propiedad" link targets `/dashboard/product/<engagementId>`.
- **Use case tests** at `viewpro-app/apps/api/test/analytics.use-cases.spec.ts`:
  - Add fixtures and assertions for `status: 'SUBMITTED'`, `'APPROVED'`, `'REJECTED'`, `'CANCELLED'` covering the mapper output shape (`documentRequest.status`, `currentVersion.status`).
  - Confirm mixed-kind sort interleaves docs and movements by `createdAt desc`.
- **Seed additions** in `viewpro-app/apps/api/scripts/seed-demo.mjs`:
  - One APPROVED doc request with an APPROVED version on a manager-assigned property.
  - One CANCELLED doc request (or document the rationale if cancellation is rare enough to defer).
  - Update the seed summary log to reflect the new counts honestly (per the 20.11 judgment-day Round 1 lesson — log accuracy is non-negotiable).
  - Audit existing count assertions (`Document requests:` log, smoke, unit tests) and update atomically before mutation.
- **Seeded Playwright smoke** in `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`:
  - One focused test that opens Seguimiento as manager, asserts a document-request card renders with: status badge (specific text), document title, owner display, requester display, version filename if present, "Ver propiedad" link target.
  - One focused test that applies the `Documentos` kind filter, asserts the feed contains ONLY document cards (no movement cards visible).

## Out of scope

- Refactoring `ActivityDocumentRequestFeedItem` or `ActivityFeed`.
- Changing the document repository, use case, or DTO contract.
- Adding new filter dimensions, sort options, or pagination behavior.
- Re-designing the document panel on the property detail page.
- Document storage, signed URLs, or upload workflow.
- Any change to the 26.2 seed contract beyond the additive APPROVED/CANCELLED fixtures.
- Per-tenant configuration of document types or taxonomies (that's 20.12).

## Preserve unchanged

- The existing 22+ tests across analytics suites stay GREEN.
- The 25/25 seeded smoke baseline holds; any new tests are additive.
- The 671 API tests + 403 app-new unit tests post-20.11 stay GREEN.
- The API 403 guard, the 26.2 contract, the 26.2.1 image fixtures.

## Affected areas

- `viewpro-app/apps/app-new/src/features/activity/components/activity-document-request-feed-item.test.tsx` (new file).
- `viewpro-app/apps/api/test/analytics.use-cases.spec.ts` (extended).
- `viewpro-app/apps/api/scripts/seed-demo.mjs` (additive fixtures + accurate count log).
- `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` (2 new focused tests).
- This OpenSpec change folder.

## Safety and integrity constraints

- Seed mutations follow the 20.11 judgment-day Round 1 discipline: the summary log MUST accurately reflect actual DB row counts. Update label + count atomically.
- Pre-audit count assertions in existing smoke/e2e before mutating the seed, per R-D3 from 20.11.
- Component tests MUST avoid Radix UI Select / Popover interaction in JSDOM (per 20.10 lesson). The doc card has no Select; only Badge + Card + Link components, all SSR-safe.
- New tests must use the canonical seed-clock dates, not wall-clock, where reproducibility matters.
- No `--no-verify` on commits.

## Risks

- **Seed mutation shifts existing count assertions**. Mitigation: pre-audit with `rg` per the 20.11 pattern; update atomically. Specifically check `Document requests:` log line, `expectedTotal` in seller scenarios, and any `result.total` literals in existing analytics tests.
- **CANCELLED state may not have a real-world driver**. The audit doesn't say cancellation is part of the daily workflow. Mitigation: design phase decides whether to seed a CANCELLED fixture or document that CANCELLED is exceedingly rare and gate it behind a TODO note for a future slice. Component test still covers the UI mapping either way.
- **Smoke test brittleness**. Asserting specific text/structure of a doc card can break on copy edits. Mitigation: assert on stable test ids or aria labels where possible, and keep the text assertions to single-word labels (e.g., "Aprobada", "Pendiente") that are unlikely to change.
- **Sort-order tests are timezone-sensitive**. Mitigation: use the canonical `DEMO_NOW` clock for fixture timestamps so the order is deterministic.

## Rollback

Delete the new component test, revert the seed additions, revert the new use case test cases, revert the new smoke tests. Pre-existing 671 API + 403 app-new + 25/25 smoke baselines remain intact.

## Success criteria

- Component test exists, covers all 5 doc statuses + 4 version statuses + fallback paths, passes.
- Use case test asserts on all 5 doc statuses (with mapping output shape) and mixed-kind sort.
- Seed produces APPROVED fixture (and CANCELLED if design accepts it). Summary log is accurate.
- Seeded smoke includes 1 doc-card render assertion + 1 docs-only filter assertion.
- All existing tests stay GREEN. New tests pass on a fresh `pnpm demo:seed`.
- Total seeded smoke ≥ 27 tests (25 baseline + 2 new).
- No new dependency, no UI refactor, no schema change.

## Next phases

Move to SDD `sdd-spec` once this proposal is accepted. The spec phase converts the gap list into testable FRs and Given/When/Then scenarios mapped to specific test files.
