# Apply Progress: Remediate DeepmergeTS High Advisory

## Authority and Delivery Boundary

- **Planning authority (local, unpushed)**: `87ec37f6bebe83eccc7ebc6bb33be2ff59f1961d` on `docs/deepmerge-ts-audit-plan`; planning diff is 358 additions against `origin/develop`.
- **Public approval**: [issue #325](https://github.com/emimontanari/Viewpro/issues/325#issuecomment-5331737441) and [PR #328](https://github.com/emimontanari/Viewpro/pull/328#issuecomment-5331737710).
- **Delivery base**: `origin/develop@8f1b393297c68b86a6d56c7e71d932e753350017`.
- **PR B boundary**: exactly `viewpro-app/package.json`, `viewpro-app/pnpm-lock.yaml`, and this file. Final verify report and native CI are post-publication.

## Completed Authoring Tasks

- [x] 1.1–1.2 Public approval and local planning authority recorded.
- [x] 2.1 Baseline audit/ancestry and delivery boundary recorded.
- [x] 2.2 Scoped override, controlled resolution, state archive, and frozen install completed.
- [x] 2.3 Local Docker lifecycle, migrations, direct tests, rollback, and cleanup completed.

## Strict-TDD Evidence

| Task | RED | GREEN | Recheck |
|---|---|---|---|
| 2.1–2.2 | Clean D: high audit exited 1 with `GHSA-ggr8-5vv4-36mx`; both Prisma paths used 7.1.5 | Scoped 8.0.1 graph and high audit exit 0 | `pnpm why` and `pnpm list` verified both APIs; rollback restored 7.1.5 and audit exit 1 |
| 2.3 | Docker-unavailable run failed closed without resources | Immutable localhost lifecycle, both migration sets, and exact direct tests passed | Product: 112 files / 1,149 tests; platform: 65 files / 584 tests |

## Source-Run Evidence (Not Final-Commit-Bound)

- **Prior runtime evidence digest**: `sha256:87571abd1db76c74a1d9b73d941d5f203d0b6409b14212cb2f5eac22bcefa67f`.
- **Immutable image**: `postgres:16-alpine@sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229` from official local Docker metadata (`postgres@sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229`, Linux/arm64).
- **Dependency blobs**: `package.json` `cbee3dd80f2ce17a6d29d585a2648765c24ed3f4`; `pnpm-lock.yaml` `84e4e275b1ea6143707d9d423596904e525bd840`; corrected dependency patch SHA-256 `5c0d081cc30987dd6f066574ac4eaa568053d2e092d1e2bf3c18249c7268a46d`.
- **Generated-output archives**: product client `api-client.tar` SHA-256 `26386ffcb73f6dbf48d727d46ea961e0e34749578bef579467c19b581153b941`; platform client `platform-generated.tar` SHA-256 `295da64a0f933b3a6861387cf18aa540f2796cdc22b7408506694c654bc67b70`.
- **Rollback/recovery**: restored exact D blobs; rehydrated 7.1.5 under both Prisma paths and reproduced high-audit exit 1; reapplied the preserved patch, restored corrected hashes, then re-proved frozen install, Prisma validate/generate, typecheck/lint/build, 8.0.1 ancestry, high audit exit 0, residual audit, diff, generated output, and secret checks.
- **Local checks**: 28 product and 11 platform migrations; direct Vitest commands used `--allowOnly=false --retry=0`; high audit exits 0; residual audit remains 2 low / 3 moderate; lint scripts are existing no-op stubs.
- **Cleanup**: owned CID files/directories, containers, uploads, ephemeral databases, and process-only credentials were removed; exact-name container queries were empty and ports 55432/55434 were free.

## Final Delivery Candidate Requirements

- Transfer only the three boundary files to a clean branch from D, create one local delivery commit, then retain its commit/tree/diff identities externally.
- After that commit, rerun all final gates without any file changes: frozen install, ancestry, Prisma, API/platform checks, high/residual audit, secret/diff/generated checks, immutable Docker lifecycle/migrations, direct tests, and a `.only` scan over both `viewpro-app/apps` and `viewpro-app/packages`.
- This file does not claim a self-referential final commit SHA. Native GitHub CI remains pending until the clean candidate is published.
