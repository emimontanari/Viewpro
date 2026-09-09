# Proposal — Movement label save race
## Intent
Prevent a movement from being saved without the inline-created outcome label the user selected.
## Scope
- Propagate inline label-creation pending state to its owning combobox/dialog instance.
- Disable and defensively block movement submit until successful label creation commits the returned selection.
- On failure, preserve the inline error and form, clear pending, and allow retry, cancel, or an explicit outcome-less save.
- Ignore stale completions after close/unmount and isolate lifecycle state between concurrent dialog instances.
## Affected areas
Movement label form, outcome combobox, movement dialog, focused unit tests, and the seeded movement scenario.
## Non-goals
No API, permission, schema, dependency, DTO #583, timeout, or unrelated workflow changes.
## Risks and rollback
Risk is a stranded disabled state or cross-instance completion; instance-scoped guards and close resets contain it. Roll back the frontend state propagation and its tests as one unit.
## Success criteria
- Delayed creation blocks button and handler submission; resolution permits exactly one movement carrying the returned `customLabelId`.
- Failed or stale creation causes no implicit movement or selection and leaves the current workflow recoverable.
- Unit coverage exercises delayed success, error recovery, and stale-instance isolation; seeded coverage awaits explicit selected-label UI before save.
