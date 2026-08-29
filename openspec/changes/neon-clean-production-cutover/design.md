# Design: Neon Clean Production Cutover

## Technical Approach

Keep one external WU3 with dependency order Lineage → Tree/Byte → Release → Qualification. Contract modules are deterministic, isolated, no-network, and fail closed; Qualification alone may inspect a repository or run Git/processes. Use Node 22 built-ins and `node:test` without package or lockfile changes.

## Authority Model

| Concern | Sole authority |
|---|---|
| Intent, requirements, and architecture | Proposal, specification, and design |
| Planned work and completion | `tasks.md` |
| Semantic execution history | Native evidence and `apply-progress.md` |
| Delivery evidence and merge authority | Exact commit, authored PR diff, automated checks, and human review |

Planning grants no implementation, provider, deployment, traffic, promotion, or merge authority. Progress records history rather than requirements, and semantic evidence does not define authored PR scope.

## Contract Architecture

Lineage owns ordered WU1–WU7 identity and closure data. Tree/Byte owns only `final-tree.v1.json`, `tree-byte-contract.mjs`, and `tree-byte-contract.spec.mjs`; it validates exact-prototype non-Proxy `Uint8Array` input, fatal round-trippable UTF-8, closed duplicate-free JSON, canonical paths and hashes, trusted intrinsic dispatch, determinism, and explicit non-authority. Release owns its contract, schema, and unpopulated template. Qualification owns repository/process audit, but never provider or promotion authority.

Pure contracts accept only plain records with `Object.prototype` or `null` prototypes, require own fields, enumerate own keys, and reject custom prototypes and authority keys. Hostile concurrent same-user mutation remains outside the trusted isolated-operator and disposable-worktree boundary.

## Rollback

Rollback follows reverse dependency order: Qualification → Release → Tree/Byte → Lineage. Any rollback invalidates final closure and re-blocks WU4. Before business writes, restore the old generation; afterward, URL rollback requires reconciliation/export authority, otherwise roll forward. Retained resources are never deleted.

## Open Questions

None.
