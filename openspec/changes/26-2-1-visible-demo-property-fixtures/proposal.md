# Proposal — Stage 26.2.1 Visible Demo Property Image Fixtures

**Status:** implemented on `chore/26-2-1-visible-demo-fixtures`, awaiting merge.
**Origin:** demo readability — Stage 26.2 (`PR #146`) replaced remote image downloads with a 1x1 transparent PNG buffer for determinism, which renders as blank white tiles in the property UI and degrades the demo experience.
**Parent slice:** `26.2` (deterministic seed contract).

## Slice contract

```txt
Stage: 26
Slice: 26.2.1 — Visible demo property image fixtures
Objective: keep the deterministic-seed contract while making property images presentable for demo and pilot.
Evidence needed: seed runs idempotently with real JPG bytes for mapped properties; placeholder PNG for unmapped; seeded smoke green.
Do not touch: production data behavior, network access at seed time, image schema, or storage adapter.
Done: 17 of 20 demo properties show real 720x532 photos in the dashboard; 3 unmapped property types (apartment, land, commercial) keep the 1x1 placeholder; seeded E2E remains green.
Next slice: return to Phase B execution (`26.3` Full seeded E2E).
```

## Problem

Stage 26.2 made the demo seed deterministic by writing a 1x1 transparent PNG to every property image record. This satisfies the "no network at seed time" rule but produces blank white image tiles in the UI, which hurts the demo before pilot.

The fix must keep the deterministic guarantee: no live downloads at seed time, no flaky CI, no silent drift between runs.

## Scope

- Add `viewpro-app/apps/api/scripts/fetch-property-fixtures.mjs`, a one-shot setup script that downloads property photos from a slim source JSON into local fixture files.
- Add `viewpro-app/apps/api/scripts/fixtures/zonaprop-source.json` with 17 properties × first 3 image URLs at 720x532 resolution (small, focused dataset).
- Add `viewpro-app/apps/api/scripts/fixtures/property-image-map.json` mapping the 20 seed property indices to their matching `posting_id` plus explicit `unmatched` entries for apartment/land/commercial.
- Commit the downloaded fixture bytes under `viewpro-app/apps/api/scripts/fixtures/properties/<postingId>/<order>.jpg` (~3.4MB, 50 files for 17 properties × 3 images, one 404 fallback handled).
- Modify `viewpro-app/apps/api/scripts/seed-demo.mjs`:
  - Rename `DEMO_IMAGE_BUFFER` → `DEMO_IMAGE_PLACEHOLDER_BUFFER`.
  - Bump `DEMO_IMAGES_PER_PROPERTY` from `1` to `3`.
  - Load `property-image-map.json` at startup.
  - Add `getDemoImageBuffer/Mime/Extension(seedIndex, imageIndex)` helpers that resolve fixture path → bytes → fall back to placeholder if missing.
  - Persist correct mimeType (`image/jpeg` or `image/png`) and storageKey extension per image.
  - Update summary log to describe the new strategy honestly.

## Preserve unchanged

- Production data behavior, the `assertSafeEnvironment` guard, and the canonical demo tenant scope.
- Network access at seed time (`pnpm demo:seed` remains fully offline).
- Image schema, storage adapter, image upload API, and owner portal image rendering.
- `26.2` proposal/design/tasks/specs (this slice supplements, does not rewrite).

## Out of scope

- New seed property data (the same 20 properties remain; only their image bytes change).
- Image rendering work in the UI, image-related API changes, or storage adapter changes.
- Increasing the image limit beyond 3 per property in the demo seed.
- Adding image bytes for the 3 unmatched property types (apartment, land, commercial) without source data.

## Affected areas

- `viewpro-app/apps/api/scripts/fetch-property-fixtures.mjs` (new).
- `viewpro-app/apps/api/scripts/fixtures/zonaprop-source.json` (new).
- `viewpro-app/apps/api/scripts/fixtures/property-image-map.json` (new).
- `viewpro-app/apps/api/scripts/fixtures/properties/<postingId>/<0..2>.jpg` (new binary fixtures, ~3.4MB total).
- `viewpro-app/apps/api/scripts/seed-demo.mjs` (modified).
- `openspec/changes/26-2-1-visible-demo-property-fixtures/` (this proposal).

## Safety and licensing notes

- Image URLs come from `imgar.zonapropcdn.com` (Zonaprop public listings). Use is limited to internal demo/pilot purposes. If pilot or staging becomes public, replace these fixtures with own/agency photos before exposure.
- All references list the source `posting_id` so any specific image can be removed on request without touching the seed code.

## Determinism guarantees

- `pnpm demo:seed` reads bytes from disk only. No HTTP. No DNS. No `fetch()` at seed time.
- `fetch-property-fixtures.mjs` runs only once (or never if fixtures already present, thanks to the `stat` early-return). It is not invoked by the seed.
- Same fixture bytes produce same image rows on every run.

## Success criteria

- `pnpm demo:seed` succeeds offline with no network errors.
- The dashboard renders real photos for `17/20` properties and 1x1 placeholders for `3/20` (apartment, land, commercial).
- Seeded smoke E2E remains green (10/10 tests including the owner notifications/images/contacts test).
- Repo growth is bounded (~3.4MB, well under any reasonable budget).

## Risks

- Image bytes drift if Zonaprop replaces their hosted images. Mitigation: bytes are committed; the `fetch` script never runs from `demo:seed`.
- Licensing concern if pilot domain goes public. Mitigation: documented above; replace fixtures with agency-owned photos before public exposure.
- Repo size grows. Mitigation: 3.4MB is small relative to `node_modules`; if a smaller footprint is needed later, drop to 1 image per property and revisit.

## Rollback

Revert this change. The 26.2 seed reverts to the 1x1 placeholder behavior. No data migration is required because the seed always rewrites image rows for the demo tenant.

## Evidence (verified 2026-06-14)

- `pnpm --filter @viewpro/api demo:seed` → `Properties: 20, Images: 60` (20 × 3).
- Property `Casa compacta en Funes` dashboard view: `demo-property-image-20-1.jpg` and `demo-property-image-20-2.jpg` render at `720x532 px` natural size; `demo-property-image-20-3.png` falls back to `1x1` placeholder (404 on the 3rd source URL, handled gracefully).
- `pnpm --filter next-shadcn-dashboard-starter test:seeded` → `10 passed`.
