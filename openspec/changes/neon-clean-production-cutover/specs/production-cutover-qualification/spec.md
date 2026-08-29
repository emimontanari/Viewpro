# Production Cutover Qualification Specification

## Purpose

Define the local, non-authoritative audit that qualifies one frozen candidate directly from closed repository checks.

## Requirements

### Requirement: Closed Git Operation Selection

Qualification MUST select every Git invocation from a closed operation table keyed by an own string. The selector MUST reject any operation whose `typeof` is not `string` before any property lookup, regular-expression match, or other coercing use, so arrays, `Symbol` values, null-prototype objects, and objects carrying `toString` or `Symbol.toPrimitive` never reach selection. Unknown strings MUST be rejected identically. Only the parameterised form `tracked:<path>` is dynamic, and its `<path>` MUST already be an own member of the pinned blob table. Membership MUST be tested with an own-property check, never a prototype-chain lookup. Production code MUST expose no caller-selected executable, argument vector, environment, shell, or generic command runner; callers MAY supply only the numeric bounds `timeout`, `killAfter`, and `maxOutput`.

#### Scenario: Hostile operation value rejected without spawning
- GIVEN an array alias, a `Symbol`, a null-prototype object, a coercible object, or an unknown string
- WHEN a Git operation is selected
- THEN selection fails closed, no process is spawned, and the failure reports `invalid-operation`

#### Scenario: Closed table honoured
- GIVEN an own string naming a table entry or a pinned `tracked:` path
- WHEN a Git operation is selected
- THEN exactly the table's fixed argument vector is used

### Requirement: Hardened Git Invocation Environment

Every invocation MUST use an explicit absolute Git executable with `shell` disabled and a frozen minimal environment. Inherited `PATH`, system and global configuration, hooks, filters, attributes, textconv, external diff, object alternates, and replacement refs MUST all be disabled, so repository-local or ambient hostile configuration cannot change observed output.

Qualification MUST NOT ask Git to hash worktree bytes. `git hash-object` applies attribute-selected clean filters, and an untracked `.gitattributes` combined with a repository-local filter can both execute an arbitrary command and report a pinned identity for tampered bytes. Worktree blob identity MUST therefore be computed in process.

#### Scenario: Hostile repository configuration ignored
- GIVEN hostile ambient environment, global or repository Git configuration, hooks, or attributes
- WHEN a qualification operation runs
- THEN the observed output is unchanged

#### Scenario: Clean-filter tampering detected
- GIVEN a worktree contract file tampered with behind a Git clean filter that spoofs its pinned identity
- WHEN the candidate is qualified
- THEN the tamper is detected and qualification fails closed

### Requirement: Bounded Exception-Safe Process Lifecycle

Each invocation MUST settle exactly once and MUST bound its own runtime and output. Spawn failure, non-zero exit, termination by signal, timeout, and a positive finite output limit MUST each be reported distinctly, and output exceeding the limit MUST be truncated and flagged rather than buffered without bound. A timeout MUST escalate `SIGTERM` to `SIGKILL` across the child's process group. Settlement MUST be terminating: no path may conclude while that group is still alive, including a failed kill reported as an error event. Every invocation MUST be bounded absolutely, not only once the child reports. A group that is signalled but never reports close or exit MUST still settle, reporting residue, because otherwise no timer settles the call at all and the caller hangs. Confirmation MUST likewise be bounded rather than polling indefinitely. Cleanup MUST be exception-safe: an exception raised by any observer MUST still terminate the process group under the same escalation, and MUST leave no live or stopped residue, no pending timer or listener, and no second settlement.

#### Scenario: Observer exception terminates a stopped group
- GIVEN an observer that stops the child's process group and then throws
- WHEN the invocation settles
- THEN the group is terminated, the failure is reported, and no residue remains

#### Scenario: A child that never reports still settles
- GIVEN a process group that is signalled but reports neither close nor exit
- WHEN the escalation window expires
- THEN the invocation settles, reports residue, and leaves no timer behind

#### Scenario: Bounded failure reported distinctly
- GIVEN a spawn failure, non-zero exit, signal, timeout, or over-limit output
- WHEN the invocation settles
- THEN that outcome is reported distinctly and exactly once

#### Scenario: Standard error kept separate
- GIVEN an operation that writes to standard error
- WHEN its result is inspected
- THEN standard output carries only standard output, so exact comparisons stay sound

### Requirement: Complete Candidate Composition Audit

Qualification MUST succeed only from real closed audits, never from a constant, marker, or decorative subprocess. Qualification MUST build any checkout shape it depends on rather than assume the ambient one, because continuous integration may leave `HEAD` attached or detached. It MUST verify the canonical repository root, a detached `HEAD` at the exact expected commit and tree, absence of replacement refs and object alternates, rejecting a candidate whose object store borrows from another, the ordered candidate identities and exclusions, and the exact tracked blob identity of every pinned contract file. Every probe MUST fail closed: a probe that could not run MUST deny qualification rather than be read as an absent condition. It MUST then compose the merged Lineage, Tree/Byte, and Release contracts completely over the candidate, final-tree, remediation, and release schema and template documents, and MUST confirm that release authority remains denied.

#### Scenario: Complete audit qualifies the candidate
- GIVEN a detached candidate whose root, commit, tree, identities, exclusions, and pinned blobs all match, and whose three contracts all validate
- WHEN the candidate is qualified
- THEN qualification succeeds and reports no authority

#### Scenario: Unknown, duplicate, authority, or drift variant rejected
- GIVEN an attached `HEAD`, a wrong commit or tree, a drifted tracked or worktree blob identity, or an unknown, duplicate, or authority-keyed contract member
- WHEN the candidate is qualified
- THEN qualification fails closed and reports a distinct reason naming the affected file, with no authority

#### Scenario: Fake success rejected
- GIVEN a subprocess or contract document that reports success without a real closed check
- WHEN the candidate is qualified
- THEN qualification fails closed

### Requirement: Local-Only Non-Authority

Qualification MUST remain local-only. It MUST perform no network access and MUST NOT mutate the repository, a provider, a deployment, traffic, promotion, a release, or final production state. Every result MUST report authority as denied.

#### Scenario: Authority denied
- GIVEN any qualification outcome, successful or failed
- WHEN the result is inspected
- THEN authority is denied and no external state has changed
