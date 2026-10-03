# Proposal: Property detail workspace (#349)

**Status: ACCEPTED DESIGN; implementation not yet performed or verified.**

## Accepted scope

Add a simple same-page navigation hub to the existing property detail page, linking to four groups of existing content/actions:

1. **Datos e imágenes** — existing read-only property data and images; retain an obvious, permission-gated route to edit via `/dashboard/product/{id}/edit`.
2. **Personas** — existing owner and agent content/operations.
3. **Actividad** — existing status, movement history, and actions.
4. **Documentos** — existing document requests/review.

Navigation links must lead to stable valid targets and expose their content on narrow and wide layouts. Use keyboard-operable links and visible content; do not implement tabs that hide sections.

## Preserve / exclude

Preserve `/dashboard/product/{id}/edit`, explicit list return, and current edit cancel/save return to detail. No inline editing, new APIs/mutations/permissions, route migration, or changes to management gates, seller viewing/status-request/document actions, or archive-state behavior. Existing server authorization remains authoritative.

## Acceptance

The four links navigate to meaningful existing content; the data/images link is not decorative and the existing editor remains the editing affordance. Tests and browser checks must protect valid targets, permission/archive behavior, keyboard/responsive usability, and existing edit/save/cancel navigation. This proposal describes accepted intent, not completed behavior.
