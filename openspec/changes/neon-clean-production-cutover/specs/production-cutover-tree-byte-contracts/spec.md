# Production Cutover Tree Byte Contracts Specification

## Purpose

Define one exact policy-only JSON byte document and its observable boundaries.

## Requirements

### Requirement: Exact Policy Document Shape

The policy document MUST have exactly these four own members: `schemaVersion` (JSON number exactly `1`), `kind` (string exactly `production-cutover-tree-byte-contract`), `default` (object), and `exceptions` (array exactly length `3`). `default` MUST have exactly the two string members `mode: "100644"` and `type: "blob"`. Each exception MUST have exactly the four string members `path`, `mode`, `type`, and `hash`; `type` MUST be `blob`. Exceptions MUST appear in this order: `.githooks/pre-push`, `100755`, `blob`, `d8016a819c234d99c5e8b627e34e1349695b3a44`; `viewpro-app/apps/app-new/.claude/skills/tanstack-form`, `120000`, `blob`, `d12d02091264079b6e212b88678e90f9651ec6e7`; `viewpro-app/apps/app-new/.claude/skills/tanstack-query`, `120000`, `blob`, `a1aae1817a41407e92a0c2038623bdf7c146c4fd`. `kind` is document identity; `type` is Git object type.

#### Scenario: Canonical policy accepted
- GIVEN the exact four-member document with the exact default and ordered exceptions
- WHEN the policy is interpreted
- THEN it is accepted

#### Scenario: Policy drift rejected
- GIVEN any changed policy value, exception order, array length, or member set
- WHEN the policy is interpreted
- THEN it is rejected

### Requirement: Closed JSON Policy

Duplicate members MUST be rejected before semantic interpretation. Every object MUST contain only its declared own members with their declared types and values. Unknown members, `entries`, `tree`, request/audit/repository/Git/process/provider/deployment/traffic members, and authority keys `__proto__`, `constructor`, and `prototype` MUST receive the same closed rejection. There is no second operational request API.

#### Scenario: Closed schema rejected
- GIVEN a duplicate, unknown, authority, wrong-type, or extra operational member
- WHEN the JSON document is interpreted
- THEN it is rejected before semantic use

### Requirement: Observable Policy Byte Envelope

The sole input MUST be an exact-prototype, non-Proxy `Uint8Array`, never SharedArrayBuffer-backed. Validation MUST use the invocation-entry byte value without coercing caller objects. Fatal UTF-8 MUST reject malformed bytes, a byte BOM, U+FEFF, NUL, and unpaired surrogates; accepted decoded text MUST round-trip exactly to the observed bytes. Post-initialization caller-accessible prototype poisoning MUST NOT alter valid or invalid results; pre-initialization poisoning and hostile concurrent mutation are out of scope.

#### Scenario: Valid policy bytes
- GIVEN exact-policy JSON encoded as valid fatal UTF-8 bytes
- WHEN the invocation-entry bytes are validated
- THEN the policy is accepted and text round-trips exactly

#### Scenario: Invalid bytes rejected
- GIVEN a non-exact, Proxy, SharedArrayBuffer-backed, malformed, BOM, U+FEFF, NUL, or unpaired-surrogate input
- WHEN the invocation-entry bytes are validated
- THEN the input is rejected without coercion

### Requirement: Canonical Paths and Hashes

Policy and transient Qualification entry records MUST use non-empty NFC repository-relative `/` paths with non-empty segments; `.`, `..`, absolute, trailing, backslash, U+0025 `%`, C0, C1, DEL, U+FEFF, NUL, and surrogate forms MUST be rejected. Hashes MUST be lowercase 40-hex strings.

#### Scenario: Path or hash grammar rejected
- GIVEN a policy path or transient exact `{path, mode, type, hash}` record with a forbidden path form or non-lowercase 40-hex hash
- WHEN the grammar is validated
- THEN it is rejected

### Requirement: Stable Isolated Policy and Qualification Boundary

Policy constants and validation results MUST be stable and deterministic for identical invocation-entry bytes; no global freezing or populated candidate embedding is required. Candidate entries are not part of this document. Qualification MAY transiently observe exact `{path, mode, type, hash}` entry records, apply this policy, and reject nonconforming records. Tree/Byte MUST NOT accept candidate-entry bytes or audit a repository. It MUST be isolated, no-network, and MUST NOT grant authority over repository/Git/process/CLI/CI/runtime, provider/deployment/traffic, secrets, populated-manifest/final identity, Lineage, Release/schema, Qualification, or WU4.

#### Scenario: Deterministic non-authority
- GIVEN identical policy bytes and no external state
- WHEN validation is repeated or an excluded authority is requested
- THEN results are identical, no network occurs, and no authority is granted
