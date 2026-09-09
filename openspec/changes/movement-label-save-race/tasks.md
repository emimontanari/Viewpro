# Tasks — movement-label-save-race
## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | 360 max = 94 docs + 22 tasks + 20 progress reserve + 224 source/tests |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium
Baseline read: form 111, combobox 217, dialog 268, combobox test 129, dialog test 103, seeded smoke 2216 lines.
Allow only `viewpro-app/apps/app-new/src/features/products/components/{movement-outcome-create-label-form.tsx,movement-outcome-combobox.tsx,create-property-movement-dialog.tsx}` (20/28/38 max), colocated `{movement-outcome-combobox.test.tsx,create-property-movement-dialog.test.tsx}` (55/75), and `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` (8); no API/DTO/schema/dependency/other paths.
- [x] RED: add focused deferred-create success/error/stale-cancel-reopen tests, keyboard and pointer submit blocking, one returned id, and seeded explicit selected-label wait selector in the two unit tests and `demo-smoke.spec.ts`. <!-- sdd-owner: implementation -->
- [x] GREEN: implement accepted prop-chain architecture form → combobox → dialog, per-instance pending state, mounted/operation guards, close reset, and button/handler gate; preserve error and keyboard semantics. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: run `cd /Users/emimontanari/Work/Apps/Viewpro-worktrees/movement-label-save-race/viewpro-app && pnpm --filter next-shadcn-dashboard-starter test src/features/products/components/create-property-movement-dialog.test.tsx src/features/products/components/movement-outcome-combobox.test.tsx && pnpm --filter next-shadcn-dashboard-starter lint:strict && pnpm --filter next-shadcn-dashboard-starter typecheck`; with an existing local stack only, run `pnpm --filter next-shadcn-dashboard-starter test:seeded --grep "seller can create movements with outcomes"`; offline frozen dependency installation and local generation are allowed, while cleanup remains local and guarded to a clearly marked test DB only. <!-- sdd-owner: implementation -->
- [x] REFACTOR: keep the six-file allowlist, caps, no network installs/DB provisioning/publication, and verify `git diff --check`; stop and report the ask-on-risk gate if the forecast exceeds 400. <!-- sdd-owner: implementation -->
## Parent actions
- [x] Complete independent static verification; RDD remains disabled/unmanaged. <!-- sdd-owner: parent -->
