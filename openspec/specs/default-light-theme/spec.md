# InmoView Default Color Mode Specification

## Purpose

InmoView MUST start in light color mode when the browser origin has no saved color-mode preference, while preserving explicit saved preferences and existing theme controls. This capability applies only to `apps/app-new`; it does not change InmoView visual presets or the separate ViewPro operator console.

The term **default color mode** in this specification means the light/dark mode selected when no explicit preference is saved. It does not refer to the `DEFAULT_THEME='inmoview'` visual preset.

## Requirements

### Requirement: Light default color mode for absent preference

When `localStorage.theme` is absent, InmoView MUST resolve its initial color mode to `light`, regardless of the operating-system color preference. The absence of the storage key MUST be distinguished from an explicit saved `system` value.

#### Scenario: Absent preference on a light operating system

- GIVEN the browser origin has no `localStorage.theme` value
- AND the operating system prefers light color mode
- WHEN InmoView initializes
- THEN the application resolves to light color mode

#### Scenario: Absent preference on a dark operating system

- GIVEN the browser origin has no `localStorage.theme` value
- AND the operating system prefers dark color mode
- WHEN InmoView initializes
- THEN the application resolves to light color mode

### Requirement: Explicit light and dark preferences remain authoritative

When `localStorage.theme` is explicitly saved as `light` or `dark`, InmoView MUST use that saved color mode initially, regardless of the operating-system preference. This change MUST NOT reinterpret either explicit value as an operating-system-dependent choice.

#### Scenario: Saved light preference on either operating-system mode

- GIVEN `localStorage.theme` is `light`
- AND the operating system prefers either light or dark color mode
- WHEN InmoView initializes
- THEN the application resolves to light color mode

#### Scenario: Saved dark preference on either operating-system mode

- GIVEN `localStorage.theme` is `dark`
- AND the operating system prefers either light or dark color mode
- WHEN InmoView initializes
- THEN the application resolves to dark color mode

### Requirement: Explicit system preference follows media changes

When `localStorage.theme` is explicitly saved as `system`, InmoView MUST resolve its initial color mode from the operating-system color preference and MUST continue reacting to subsequent `prefers-color-scheme` media changes. The color-mode provider MUST keep `enableSystem` enabled so this behavior remains available.

#### Scenario: Saved system preference resolves initially

- GIVEN `localStorage.theme` is `system`
- AND the operating system prefers light color mode
- WHEN InmoView initializes
- THEN the application resolves to light color mode
- WHEN the operating system prefers dark color mode instead
- THEN the application resolves to dark color mode

#### Scenario: Saved system preference reacts to a media change

- GIVEN `localStorage.theme` is `system`
- AND the operating system initially prefers light color mode
- WHEN the `prefers-color-scheme` media preference changes to dark
- THEN the application changes to dark color mode without requiring a new saved preference
- WHEN the media preference changes back to light
- THEN the application changes back to light color mode

### Requirement: Initial application mode and browser chrome are consistent

For every supported saved-preference and operating-system combination, the initial application color mode and the pre-hydration browser-chrome `theme-color` MUST resolve to the same light or dark result. Browser chrome MUST use the dark color only when `localStorage.theme` is `dark`, or when `localStorage.theme` is `system` and the operating system prefers dark color mode. All other supported matrix rows MUST use the light color.

#### Scenario: Initial color-mode matrix agrees for all rows

- GIVEN the saved preference is absent, `light`, `dark`, or `system`
- AND the operating system is either light or dark
- WHEN the application and browser chrome resolve their initial colors before hydration completes
- THEN both resolve to light for absent preference on either operating-system mode
- AND both resolve to light for saved `light` on either operating-system mode
- AND both resolve to dark for saved `dark` on either operating-system mode
- AND both resolve to light for saved `system` with a light operating system
- AND both resolve to dark for saved `system` with a dark operating system

#### Scenario: Dark browser-chrome color is limited to dark outcomes

- GIVEN the browser chrome has an initial `theme-color`
- WHEN `localStorage.theme` is absent or `light`
- THEN the initial browser-chrome color is light regardless of the operating-system preference
- WHEN `localStorage.theme` is `dark`
- THEN the initial browser-chrome color is dark regardless of the operating-system preference
- WHEN `localStorage.theme` is `system`
- THEN the initial browser-chrome color is dark only when the operating system prefers dark color mode

### Requirement: Saved color-mode preferences are preserved

Initialization and default color-mode resolution MUST NOT clear, rewrite, migrate, or otherwise transform an existing `localStorage.theme` preference. The change MUST NOT introduce a storage migration or automatic persistence operation. A user-initiated existing light/dark control action MAY persist the mode explicitly chosen by that user; that action is not a migration.

#### Scenario: Returning users retain saved preferences

- GIVEN `localStorage.theme` contains `light`, `dark`, or `system`
- WHEN InmoView initializes or responds to the operating-system preference
- THEN the stored value remains unchanged
- AND no automatic clear, rewrite, or migration is performed

### Requirement: Existing explicit color-mode controls remain functional

The existing visible color-mode toggle MUST continue to switch between explicit light and dark color modes. The existing KBar actions for explicitly setting light and explicitly setting dark MUST continue to request the corresponding color mode and remain usable after this change.

#### Scenario: Visible toggle switches from light to dark

- GIVEN the visible color-mode toggle is available
- AND the current resolved color mode is light
- WHEN the user activates the toggle
- THEN InmoView changes to explicit dark color mode

#### Scenario: Visible toggle switches from dark to light

- GIVEN the visible color-mode toggle is available
- AND the current resolved color mode is dark
- WHEN the user activates the toggle
- THEN InmoView changes to explicit light color mode

#### Scenario: KBar explicit actions remain available

- GIVEN the KBar theme actions are available
- WHEN the user invokes the explicit light action
- THEN InmoView changes to light color mode
- WHEN the user invokes the explicit dark action
- THEN InmoView changes to dark color mode

### Requirement: Visual preset and application boundaries remain unchanged

This change MUST leave the InmoView visual preset contract unchanged. `DEFAULT_THEME='inmoview'`, preset selection, the `active_theme` cookie, and the `data-theme` behavior MUST continue to operate as before. The separate `apps/viewpro-web` application MUST remain unchanged by this capability.

#### Scenario: Preset behavior is independent of color mode

- GIVEN an InmoView visual preset is selected or the `active_theme` cookie is absent
- WHEN InmoView resolves its light or dark color mode
- THEN the selected preset and `data-theme` behavior remain governed by the existing preset contract
- AND the default preset remains `inmoview`

#### Scenario: Platform console is unaffected

- GIVEN the color-mode change is deployed for InmoView
- WHEN `apps/viewpro-web` is built or used
- THEN its color-mode, preset, and application behavior remain unchanged

### Requirement: Focused deterministic verification proves the contract

The implementation MUST include focused automated tests that deterministically cover the complete saved-preference matrix, initial application/browser-chrome consistency, preservation of saved values, and existing explicit light/dark controls. These tests MUST run without backend services, seeded data, database setup, or seeded end-to-end prerequisites.

#### Scenario: Matrix and preservation tests run in isolation

- GIVEN the focused color-mode test suite is run in its supported local test environment
- WHEN the suite evaluates absent, `light`, `dark`, and `system` preferences across light and dark operating-system states
- THEN it proves the expected initial application and browser-chrome results for every matrix row
- AND it proves saved values are not automatically changed
- AND it does not require a backend, seeded database, or seeded end-to-end environment

#### Scenario: Control regression tests run in isolation

- GIVEN the focused color-mode control tests are run without application services
- WHEN they exercise the visible toggle and KBar explicit light/dark actions
- THEN they prove those actions still request and produce the corresponding explicit modes
- AND the tests do not require backend or seeded end-to-end prerequisites

## Non-Goals

- Changing `apps/viewpro-web` or any platform/operator-console behavior.
- Changing `DEFAULT_THEME='inmoview'`, visual preset CSS, `data-theme`, or the `active_theme` cookie.
- Adding a new user interface for selecting `system` or redesigning the existing color-mode controls.
- Correcting the pre-existing KBar raw-`theme` toggle edge when the saved value is `system`.
- Clearing, rewriting, or migrating existing color-mode preferences.
- Adding backend, API, schema, database, seed, deployment-flag, or data-rollout changes.
- Requiring backend-dependent or seeded end-to-end infrastructure for focused verification.
- Specifying particular implementation files, helper names, code shapes, or framework-internal mechanisms beyond the required `enableSystem` behavior.

## Requirement-to-Scenario Traceability

| Decision or acceptance criterion | Requirement | Scenarios |
|---|---|---|
| No saved preference starts light on light or dark OS | Light default color mode for absent preference | Absent preference on a light operating system; Absent preference on a dark operating system |
| Saved light and dark remain authoritative | Explicit light and dark preferences remain authoritative | Saved light preference on either operating-system mode; Saved dark preference on either operating-system mode |
| Saved system follows and reacts to OS | Explicit system preference follows media changes | Saved system preference resolves initially; Saved system preference reacts to a media change |
| Provider/pre-hydration/browser chrome agree across matrix | Initial application mode and browser chrome are consistent | Initial color-mode matrix agrees for all rows; Dark browser-chrome color is limited to dark outcomes |
| Preferences are not cleared, rewritten, or migrated | Saved color-mode preferences are preserved | Returning users retain saved preferences |
| Visible toggle and KBar explicit actions work | Existing explicit color-mode controls remain functional | Visible toggle switches from light to dark; Visible toggle switches from dark to light; KBar explicit actions remain available |
| Presets and platform-console boundary stay unchanged | Visual preset and application boundaries remain unchanged | Preset behavior is independent of color mode; Platform console is unaffected |
| Focused tests are deterministic and service-independent | Focused deterministic verification proves the contract | Matrix and preservation tests run in isolation; Control regression tests run in isolation |
