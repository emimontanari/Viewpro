# Apply Progress: Remediate DeepmergeTS High Advisory

## Authority and Boundary

- **Published pre-apply authority**: `P=2ce6a6923ad4860177dfeab2fee545068d944283`, reviewed on PR #328 before apply.
- **Public approval**: [issue #325](https://github.com/emimontanari/Viewpro/issues/325#issuecomment-5331737441) and [PR #328](https://github.com/emimontanari/Viewpro/pull/328#issuecomment-5331737710).
- **Post-review local amendments, not published authority**: `87ec37f6bebe83eccc7ebc6bb33be2ff59f1961d` and `004f9a1d15b9b819ad7fb06c0ef5c8ffcb7ad791`; both must be pushed before PR B publication.
- **Delivery base**: `origin/develop@8f1b393297c68b86a6d56c7e71d932e753350017`.
- **Exact boundary**: `viewpro-app/package.json`, `viewpro-app/pnpm-lock.yaml`, and this file. Current delivery diff: 45 additions + 5 deletions = 50 changed lines.

## Completed Authoring Tasks

- [x] 1.1 Public approval recorded.
- [x] 1.2 Published/reviewed pre-apply authority P recorded.
- [x] 1.3 Public approvals verified; clean local candidate created from D.
- [x] 2.1 Baseline audit/ancestry and boundary recorded.
- [x] 2.2 Scoped override, controlled resolution, archives, and frozen install completed.
- [x] 2.3 Immutable Docker lifecycle, migrations, direct tests, rollback, and cleanup completed.
- [x] 2.4 Repository/external-evidence contract satisfied; native CI remains post-publication.

## Strict-TDD and Source-Run Evidence

| Task | RED | GREEN |
|---|---|---|
| 2.1–2.2 | Clean D high audit exited 1 with GHSA; both Prisma paths used 7.1.5 | 8.0.1 scoped graph and high audit exit 0 |
| 2.3 | Docker-unavailable run failed closed | Immutable localhost lifecycle passed: product 112 files / 1,149 tests; platform 65 files / 584 tests |

- **Runtime digests**: failed `sha256:4b5ff695167c1b93099c35a957bbdc38cefaa843011bf59ae4f3d351e84a395a`; local pass `sha256:87571abd1db76c74a1d9b73d941d5f203d0b6409b14212cb2f5eac22bcefa67f`; predecessor candidate diff `sha256:16be20fa58edd5f5218a2452076c1fbecccdf299ca499aa99fcd1f415c26f89a`.
- **Predecessor delivery commit**: `0097b2be476de05337e557eaf5b66338e36a1770`; its final identity is external evidence, not a claim about this successor commit.
- **Immutable image**: `postgres:16-alpine@sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229` from official `postgres@sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229` metadata.
- **Dependency/rollback facts**: corrected blobs `cbee3dd80f2ce17a6d29d585a2648765c24ed3f4` / `84e4e275b1ea6143707d9d423596904e525bd840`; patch `5c0d081cc30987dd6f066574ac4eaa568053d2e092d1e2bf3c18249c7268a46d`; rollback restored 7.1.5 and audit exit 1, then recovered 8.0.1 and audit exit 0.
- **Generated archives**: product `26386ffcb73f6dbf48d727d46ea961e0e34749578bef579467c19b581153b941`; platform `295da64a0f933b3a6861387cf18aa540f2796cdc22b7408506694c654bc67b70`.
- **Checks**: 28 product + 11 platform migrations; frozen install, Prisma, typecheck/lint/build, ancestry, diff, and gitleaks passed; residual audit is 2 low / 3 moderate; `.only` scan over `viewpro-app/apps` and `viewpro-app/packages` found none.
- **Cleanup**: owned CID files/directories, containers, uploads, databases, and process-only credentials were removed; ports 55432/55434 were free.

## Final-Candidate Binding

The successor commit's exact head/tree/diff, direct-test results, and native CI are immutable external runtime/PR/CI evidence. This file intentionally does not contain its own commit identity; any commit after those checks invalidates them. Native GitHub CI is pending publication.
