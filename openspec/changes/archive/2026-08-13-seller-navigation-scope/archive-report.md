# Archive Report: Seller Navigation Scope (#284)

## Result

The OpenSpec change `seller-navigation-scope` passed the archive gates and was moved from the active changes directory to the dated archive. No product, test, runtime, native-authority, or GitHub files were changed.

## Source and targets

| Item | Source | Target |
|---|---|---|
| Change folder | `openspec/changes/seller-navigation-scope/` | `openspec/changes/archive/2026-08-13-seller-navigation-scope/` |
| Canonical spec | `openspec/changes/seller-navigation-scope/specs/seller-navigation-scope/spec.md` | `openspec/specs/seller-navigation-scope/spec.md` |

The canonical spec did not exist before archiving. The full delta spec was copied exactly; no merge or overwrite was required.

## Completion and verification

- Tasks: **13/13 complete**; no unchecked implementation tasks.
- Verification verdict: **PASS WITH WARNINGS**.
- Verification requirements/scenarios: **3/3 requirements, 8/8 scenarios**.
- Verification blockers: **0**.
- Critical findings: **0**.
- The warnings are non-blocking and documented in `verify-report.md`.

## Native review authority

The archive is bound to the approved fresh review authority:

- Lineage: `review-f72ff139f27cb4b9`
- Authority revision: `sha256:8e987e629b45af737b8c9b76ff7766e67a1773f6756653315be7723b9be0ce54`
- Receipt: `sha256:c8b722b8db8e5346da8e6a48e627aceba58b5d2e124b5001af85f89ce3561614`
- Evidence: `sha256:9e24ca3b1ef84e015f6b59bb53401c4f447db7a85ece042daf65d0efed2151f3`
- Binding: `sha256:fbe57b8f173cafc749f6b9e0d64eb0c5fb2ffd95cffc79cd256dbf012005e6ce`
- Native status: empty blockers; `nextRecommended: archive`.

## Exact archived files

- `proposal.md`
- `specs/seller-navigation-scope/spec.md`
- `design.md`
- `tasks.md`
- `verify-report.md`
- `archive-report.md`

## Archive checks

- Canonical spec exists and matches the source spec exactly: **PASS**.
- Active change path is absent: **PASS**.
- Archive contains all required artifacts: **PASS**.
- Archived tasks remain 13/13 complete: **PASS**.
- `git diff --check`: **PASS**.
- No staging, commit, push, pull request, or GitHub mutation performed.
