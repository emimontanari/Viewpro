# Proposal: Default InmoView to Light Color Mode

## Decision

Change InmoView (`viewpro-app/apps/app-new`) so a browser origin with no saved color-mode preference starts in light mode. Preserve every explicit saved preference, including `system`, and align the provider fallback with the independent pre-hydration browser-chrome color so the first paint does not present conflicting modes.

Approved issue: #282 (`status:approved`).

## Problem

InmoView currently uses the operating-system preference when `localStorage.theme` is absent. A first-time or clean-origin user on a dark-configured device therefore starts in dark mode even though the intended product default is light. The root layout also owns a separate pre-hydration `theme-color` meta script; changing only the provider fallback would let an unsaved dark-system browser receive a light document while browser chrome remains dark during first paint.

The product language for this change is **default color mode**. It is unrelated to InmoView visual presets, including `DEFAULT_THEME='inmoview'`, `data-theme`, and the `active_theme` cookie.

## User Outcome

- A user visiting InmoView on an origin with no saved `localStorage.theme` sees light mode from first paint, regardless of operating-system preference.
- A returning user keeps their explicit saved `light`, `dark`, or `system` choice.
- A saved `system` choice continues to follow the operating system initially and when the media preference changes.
- Browser chrome and the rendered application agree on the initial color mode.
- Existing theme toggle and KBar light/dark actions continue to work.

## Scope

### In Scope

- Change only the InmoView tenant/product application under `viewpro-app/apps/app-new`.
- Use light as the provider fallback when `localStorage.theme` is absent.
- Keep `enableSystem` enabled.
- Update the independent pre-hydration `theme-color` policy so absence resolves to light while an explicitly saved `system` value still follows `prefers-color-scheme`.
- Introduce the smallest pure color-mode/preload policy seam needed to keep both decisions consistent and testable.
- Add focused tests for the saved-preference matrix and regression coverage for explicit light/dark switching.

### Preference Contract and Compatibility

| Saved `localStorage.theme` | Operating system | Effective initial color mode |
|---|---|---|
| absent | light or dark | `light` |
| `light` | light or dark | `light` |
| `dark` | light or dark | `dark` |
| `system` | light | `light` |
| `system` | dark | `dark` |

Compatibility requirements:

- Existing saved values MUST NOT be cleared, rewritten, or migrated.
- `enableSystem` MUST remain active so saved `system` preferences retain initial and live media-query behavior.
- The server's existing light `theme-color` fallback remains compatible with absent and saved-light states.
- The pre-hydration meta policy changes to dark only for saved `dark`, or saved `system` when the operating system is dark.
- Existing explicit light/dark actions in the theme toggle and KBar remain functional.

## Non-Goals

- No changes to the ViewPro platform/operator console (`viewpro-app/apps/viewpro-web`).
- No changes to `DEFAULT_THEME='inmoview'`, visual preset CSS, `data-theme`, or the `active_theme` cookie.
- No new UI for selecting `system` and no redesign of current theme controls.
- No correction of the pre-existing KBar raw-`theme` toggle edge for a saved `system` value.
- No backend, API, schema, migration, seed, deployment flag, or data rollout changes.
- No broad theme documentation rewrite or cross-application theme abstraction.

## Affected Capability

### New Capability: InmoView Default Color Mode

No consolidated capability currently specifies InmoView's default color-mode behavior. The next spec phase should add a focused capability contract covering:

1. light fallback when no color-mode preference is saved;
2. preservation and resolution of saved `light`, `dark`, and `system` values;
3. consistency between application mode and pre-hydration browser-chrome color; and
4. continued operation of explicit light/dark controls.

The existing `operator-console` capability remains unchanged and confirms that `apps/viewpro-web` is a separate platform surface.

## Affected Areas

| Area | Expected impact |
|---|---|
| `viewpro-app/apps/app-new/src/app/layout.tsx` | Consume the light fallback/preload policy while retaining `enableSystem`. |
| `viewpro-app/apps/app-new/src/components/themes/` | Host a small pure color-mode policy or preload helper. |
| Focused app-new theme tests | Verify the preference matrix, pre-hydration meta result, and explicit light/dark actions. |
| OpenSpec change artifacts | Define and review the new default color-mode capability before implementation. |

No other application, service, storage schema, or operational workflow is affected.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Provider fallback and meta preload diverge | First paint and browser chrome show conflicting modes. | Derive both from one explicit policy and test the complete preference matrix. |
| Saved `system` is accidentally treated as absent | Returning users lose system-following behavior. | Distinguish key absence from the explicit `system` value and keep `enableSystem`. |
| Saved preferences are overwritten | Existing user choices change unexpectedly. | Change fallback resolution only; do not write to local storage. |
| Visual preset behavior is changed by terminology confusion | InmoView branding or preset selection regresses. | Keep preset constants, cookie handling, and `data-theme` outside the implementation boundary. |
| Scope expands to the platform console | An unrelated product surface changes without authorization. | Restrict implementation and tests to `apps/app-new`. |
| Clean-origin behavior is verified incorrectly | A retained origin-scoped value masks the new fallback. | Validate absent preference with a clean origin or cleared `localStorage.theme`, not by clearing `active_theme`. |

## Rollback

Revert the app-new provider fallback and pre-hydration meta policy together, along with their focused tests and helper if introduced. An atomic rollback restores the prior system-driven behavior for origins without saved preferences while leaving all saved preferences and visual preset data untouched. No database, schema, cookie, or local-storage migration requires reversal.

## Success Criteria

- [ ] With no `localStorage.theme`, InmoView starts in light mode on both light and dark operating systems.
- [ ] Saved `light` starts light and saved `dark` starts dark regardless of operating-system preference.
- [ ] Saved `system` resolves to the operating-system preference and continues reacting to media changes.
- [ ] The provider fallback and pre-hydration `theme-color` behavior agree for every preference-matrix row.
- [ ] No implementation clears or rewrites `localStorage.theme`.
- [ ] `enableSystem` remains enabled.
- [ ] Existing theme toggle and KBar explicit light/dark actions remain functional.
- [ ] `DEFAULT_THEME='inmoview'`, `active_theme`, visual presets, and `apps/viewpro-web` remain unchanged.
- [ ] Focused automated tests cover the color-mode policy and switching regression without requiring backend or seeded E2E infrastructure.

## Review Forecast

Deliver as **one small PR under 400 changed lines**, forecast at approximately **115–200 changed lines** across the app-new root layout, one small pure policy/preload module, and focused tests. Review should first verify the five-row compatibility matrix, then confirm provider/meta consistency, and finally confirm the preset and platform-console boundaries remain untouched.
