# Design: Light Default Color Mode for InmoView

## Decision

InmoView will own one small color-mode policy module. The app-specific `ThemeProvider` will configure `next-themes` with a light absent-preference fallback and `enableSystem`, while the root layout will use a generated synchronous preload script from the same policy module for browser-chrome `theme-color`. No client effect or hydration-time correction is added.

This changes the **default color mode** only. It does not change the `inmoview` visual preset.

## Current-source evidence

At `origin/develop@c78740b914aa0a2eebac56d286fdd10106cf9b7d`:

- `apps/app-new/src/app/layout.tsx` passes `defaultTheme='system'` and `enableSystem` to the local wrapper.
- The same layout emits light `viewport.themeColor`, then synchronously changes it to dark when storage is dark or when storage is absent/system and `matchMedia` is dark.
- `components/themes/theme-provider.tsx` is currently a transparent `next-themes` wrapper.
- `ThemeModeToggle` switches from `resolvedTheme`, and `use-theme-switching.tsx` registers explicit light and dark KBar actions.
- App tests use Vitest 4, jsdom, Testing Library, the `@` alias, and `src/test/setup.ts`.

The defect is the absent-storage branch: both provider and custom meta preload currently consult the operating system. They must instead agree on light.

## Architecture and data flow

```text
COLOR_MODE_POLICY
  ├─ defaultMode: light ──> app ThemeProvider ──> next-themes pre-hydration class/color-scheme
  ├─ enableSystem: true ──> app ThemeProvider ──> saved system remains media-responsive
  └─ storage/query/colors ─> buildThemeColorPreloadScript()
                              └─ synchronous head script ──> theme-color meta
```

1. The server emits the light `theme-color` from `COLOR_MODE_POLICY.colors.light`.
2. Before hydration, `next-themes` reads `localStorage.theme`. Its `defaultTheme='light'` applies only when no saved value exists; saved `light`, `dark`, and `system` remain authoritative. `enableSystem` keeps saved `system` initially and live media-responsive.
3. The existing custom head script independently reads the same storage key solely to choose browser-chrome color. It changes the server light meta to dark only for saved `dark`, or saved `system` with a successful dark media query.
4. Neither initialization path writes storage. Existing user actions continue to call `setTheme`, which may persist the explicit user choice as before.

## Authoritative policy and preload seam

Add `src/components/themes/color-mode.ts` with these symbols:

- `COLOR_MODE_POLICY`: a readonly serializable object containing `defaultMode: 'light'`, `enableSystem: true`, `storageKey: 'theme'`, recognized `dark` and `system` values, `'(prefers-color-scheme: dark)'`, the theme-color selector, and light/dark colors.
- `buildThemeColorPreloadScript()`: a pure, argument-free builder that serializes only `COLOR_MODE_POLICY` constants into the synchronous script.

There will be no second application resolver that imitates `next-themes`. The generated preload is the one project-owned executable predicate:

```text
dark := saved value is "dark"
     OR (saved value is "system" AND a successful media query reports dark)
```

Every other outcome stays light. `ThemeProvider` consumes `defaultMode` and `enableSystem`; the root viewport and preload consume the same policy object. This centralizes the app-owned decisions without copying `next-themes` class injection, persistence, or media-change listener internals.

`theme-provider.tsx` will make the two policy props app-owned rather than caller-owned: its public props omit `defaultTheme` and `enableSystem`, and it passes `COLOR_MODE_POLICY.defaultMode` and `.enableSystem` to `NextThemesProvider`. `layout.tsx` removes its current `defaultTheme='system'` and `enableSystem` literals but retains `attribute='class'`, `disableTransitionOnChange`, and `enableColorScheme`.

## Resolution and failure contract

The server meta begins light in every row. The preload only mutates it for a dark outcome.

| Stored value | Media state | Provider result | Meta result | Storage |
|---|---|---|---|---|
| absent | light or dark | light | light | untouched |
| `light` | light or dark | light | light | unchanged |
| `dark` | light or dark/unavailable | dark | dark | unchanged |
| `system` | light | light | light | unchanged |
| `system` | dark | dark | dark | unchanged |
| unknown, empty, or corrupt | light or dark | safe light fallback | light | unchanged |

Failure behavior is deliberately fail-light:

- `matchMedia` is called only for saved `system`; absence, a thrown call, or an unusable result leaves the server light meta unchanged.
- Saved `dark` short-circuits before `matchMedia`, so it still sets dark when media APIs are absent or fail.
- A denied or throwing `localStorage.getItem` is caught and leaves light unchanged.
- A missing `meta[name='theme-color']` is a no-op through optional mutation and does not throw.
- Unknown/corrupt values are not removed, normalized, or rewritten.
- The preload contains no `setItem`, `removeItem`, or `clear` call.

For unknown values, the custom meta safely remains light. `next-themes` only documents the supported values; this change does not add a migration or attempt to redefine dependency behavior for corrupt values. The supported compatibility guarantee remains absent/`light`/`dark`/`system`.

## CSP, Next.js, and first-paint safety

Keep the current synchronous `<head><script dangerouslySetInnerHTML>` mechanism unchanged. Moving this decision to an effect, client component, or post-hydration callback would create first-paint disagreement and extra runtime work. Replacing it with `next/script`, a nonce system, or a CSP redesign is outside this issue and could alter ordering.

The builder interpolates only fixed policy constants serialized with `JSON.stringify`; it accepts no cookie, storage, URL, or user-controlled input. The existing repository has no app-new CSP nonce integration, so this design neither weakens nor claims to solve the pre-existing inline-script CSP posture. The script remains guarded by `try/catch`, synchronous, idempotent, and mutation-limited to one meta attribute.

## Exact file plan

| File | Symbol/change |
|---|---|
| `viewpro-app/apps/app-new/src/components/themes/color-mode.ts` | Add `COLOR_MODE_POLICY` and `buildThemeColorPreloadScript`. |
| `viewpro-app/apps/app-new/src/components/themes/theme-provider.tsx` | Apply app-owned light default and `enableSystem` from the policy; omit those caller overrides. |
| `viewpro-app/apps/app-new/src/app/layout.tsx` | Import policy/builder, derive viewport colors, replace inline script body with builder output, and remove the old provider literals. |
| `viewpro-app/apps/app-new/src/components/themes/__tests__/color-mode.spec.ts` | Execute the generated preload in jsdom for the full matrix and failure contract. |
| `viewpro-app/apps/app-new/src/components/themes/__tests__/theme-provider.spec.tsx` | Mock `next-themes` and prove the wrapper forwards `defaultTheme='light'`, `enableSystem=true`, and existing caller props. |
| `viewpro-app/apps/app-new/src/components/themes/__tests__/theme-mode-toggle.spec.tsx` | Render the visible control with mocked `useTheme`; prove resolved light→dark and dark→light on the no-View-Transition path. |
| `viewpro-app/apps/app-new/src/components/kbar/use-theme-switching.test.tsx` | Capture registered KBar actions through mocked `useRegisterActions`; invoke explicit light/dark actions and assert exact `setTheme` requests. |

Test filenames follow the app's existing mixed `.test`/`.spec` Vitest discovery conventions. No production control component needs behavior changes.

## Deterministic test design

### Policy and browser-chrome matrix

`color-mode.spec.ts` starts each case with a real jsdom theme-color meta set to policy light, configures storage without observing source text, stubs `window.matchMedia`, executes the string returned by `buildThemeColorPreloadScript()`, and reads the resulting meta content.

Table-driven rows cover absent, light, dark, system, and unknown values against both light and dark OS states. Each supported saved row snapshots the value before execution and asserts it is identical afterward. Storage mutator spies assert no automatic writes.

Additional cases make `matchMedia` absent and throwing, make storage reads throw, execute with no meta element, and verify saved dark bypasses a failing media API. Assertions target DOM state, thrown/not-thrown behavior, and storage state—not script source substrings.

### Provider and responsiveness ownership

`theme-provider.spec.tsx` mocks only `NextThemesProvider`, renders the local wrapper, and captures runtime props. It asserts light fallback and `enableSystem=true`. This proves the app delegates supported saved-value reading and live saved-system responsiveness to `next-themes` rather than implementing a hydration listener.

### Existing controls

`theme-mode-toggle.spec.tsx` uses Testing Library/user-event with `useTheme` mocked per resolved mode and `document.startViewTransition` absent. It clicks the accessible `Toggle theme` button and asserts explicit `dark` or `light` calls.

`use-theme-switching.test.tsx` renders the hook, captures actions from mocked KBar registration, selects actions by stable IDs `setLightTheme` and `setDarkTheme`, invokes them, and asserts `setTheme('light')`/`setTheme('dark')`. It does not test or change the pre-existing raw-theme keyboard toggle edge.

No test imports backend services, seeded data, Playwright, or browser-origin fixtures.

## Strict TDD sequence

1. **RED — policy/provider contract:** add the preload and provider tests first. Run the focused command and record failure because the policy module/app-owned light provider configuration does not exist.
2. **Baseline regression characterization:** add visible-toggle and KBar explicit-action tests and confirm they pass against current behavior. These are preservation tests, so manufacturing a failure would be dishonest.
3. **GREEN — minimal behavior:** add `color-mode.ts`, configure the wrapper, and atomically switch layout viewport/preload consumption. Run all focused tests until green.
4. **REFACTOR — one policy:** remove old layout constants/condition, keep names and serialized policy minimal, format, and rerun focused tests after every cleanup.
5. **Full validation:** run the complete app checks below. Record exact output and any environment-only build failure; do not substitute seeded E2E.

## Validation commands

Run from `viewpro-app`:

```bash
# Focused RED/GREEN loop
pnpm --filter next-shadcn-dashboard-starter test -- \
  src/components/themes/__tests__/color-mode.spec.ts \
  src/components/themes/__tests__/theme-provider.spec.tsx \
  src/components/themes/__tests__/theme-mode-toggle.spec.tsx \
  src/components/kbar/use-theme-switching.test.tsx

# Full app validation available in current package scripts
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter lint:strict
pnpm --filter next-shadcn-dashboard-starter typecheck
pnpm --filter next-shadcn-dashboard-starter format:check
pnpm --filter next-shadcn-dashboard-starter build
```

The focused suite intentionally excludes `test:seeded`; this contract requires neither backend services nor seeded E2E.

## Boundaries

Explicitly untouched:

- all of `viewpro-app/apps/viewpro-web`;
- `DEFAULT_THEME`, `THEMES`, preset CSS, `data-theme`, `active_theme`, and preset cookies;
- `active-theme.tsx`, header composition, KBar toggle semantics, and control UI design;
- backend/API packages, schemas, databases, migrations, seeds, flags, and deployment data;
- `next-themes` internals and cross-app theme abstractions.

## Rollout and rollback

Ship provider fallback and meta preload together in one PR. No feature flag or data rollout is needed because no stored value is changed. Smoke-check a clean origin on dark and light OS settings, then a saved `system` origin while changing OS preference; clearing `active_theme` does not simulate absent color-mode storage.

Rollback is one atomic revert of the policy module, provider/layout changes, and focused tests. It restores system-driven behavior for unsaved origins and requires no storage, cookie, or database rollback.

## Collision audit, forecast, and review boundary

The rebased source still shows the exact old provider/meta behavior described above. A fresh search of active OpenSpec artifacts found no other active change naming `apps/app-new/src/app/layout.tsx`, `color-mode.ts`, `theme-mode-toggle.tsx`, or `use-theme-switching.tsx`; only this change and historical archive references match. Orchestrator evidence also reports no open PR before rebase and only untracked planning artifacts in this worktree.

Before the first apply write, rerun Git status/diff and GitHub collision checks because design-time file reads cannot prove that external branches remain unchanged. Under ask-on-risk, stop and ask if another active diff touches the provider, root preload, or control tests.

Forecast for implementation source and tests is **175–265 changed lines**: policy 25–40, provider/layout 15–30, matrix/provider tests 80–120, and control regressions 55–75. This remains one coherent PR and below the 400-line implementation review budget. If the measured implementation diff reaches 350 lines, re-estimate before adding coverage; do not split provider and preload behavior into separate PRs.

## Decision needed before apply

No product or architecture decision is unresolved. Apply remains procedurally blocked until the tasks phase is accepted and the pre-write collision/status gate is clean. Escalate only if that audit finds a collision, required validation cannot run in the declared app package, or the implementation forecast no longer fits the 400-line boundary.
