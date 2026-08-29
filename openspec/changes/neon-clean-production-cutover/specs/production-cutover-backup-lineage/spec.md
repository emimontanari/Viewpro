# Production Cutover Backup Lineage Specification

## Purpose

Define generation-specific backup lineages, the collision rule between them, and the retention window a prune may never shorten.

## Named Threat Contracts

This identifier is referenced by task 3.2 and is restated here because the design table that defined it was removed by `e083fc3`; it is recovered from `800d1a3`. It names the hostile cases a test MUST prove fail closed.

| ID | Module | Failure oracle |
|---|---|---|
| RED-CUT-08 | `backup-lineage.mjs` | prefix collision or retained-lineage prune rejected |

Throughout this document a prefix is an object-store key prefix, not the Git commit prefix the Lineage and Release contracts bind. The two are unrelated and must not be conflated.

## Requirements

### Requirement: Generation-Specific Backup Lineage

Each lane's backups belong to a lineage identified by its lane, its generation, and the key prefix that addresses it. A lineage MUST carry the instant its retention window opens. Reusing a previous generation's prefix MUST be rejected, because a fresh generation writing under a retained prefix interleaves two generations under one address and makes retention and rollback ambiguous.

Judgement MUST be made from a supplied lineage description rather than a live object store, so the validator holds no network or provider authority. It MUST be taken from data alone: an accessor or a `toJSON` member lets a live object hand the serializer something other than itself, and both MUST be refused before serialization rather than invoked.

#### Scenario: A fresh lineage is accepted
- GIVEN a lineage whose lane, generation and prefix are well formed and whose prefix belongs to no other lineage
- WHEN it is evaluated
- THEN it is accepted and reports no authority

#### Scenario: A reused or malformed prefix is rejected
- GIVEN a lineage whose prefix is empty, malformed, or already addresses another generation
- WHEN it is evaluated
- THEN it is rejected and names what failed

### Requirement: Prefix Collision

Two lineages collide when either prefix is a leading string of the other. An object store lists by byte prefix with no path semantics, so a scan of a fresh `<name>` returns every key under a retained `<name>-<generation>`. Judging on whole path segments would call that pair distinct and permit exactly the sweep this rule exists to prevent, so collision MUST be judged from position zero: `alpha` collides with `alpha/beta`, with `alpha-gen2`, and with `alphabet`. A generation MUST therefore be its own path segment rather than a suffix. A value that cannot be compared MUST be treated as colliding, because a safety predicate that cannot tell must not answer "distinct".

#### Scenario: Overlapping prefixes rejected (RED-CUT-08)
- GIVEN a lineage whose prefix is a leading string of another lineage's prefix, in either direction
- WHEN the set of lineages is evaluated
- THEN it is rejected and names the colliding lineage by position

#### Scenario: Genuinely distinct prefixes accepted
- GIVEN two prefixes neither of which is a leading string of the other
- WHEN the set of lineages is evaluated
- THEN they are accepted as distinct

### Requirement: Retained Lineage Is Never Pruned

A retained lineage MUST survive one calendar month from the instant its retention window opens. A prune MUST be rejected when any object it would remove belongs to a lineage still inside that window. This is a calendar month rather than a fixed number of days, because a thirty-day rule is shorter than a month for most months of the year and would delete rollback evidence a day early. A day the following month does not have MUST overflow into the month after rather than clamp to the month's last day: retention is a floor, and clamping 31 January to 28 February would yield a twenty-eight day window, shorter than the rule it replaces. An unusable retention instant MUST be treated as unelapsed, never as elapsed.

The supplied set of lineages MUST be complete. The validator judges only what it is given, so a retained lineage omitted from the set is a retained lineage it cannot protect; a caller MUST derive the set from the store rather than author it by hand.

A prune MUST also be rejected when it names an object outside its own lineage's prefix, because a prune is authorised for one lineage and may never reach across to another. Ownership is exact identity, never containment, so a plan naming a descendant of a known prefix is refused rather than judged against its parent's clock. The same key grammar governs prefixes and whole object keys, so a wildcard or a traversal in either is refused before containment is consulted. Evaluating a prune grants nothing: the validator refuses or permits, and never removes anything itself.

#### Scenario: Prune of a retained lineage rejected (RED-CUT-08)
- GIVEN a prune naming any object under a lineage whose calendar month has not elapsed
- WHEN the prune is evaluated
- THEN it is rejected and names the retained lineage

#### Scenario: A thirty-day prune of a month-old retention rejected
- GIVEN a retained lineage whose window opened thirty days ago in a month longer than thirty days
- WHEN a prune of its objects is evaluated
- THEN it is rejected, because thirty days is not yet one calendar month

#### Scenario: Prune reaching outside its own lineage rejected
- GIVEN a prune naming an object whose key does not lie under the lineage it was authorised for
- WHEN the prune is evaluated
- THEN it is rejected

#### Scenario: Prune of an elapsed lineage permitted
- GIVEN a prune naming only objects under its own lineage, whose calendar month has fully elapsed
- WHEN the prune is evaluated
- THEN it is permitted, and still reports no authority

### Requirement: Local-Only Non-Authority

Backup lineage is a pure validator over supplied descriptions. It MUST perform no network access, no object-store access, no deletion, no provider mutation, no provisioning, deployment, promotion, traffic change or release, and MUST hold no repository, Git, process or CLI authority. No secret value, host, bucket, role name, project identifier or raw provider response may appear in any result: a denial names only a closed-vocabulary token or a position, because a key is a deployed identity and a denial is public evidence. A fault MUST carry a reason distinct from every in-band rejection, so a defect cannot be read as a routine denial. Every result MUST report authority as denied.

#### Scenario: Deletion never authorised
- GIVEN any lineage or prune outcome, permitted or rejected
- WHEN the result is inspected
- THEN authority is denied, nothing is removed, and no external state has changed
