# Design — Movement label save race
## Decision and flow
1. Keep pending state in each `CreatePropertyMovementDialog`; pass its setter through `MovementOutcomeCombobox` to `MovementOutcomeCreateLabelForm` as `onCreatePendingChange`/`onPendingChange`.
2. The inline form preserves its own `<form>` submit, `preventDefault`, mutation error UI, buttons, query-cache update, and focus behavior; it reports `true` immediately before starting the mutation.
3. Guard each mutation completion with that form mount plus operation identity; refs serve only stale-callback validation and never replace React pending state or authorize movement submission.
4. On active success, retain cache behavior, call `onCreated` to publish `custom:<returned id>`, then report `false`; selection is therefore queued before movement saving unlocks.
5. On active failure, leave TanStack mutation error state/`FieldError` intact and report `false` from settlement/finally; never select, retry, or submit implicitly.
6. Combobox close/cancel invalidates its active create operation, hides the inline form, clears only its instance pending callback, and restores existing focus semantics.
7. Dialog close resets values, errors, and label-pending state; every mounted dialog owns independent state, so reopen and concurrent instances cannot share lifecycle state.
8. The save button is disabled by `isSubmitting || isCreatingOutcomeLabel`; `handleSubmit`, after `preventDefault`, returns early on the same state before validation or `onSubmit`, preserving pointer and keyboard form semantics.
## Files
- Update only the three approved product components above, their two colocated unit tests, and the seeded smoke scenario; no API, DTO, schema, dependency, or unrelated feature changes.
## Exact tests
- Combobox deferred success: pending reports `true`, selection is absent before resolution, then `custom:label-1` is emitted before pending reports `false`.
- Dialog delayed response: Save is disabled and direct form submit emits zero movements; after resolution the visible selected label precedes one save carrying `outcome.customLabelId = label-1`.
- Error: reject creation, assert existing API message remains, no selection/submission occurs, pending clears, and explicit outcome-less save is available.
- Cancel/reopen: start deferred creation, close and reopen, resolve the old promise, then assert the new instance stays enabled, unselected, error-free, and submits no stale movement.
- Seeded smoke: after `Crear etiqueta`, await `Smoke test label` on the outcome combobox before filling/saving; retain the status invariant.
## Safety and rollout
- Cancellation only detaches UI callbacks; it does not abort, delete, compensate, or otherwise pretend to reverse the already-issued label request.
- Roll back components and focused tests together. Current docs 73 lines plus this 21-line design keep the approved total forecast within 400; pause under `ask-on-risk` if implementation exceeds it.
