# Tasks: InmoView Default Light Color Mode

Issue #282 is planned as one atomic app-new change: provider fallback and pre-hydration browser-chrome policy ship and roll back together. All implementation paths below are relative to `viewpro-app/`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 175–265 across one new policy module, layout/provider wiring, and focused tests |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR: one atomic provider/preload work unit plus its focused regressions |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Execution and ownership boundary

Implementation is restricted to `viewpro-app/apps/app-new` and the exact test files named below. The provider fallback and preload/meta behavior are one atomic work unit and must not be split into separate PRs. Tests stay with the behavior they verify. Apply must update this file's checkboxes and record exact RED/GREEN/TRIANGULATE/REFACTOR and verification command results; verify must record results, skips, blockers, and residual risks in the change's verification evidence.

Commit, push, PR creation, merge, and issue closure are later parent/user-authorized lifecycle actions. They are not automatic implementation steps in this task plan.

## Ordered implementation tasks

### 0. Pre-write collision gate and source audit

- [x] From `viewpro-app/`, run read-only Git/worktree checks (`git status --short`, `git diff --check`, `git diff --name-only`, `git diff --stat`, `git branch --show-current`, and `git log -1 --oneline`) and stop for parent review if unexpected edits, conflicts, or non-planning files are present. <!-- sdd-owner: implementation -->

  Compare the worktree with `origin/develop` using `git diff origin/develop --` and inspect `git show origin/develop:apps/app-new/src/app/layout.tsx` plus `git show origin/develop:apps/app-new/src/components/themes/theme-provider.tsx`; confirm the current provider uses `defaultTheme='system'`, the preload treats absent storage as system-driven, and the rebase base is `c78740b`.

- [x] Run read-only GitHub and worktree collision checks for issue #282 and the target paths (`gh pr list --state open --search "282"`, `gh pr list --state open --search "default-light-theme"`, and `git worktree list --porcelain`), then search active `openspec/changes/` for `apps/app-new/src/app/layout.tsx`, `color-mode.ts`, `theme-provider.tsx`, and the named control-test paths; ask under `ask-on-risk` if another active diff or PR touches provider, preload, or control tests. <!-- sdd-owner: implementation -->

  These checks are read-only and must not mutate GitHub, branches, worktrees, or commits.

### 1. RED — policy and provider contracts

- [x] Add `viewpro-app/apps/app-new/src/components/themes/__tests__/color-mode.spec.ts` and `viewpro-app/apps/app-new/src/components/themes/__tests__/theme-provider.spec.tsx` before adding production policy code, covering the missing `COLOR_MODE_POLICY`/`buildThemeColorPreloadScript` seam, `defaultTheme='light'`, `enableSystem=true`, and preservation of caller-owned provider props; run the focused Vitest command and record the honest missing-module/provider-contract failure as RED. <!-- sdd-owner: implementation -->

  The policy test must execute the generated script in jsdom rather than inspect source text. It must prepare a light `meta[name="theme-color"]`, exercise absent/`light`/`dark`/`system`/unknown storage against light and dark media states, assert the complete supported matrix and unchanged storage, and cover throwing storage, missing/throwing `matchMedia`, missing meta, and dark short-circuit behavior.

  Focused command from `viewpro-app/`:
  ```bash
  pnpm --filter next-shadcn-dashboard-starter test -- \
    src/components/themes/__tests__/color-mode.spec.ts \
    src/components/themes/__tests__/theme-provider.spec.tsx \
    src/components/themes/__tests__/theme-mode-toggle.spec.tsx \
    src/components/kbar/use-theme-switching.test.tsx
  ```

### 2. Characterization — existing controls, not manufactured RED

- [x] Add `viewpro-app/apps/app-new/src/components/themes/__tests__/theme-mode-toggle.spec.tsx` and `viewpro-app/apps/app-new/src/components/kbar/use-theme-switching.test.tsx` as passing characterization tests for existing behavior, proving resolved light→explicit dark and dark→explicit light clicks plus KBar `setLightTheme`/`setDarkTheme` exact requests without changing production controls or manufacturing a failure. <!-- sdd-owner: implementation -->

  Mock `next-themes`, use Testing Library/user-event with `document.startViewTransition` absent, capture KBar registrations by stable IDs, and do not cover or alter the pre-existing raw-`theme` `system` toggle edge. Record the baseline pass separately from the RED evidence.

### 3. GREEN — implement one atomic provider/preload work unit

- [x] Add `viewpro-app/apps/app-new/src/components/themes/color-mode.ts` with readonly serializable `COLOR_MODE_POLICY` and argument-free `buildThemeColorPreloadScript()`, using fixed JSON-serialized constants and the fail-light predicate `saved === 'dark' || (saved === 'system' && dark media matches)` without storage writes or user-controlled inputs. <!-- sdd-owner: implementation -->

  The module must define the light default, `enableSystem: true`, `theme` storage key, supported dark/system values, dark media query, meta selector, and light/dark colors. It must leave unknown/empty/corrupt values light and make storage, media, and DOM failures no-throw/no-op.

- [x] Update `viewpro-app/apps/app-new/src/components/themes/theme-provider.tsx` so its public props omit caller overrides for `defaultTheme` and `enableSystem`, while forwarding `COLOR_MODE_POLICY.defaultMode` and `.enableSystem` to `NextThemesProvider` with all other existing props and children intact. <!-- sdd-owner: implementation -->

- [x] Atomically update `viewpro-app/apps/app-new/src/app/layout.tsx` to import the policy/builder, derive viewport light/dark colors from the policy, replace the old inline absent/system predicate with `buildThemeColorPreloadScript()`, and remove only the layout's `defaultTheme='system'` and `enableSystem` literals while retaining class attribute, transition suppression, color-scheme support, preset cookie validation, `DEFAULT_THEME`, `data-theme`, and `active_theme` behavior. <!-- sdd-owner: implementation -->

  The server meta remains light by default. The synchronous `<head><script dangerouslySetInnerHTML>` mechanism remains unchanged; no effect, hydration correction, `next/script`, nonce/CSP redesign, or next-themes internals are introduced.

### 4. TRIANGULATE — broaden evidence without duplicating dependency internals

- [x] Expand `viewpro-app/apps/app-new/src/components/themes/__tests__/color-mode.spec.ts` and `viewpro-app/apps/app-new/src/components/themes/__tests__/theme-provider.spec.tsx` only as needed to triangulate the supported matrix, failure contract, no-write guarantee, and provider delegation; rerun the four-file focused command and record all rows green without adding a second application resolver or testing seeded/backend behavior. <!-- sdd-owner: implementation -->

  Confirm saved `system` is delegated to `next-themes` with `enableSystem` and remains media-responsive by provider configuration, while the project-owned preload test remains limited to initial browser-chrome resolution.

### 5. REFACTOR — preserve the single policy seam

- [x] Refactor only `viewpro-app/apps/app-new/src/app/layout.tsx`, `viewpro-app/apps/app-new/src/components/themes/color-mode.ts`, and `viewpro-app/apps/app-new/src/components/themes/theme-provider.tsx` to remove obsolete literals/conditions, keep policy names and serialized script minimal, and retain atomic provider/preload behavior; rerun the focused four-file test command after each cleanup. <!-- sdd-owner: implementation -->

- [x] Run formatting and type/lint checks for the changed app-new files, review the resulting diff for accidental control, preset, cookie, or storage changes, and leave all production behavior outside the planned target paths untouched. <!-- sdd-owner: implementation -->

## Full validation and scope gates

- [x] From `viewpro-app/`, run the complete app validation commands against `next-shadcn-dashboard-starter`: `pnpm --filter next-shadcn-dashboard-starter test`, `pnpm --filter next-shadcn-dashboard-starter lint:strict`, `pnpm --filter next-shadcn-dashboard-starter typecheck`, `pnpm --filter next-shadcn-dashboard-starter format:check`, and `pnpm --filter next-shadcn-dashboard-starter build`; record exact outputs and distinguish environment-only failures from product failures. <!-- sdd-owner: implementation -->

- [x] Explicitly skip `pnpm --filter next-shadcn-dashboard-starter test:seeded` and record that rationale in verification evidence: #282's focused contract is deterministic jsdom/Testing Library coverage with no backend, seeded data, database setup, authentication fixture, or Playwright prerequisite, so seeded E2E is not a substitute for the declared checks. <!-- sdd-owner: implementation -->

- [x] Run `git diff --check`, `git diff --name-only origin/develop --`, `git diff --stat origin/develop --`, and `git diff --numstat origin/develop --` for the implementation paths; measure additions plus deletions, keep the single PR below 400 changed lines, and stop for parent re-estimation if the measured diff reaches 350 lines or a new scope is proposed. <!-- sdd-owner: implementation -->

- [x] Prove scope boundaries with the final diff: `apps/viewpro-web` is absent; no `DEFAULT_THEME`, `THEMES`, preset CSS, `data-theme`, `active_theme`, cookie, backend/API/schema/database/migration/seed/flag/deployment file, or cross-app abstraction is changed; and no initialization path contains `setItem`, `removeItem`, or `clear` for `localStorage.theme` (test mutator spies are allowed only to prove no writes). <!-- sdd-owner: implementation -->

## Apply, rollback, and lifecycle evidence

- [x] Before marking apply complete, update this task artifact with the ordered checkbox progress and exact RED, characterization, GREEN, TRIANGULATE, REFACTOR, validation, skip, and scope-gate results; do not mark a phase complete from an unrecorded or substituted command. <!-- sdd-owner: implementation -->

- [x] Verify the atomic rollback boundary by reviewing that reverting `viewpro-app/apps/app-new/src/components/themes/color-mode.ts`, `viewpro-app/apps/app-new/src/components/themes/theme-provider.tsx`, `viewpro-app/apps/app-new/src/app/layout.tsx`, and the four focused test files together restores the old unsaved system fallback without requiring storage, cookie, database, or backend rollback. <!-- sdd-owner: implementation -->

### Parent-owned post-apply gates

- [x] Start or reuse one bounded review only after implementation verification is complete, and ask before chaining only if collision, validation availability, or the 400-line forecast changes under `ask-on-risk`. <!-- sdd-owner: parent -->

- [x] Assemble issue #282 closure evidence from the verified diff and command results: absent preference is light on both OS states, saved `light`/`dark` remain authoritative, saved `system` remains media-responsive, provider/meta agree, controls regressions pass, and all scope guards are clean; do not close the issue or mutate GitHub from the tasks/apply phase. <!-- sdd-owner: parent -->

- [x] At explicit user authorization and only under repository delivery policy, handle any later commit, push, PR, merge, and issue-closure actions as separate lifecycle work; none is executed automatically by these implementation tasks. <!-- sdd-owner: parent -->
