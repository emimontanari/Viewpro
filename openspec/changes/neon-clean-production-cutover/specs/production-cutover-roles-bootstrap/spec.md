# Production Cutover Roles and Bootstrap Specification

## Purpose

Define least-privilege lane roles, the clean bootstrap allowlist, and the activation baseline that gates each lane.

## Named Threat Contracts

These identifiers are referenced by task 3.1 and are restated here because the design table that defined them was removed by `e083fc3`; they are recovered from `800d1a3`. Each names one hostile case a test MUST prove fails closed.

| ID | Module | Failure oracle |
|---|---|---|
| RED-CUT-09 | `roles.mjs` | catalog detects any excess privilege, ownership or membership |
| RED-CUT-10 | `bootstrap.mjs` | any non-allowlisted row rejected |
| RED-CUT-11 | `bootstrap.mjs` | non-`200` readiness or wrong baseline rejected |

RED-CUT-11's recovered row names `checkpoint.mjs`. That module is already merged and carries no readiness or baseline evidence, and this work unit's paths are `roles.mjs` and `bootstrap.mjs`. The baseline validator therefore lives in `bootstrap.mjs`, which already judges the platform lane's operator count and singleton. Its cursor member differs from the allowlist's: the baseline's `cursor` is a sequence position, while the allowlist's `ingestCursor` is a row count. A checkpoint consumer is intended to call this validator rather than restate it; no such caller exists yet.

## Requirements

### Requirement: Least-Privilege Lane Roles

Every lane MUST run three distinct identities: a privileged direct migrator, a least-privilege pooled runtime, and a read-only direct backup. `PUBLIC` MUST hold no database `CONNECT`, `TEMPORARY` or `CREATE`, and no schema `CREATE`. The migrator MAY own migration objects and hold schema `USAGE` and `CREATE`, and MUST NOT hold superuser, role-creation, database-creation or replication authority. The runtime MUST hold schema `USAGE`, table data manipulation and sequence use, and MUST NOT hold ownership, role membership, any data definition authority, or database `CREATE` or `TEMPORARY`. The backup MUST hold schema, table and sequence reads only.

Judgement MUST be made from a supplied catalog snapshot rather than a live connection, so the validator holds no network or provider authority. The snapshot MUST be taken from data alone: an accessor or a `toJSON` member lets a live object hand the serializer something other than itself, so both MUST be refused before serialization rather than invoked. The catalog MUST be bound to the lane the caller expects, as every other validator here is. A grant the model does not require is excess whether it arrives as a privilege, an ownership row, or a role membership: each MUST be judged, and a missing required grant MUST be judged too, so a lane cannot pass by holding nothing. The permitted set MUST be closed and testable as a complement, because a hand-written list of forbidden pairs cannot notice the permitted set widening, which is the failure this requirement exists to catch. Reads accompany writes, so a runtime holding table and sequence reads remains least privilege; a backup holding any write does not.

Ownership MUST be bounded even for the migrator, because ownership carries the authority to alter and drop an object and to disable its row-level security. An approval MUST be a non-empty string and an expiry MUST be a real instant, not merely a well-shaped one: a syntactically valid but impossible date sorts after every real date and would make an exception permanent.

#### Scenario: Excess privilege, ownership or membership detected (RED-CUT-09)
- GIVEN a catalog snapshot granting a role any privilege, object ownership or role membership the lane model does not require
- WHEN the catalog is evaluated
- THEN it is rejected and names the principal and the grant

#### Scenario: Missing required grant detected
- GIVEN a catalog snapshot omitting a grant the lane model requires
- WHEN the catalog is evaluated
- THEN it is rejected and names the principal and the grant

#### Scenario: Owner exception admitted only while approved and unexpired
- GIVEN a default-owner exception carrying an approval and an expiry
- WHEN the catalog is evaluated
- THEN it is admitted only while the approval is a non-empty string and the expiry is a real instant still in the future, and is otherwise rejected

#### Scenario: Every denied grant pair is refused
- GIVEN the complement of the required and permitted sets over the whole grant vocabulary
- WHEN each denied pair is evaluated in turn
- THEN every one is rejected, and every permitted grant is still accepted

### Requirement: Clean Bootstrap Allowlist

A freshly bootstrapped lane MUST contain only what the allowlist admits. The product lane admits its migration ledger and schema objects, and no business row whatsoever. The platform lane admits its migration ledger, exactly one ingest cursor row at sequence `0`, exactly one operator, empty metrics and an empty tenant registry. Any other table, any additional row, a non-zero cursor, an operator count other than one, a non-empty metric, or any retained old or demonstration row MUST be rejected.

The census MUST be evaluated as a closed set: an unrecognised table is rejected rather than ignored, because a validator that skips what it does not recognise proves nothing about what it did not look at.

#### Scenario: Non-allowlisted row rejected (RED-CUT-10)
- GIVEN a census carrying any row, table, cursor value, operator count or metric the allowlist does not admit
- WHEN the census is evaluated
- THEN it is rejected and names the offending table

#### Scenario: Clean bootstrap accepted
- GIVEN a census of exactly the migration ledger, one cursor at `0`, one operator, empty metrics and an empty registry
- WHEN the census is evaluated
- THEN it is accepted and reports no authority

### Requirement: Activation Baseline

Activation is gated per lane and MUST NOT proceed on partial evidence. The product lane activates only on a matching image digest, a readiness observation of exactly `200`, and an allowlist that admits no rows. The platform lane activates only on a matching image digest, a readiness observation of exactly `200`, a singleton, a cursor at `0` and exactly one operator. A readiness observation that is not `200` MUST be rejected, including `503`, because liveness alone proves neither the database nor the candidate. The expected image digest MUST itself be well formed, so a malformed digest cannot activate by matching an equally malformed one. A baseline belonging to the other lane, or missing any member its lane requires, MUST be rejected rather than partially credited.

#### Scenario: Non-200 readiness or wrong baseline rejected (RED-CUT-11)
- GIVEN a baseline whose readiness is not exactly `200`, whose digest does not match, or which omits or misstates any member its lane requires
- WHEN activation is evaluated
- THEN it is rejected and names what failed

#### Scenario: Matching baseline admits activation
- GIVEN a baseline matching every member its lane requires
- WHEN activation is evaluated
- THEN activation is admitted for that lane only, and reports no authority

### Requirement: Local-Only Non-Authority

Roles and bootstrap are pure validators over supplied snapshots. They MUST perform no network access, no provider mutation, no provisioning, no deployment, promotion, traffic change or release, and MUST hold no repository, Git, process or CLI authority. No secret value, host, role name, project identifier or raw provider response may appear in any result. A denial therefore names only a closed-vocabulary token, or a position when the offending value is not one of ours: a catalog's own names are deployed identities, and a denial is public evidence. A fault MUST carry a reason distinct from every in-band rejection, so a defect cannot be read as a routine denial. Every result MUST report authority as denied.

#### Scenario: Provisioning never authorised
- GIVEN any roles or bootstrap outcome, accepted or rejected
- WHEN the result is inspected
- THEN authority is denied, provisioning is not requested, and no external state has changed
