# Exploration: Default Light Theme (#282)

## Scope and current gap

Issue #282 is a product-app (`viewpro-app/apps/app-new`) color-mode bug. At base `origin/develop@80a943781cdb807051879273910a15d0bdb99e81`, `apps/app-new/src/app/layout.tsx` configures `next-themes` with `defaultTheme='system'`, `enableSystem`, class-based mode, transition suppression, and color-scheme support. Consequently, a browser with no `localStorage.theme` starts from the operating-system preference, not light.

The exact required contract is:

| Stored `localStorage.theme` | System is dark | Effective initial mode |
|---|---:|---|
| absent | either | `light` |
| `light` | either | `light` |
| `dark` | either | `dark` |
| `system` | false | `light` |
| `system` | true | `dark` |

`next-themes` owns the storage key `theme`, accepts `light`, `dark`, and `system`, injects its own pre-hydration class script, and makes `setTheme` persist explicit selections. `enableSystem` must remain enabled so an already saved `system` preference continues to resolve and react to media-query changes. Setting the provider default to `light` changes only the absent-storage fallback; it does not overwrite saved values.

## Independent preload behavior

Changing only `ThemeProvider defaultTheme` is insufficient for a consistent first paint. The root layout has a separate synchronous head script for `<meta name="theme-color">`. Its current condition treats both absent storage and saved `system` as system-driven:

```js
localStorage.theme === 'dark' ||
((!('theme' in localStorage) || localStorage.theme === 'system') &&
  matchMedia('(prefers-color-scheme: dark)').matches)
```

With only `defaultTheme='light'`, an unsaved dark-system browser would receive a light document/class from `next-themes` but a dark browser-chrome meta color from this script. The condition must distinguish absence from explicit `system`: dark meta only for saved `dark`, or saved `system` plus dark media. The server viewport already emits light (`#ffffff`), so the corrected script should leave it unchanged for absent/light and set `#09090b` for dark or dark-resolved system. The inline script remains appropriate because it runs before hydration and catches storage failures.

## Theme layers and switches

- `apps/app-new/src/app/layout.tsx`: server root, preset-cookie validation, light initial meta color, custom meta preload, and `next-themes` configuration.
- `apps/app-new/src/components/themes/theme-provider.tsx`: transparent client wrapper over `next-themes`; no independent defaults.
- `apps/app-new/src/components/themes/theme.config.ts`: `DEFAULT_THEME='inmoview'` is the visual **preset** selected through `data-theme` and the `active_theme` cookie. It is unrelated to light/dark mode and should not change.
- `apps/app-new/src/components/themes/active-theme.tsx`: persists the preset cookie and synchronizes `data-theme`; it does not own `localStorage.theme`.
- `apps/app-new/src/components/themes/theme-mode-toggle.tsx`: derives the opposite explicit mode from `resolvedTheme`, then calls `setTheme`; it works from light, dark, or system-resolved state and supports the optional View Transition API.
- `apps/app-new/src/components/kbar/use-theme-switching.tsx`: exposes explicit light/dark actions and a keyboard toggle. Its toggle reads raw `theme`, so a saved `system` would toggle to `light` regardless of resolved system mode; that pre-existing edge is outside #282 because the visible header toggle uses `resolvedTheme`, and no current UI action sets `system`.
- `apps/app-new/src/components/layout/header.tsx` and KBar palette expose the switches. No route-local layout overrides color mode.

## Product boundaries

Only `apps/app-new` is the InmoView tenant/product application and the target of #282. `apps/viewpro-web` is the separate ViewPro platform/operator console. It contains a nearly identical root/theme stack but uses the `viewpro` preset and has its own theme-config test; changing it would expand product scope without evidence. APIs and workspace packages do not own browser theme state. No retired third app surface was found in the workspace.

## Specifications and historical evidence

`openspec/config.yaml` declares consolidated capability specs under `openspec/specs` authoritative and `openspec/changes/archive` historical only. No consolidated capability requirement currently governs default color mode. The active specs distinguish InmoView `apps/app-new` from the platform console, supporting product-only scope. The two generated `apps/*/docs/themes.md` guides describe preset CSS, `data-theme`, and `active_theme`; they conflate preset “default theme” with color mode in places and are not a reliable contract for `localStorage.theme`. `apps/viewpro-web/src/components/themes/__tests__/theme.config.spec.ts` is historical implementation evidence for the platform preset rename, not coverage for #282.

The issue outcome needs one terminology correction in subsequent artifacts: “default theme” means the default **light/dark color mode**, not `DEFAULT_THEME`/the InmoView preset. No hidden migration, backend dependency, schema change, feature flag, or data rollout is required. Existing saved `light`, `dark`, and `system` values must not be cleared or rewritten. Rollout caveat: verify first navigation with a clean origin because `localStorage` is origin-scoped; clearing only the `active_theme` cookie does not simulate a new color-mode user.

## Small deterministic test seam

The current suite uses Vitest 4 with jsdom and Testing Library, but has no app-new color-mode tests. The smallest honest seam is a small colocated color-mode policy/preload module consumed by the root layout, plus focused jsdom tests:

1. Export a `light` absent-preference default and a resolver/preload-script builder that recognizes only `light`, `dark`, and `system`.
2. Execute the generated preload script against jsdom localStorage, a stubbed `matchMedia`, and a theme-color meta element for all matrix rows. This deterministically proves SSR light fallback and pre-hydration meta consistency without a browser or brittle source-text assertions.
3. Render `ThemeModeToggle` with `next-themes` mocked and assert light→dark and dark→light calls; run the no-View-Transition path and optionally one View Transition path.
4. Keep `enableSystem` on the provider. A focused provider-prop test is useful only if configuration is moved into the wrapper; otherwise the layout’s use of the shared default plus the resolver tests is the smaller seam.

A full Playwright test is not required for this bug and would be less deterministic because seeded E2E has authentication/server prerequisites. `next-themes` itself owns the HTML class anti-flash behavior; project tests should prove that provider configuration and the independent meta preload use the same fallback, not duplicate the dependency’s test suite.

## Likely implementation files and forecast

- `viewpro-app/apps/app-new/src/app/layout.tsx` — consume the light default/preload helper and retain `enableSystem`: about 4–12 changed lines.
- `viewpro-app/apps/app-new/src/components/themes/color-mode.ts` (new, name may vary) — storage/value contract and preload generation: about 20–40 lines.
- `viewpro-app/apps/app-new/src/components/themes/__tests__/color-mode.spec.ts` (new) — five preference cases plus preload/meta assertions: about 55–90 lines.
- `viewpro-app/apps/app-new/src/components/themes/__tests__/theme-mode-toggle.spec.tsx` (new, optional if combined) — toggle regression: about 35–60 lines.

Honest total forecast: **115–200 changed lines**, comfortably below the 400-line review budget. A tighter implementation may keep the script in layout and test a pure resolver, but must not leave the independent meta condition inconsistent. No app-new docs update is necessary unless planning chooses to correct the existing preset/color-mode terminology; doing so would add roughly 5–15 lines.

## Collision and risk assessment

The supplied candidate-selection evidence says no current open PR was found. Repository worktree metadata shows this worktree is isolated on `fix/default-light-theme` at the requested base. Searches across current OpenSpec artifacts found no other active change naming the likely app-new root/theme files. The platform, database, dependency, and navigation changes occupy different areas. The separately owned #287 worktree was not modified or used. Worktree existence alone does not prove absence of uncommitted edits, so final implementation should still perform a fresh Git status/diff and branch/PR collision check before writing.

Risk is low and localized, with one important consistency trap: provider fallback and custom meta preload must change atomically. No ask-on-risk escalation is currently indicated.
