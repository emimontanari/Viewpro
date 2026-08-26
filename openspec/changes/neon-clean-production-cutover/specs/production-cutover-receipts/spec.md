# Production Cutover Receipts and Checkpoints Specification

## Purpose

Define the canonical public receipt, its redaction boundary, and the fail-closed activation checkpoint.

## Named Threat Contracts

These identifiers are referenced by task 2.5 and are restated here because the design table that once defined them was removed. Each names one hostile case a test MUST prove fails closed.

| ID | Module | Failure oracle |
|---|---|---|
| RED-CUT-05 | `receipt.mjs` | secret or raw identifier redacted |
| RED-CUT-06 | `checkpoint.mjs` | partial provider state fails closed |
| RED-CUT-07 | `receipt.mjs` | wrong generation, digest, or state rejected |

## Requirements

### Requirement: Canonical Receipt Serialization

A receipt MUST serialize to RFC 8785 JSON Canonicalization Scheme form, so an independent party reproduces its digest byte for byte. Object members MUST be ordered by their UTF-16 code units, no insignificant whitespace may appear, and only the escapes RFC 8785 permits may be emitted. Serialization MUST fail closed rather than emit a lossy form: non-finite numbers, `undefined`, functions, symbols, bigints, cycles, lone surrogates, non-plain prototypes, and Proxies MUST all be rejected. The digest MUST be computed over the canonical UTF-8 bytes in process, never by an external command. Serialization MUST also refuse excessive depth, so exhausting the stack is never mistaken for a refusal.

#### Scenario: Canonical form is reproducible
- GIVEN two receipts whose members differ only in insertion order
- WHEN each is canonicalized
- THEN both produce identical bytes and identical digests

#### Scenario: Shared references allowed, cycles refused
- GIVEN the same object reached twice down different branches
- WHEN it is canonicalized
- THEN it serializes as an ordinary repeated value, while an ancestor repeating itself is refused

#### Scenario: Lossy input rejected
- GIVEN a value carrying a non-finite number, `undefined`, a function, a symbol, a bigint, a cycle, a lone surrogate, a non-plain prototype, or a Proxy
- WHEN it is canonicalized
- THEN serialization fails closed and no digest is produced

### Requirement: Redacted Public Receipt Content

A public receipt binds versions, aliases, base, ordered patches, tree, path and image digests, deployment, secrets, backup and heartbeat, evidence, state, and timestamps. It MUST NOT carry a secret value, host, role name, project identifier, or raw provider response; those belong only to private off-Git evidence. This applies to member NAMES as much as to values, and to the key version a redacted reference names, because both reach the public receipt as cleartext. Correlation between the two MUST use `HMAC-SHA256` under a named key version, never a plain hash, because a plain hash of a low-entropy identifier such as a hostname is recoverable by enumeration. A redacted reference MUST therefore name its key version, and MUST NOT reveal, contain, or be reversible to the value it stands for. The key version MUST be encoded unambiguously, so no two distinct key-version and value pairs can produce the same correlation, and the key MUST meet an entropy floor, because non-reversibility rests entirely on the key against an adversary who can enumerate candidate hostnames.

Every member MUST be bound to the form the receipt claims for it. A member the receipt does not constrain is a member it does not bind, and content scanning alone is not a redaction boundary.

#### Scenario: Raw identifier refused (RED-CUT-05)
- GIVEN a receipt carrying a secret value, host, role name, project identifier, or raw provider response, in any member name, member value, or key version
- WHEN the receipt is validated
- THEN it is rejected and names the offending member

#### Scenario: A denial leaks nothing
- GIVEN a receipt rejected for a member whose value is itself sensitive
- WHEN the denial is inspected
- THEN it names the member and never reproduces its value

#### Scenario: Plain hash refused as correlation
- GIVEN a redacted reference produced without a named key version, or carrying a plain digest of its source
- WHEN the receipt is validated
- THEN it is rejected

#### Scenario: Redaction is stable and non-reversible
- GIVEN one identifier redacted twice under the same named key version
- WHEN the two references are compared
- THEN they are equal, they differ under a different key version, and neither contains the source value

### Requirement: Receipt Identity and Generation Binding

A receipt MUST bind its own generation, its canonical digest, and its state. Validation MUST reject a receipt whose generation does not match the expected generation, whose recorded digest does not match the digest of its own canonical bytes, or whose state is not one the lifecycle permits. Identity is the immutable digest; a public alias is pinned and non-authoritative, so an alias that resolves elsewhere MUST NOT override it, in any case or prefix form. Validation MUST reason over a canonical data-only snapshot rather than the caller's live object, because an accessor or a hidden member otherwise lets the validated view and the digested view differ, which forges an identity rather than rejecting a receipt.

#### Scenario: Wrong generation, digest, or state rejected (RED-CUT-07)
- GIVEN a receipt whose generation, self-recorded digest, or state does not match what is expected
- WHEN the receipt is validated
- THEN it is rejected and names which binding failed

#### Scenario: A hidden or shifting member cannot forge identity
- GIVEN a receipt carrying an own non-enumerable member, or a member that answers differently on each read
- WHEN the receipt is validated
- THEN the hidden member is never bound and the shifting member never validates

#### Scenario: Alias never overrides identity
- GIVEN a receipt whose alias disagrees with its digest
- WHEN identity is resolved
- THEN the digest wins and the mismatch is rejected

### Requirement: Fail-Closed Activation Checkpoint

Activation is non-atomic and ordered. A checkpoint records how far it progressed so it can be resumed rather than restarted. Every recorded step MUST be complete: a step observed in a partial provider state MUST fail closed, because inferring success from partial state is what turns a half-applied activation into an undetected one. A checkpoint MUST NOT skip, reorder, or repeat a completed step, and resuming MUST require the freeze and isolation established earlier to still hold. Resuming MUST read only the view validation accepted, and MUST contain any exception rather than letting it escape. Completion MUST report what the steps proved, independently of whether resuming is permitted, so a caller is never told a finished activation is unfinished.

#### Scenario: Partial provider state fails closed (RED-CUT-06)
- GIVEN a checkpoint whose latest step reports partial, unknown, or absent provider state
- WHEN a resume point is requested
- THEN it fails closed and names the incomplete step

#### Scenario: Resume continues rather than restarts
- GIVEN a checkpoint whose steps are complete and in order, with freeze and isolation held
- WHEN a resume point is requested
- THEN it names the next step, never a completed one

#### Scenario: Completion reported honestly when resuming is refused
- GIVEN a checkpoint whose every step is complete but whose containment has lapsed
- WHEN a resume point is requested
- THEN resuming is refused while completion is still reported as reached

#### Scenario: Out-of-order or repeated progress rejected
- GIVEN a checkpoint whose steps skip, repeat, or reorder the activation sequence, or whose freeze or isolation has lapsed
- WHEN it is validated
- THEN it is rejected

### Requirement: Local-Only Non-Authority

Receipts and checkpoints are tooling and schema only. They MUST perform no network access, no provider mutation, no deployment, promotion, traffic change, or release, and MUST hold no repository, Git, process, or CLI authority. A populated receipt instance MUST NOT enter Git; only tooling, schema, and template do. Every result MUST report authority as denied.

#### Scenario: Authority denied
- GIVEN any receipt or checkpoint outcome, accepted or rejected
- WHEN the result is inspected
- THEN authority is denied and no external state has changed
