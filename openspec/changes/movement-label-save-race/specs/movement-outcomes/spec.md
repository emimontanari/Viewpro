# Movement Outcomes Specification

## Purpose

Preserve movement-outcome semantics when an inline custom label is created while a movement is being saved.

## Requirements

### Requirement: Pending label creation gates movement submission
While inline label creation is pending, the movement form MUST disable its save button and reject movement submission in the submit handler, including keyboard-triggered form submission. No movement request may be emitted.
#### Scenario: Pending creation blocks pointer and keyboard saves
- GIVEN the movement form is creating an inline custom label
- WHEN the user activates Save with a pointer or submits with the keyboard
- THEN the save control is unavailable and no movement request is emitted

### Requirement: Successful label creation is carried into the movement request
After inline label creation succeeds, the returned selection MUST be committed before movement submission is allowed. The next permitted request MUST carry that returned `customLabelId`, preserving existing outcome semantics.
#### Scenario: Resolved label is submitted once
- GIVEN inline label creation succeeds with custom label id `label-1`
- WHEN the user saves the movement
- THEN exactly one movement request carries `outcome.customLabelId = label-1`

### Requirement: Label failure restores the existing workflow
If inline label creation fails, the form MUST preserve its existing error, clear only the pending block, restore the save control, and allow retry, cancel, or an explicit outcome-less save. Failure MUST NOT silently create a movement or select a label.
#### Scenario: Failed creation remains recoverable
- GIVEN inline label creation fails
- WHEN the failure is shown
- THEN the current form remains open with its error and no movement is created or implicitly selected

### Requirement: Stale label operations cannot affect a new instance
After a combobox or dialog is cancelled, closed, unmounted, or reopened as a new instance, a late prior completion MUST NOT change the new instance's pending state, selection, error, or movement submission. Existing outcome and keyboard semantics MUST otherwise remain unchanged.
#### Scenario: Cancel and reopen isolates late completion
- GIVEN label creation is pending and the current instance is cancelled and reopened
- WHEN the prior operation completes
- THEN the reopened instance remains independently usable and no stale label or movement action is applied
