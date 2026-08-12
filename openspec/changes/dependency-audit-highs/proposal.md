# Proposal: Remediate High-Severity Dependency Audit Findings

## Intent

Restore the mandatory production dependency-audit gate for approved issue #310 with the smallest compatible dependency-only change. Although both advisories have low direct runtime exploit relevance in this repository's observed build-tool paths, that assessment does not waive the blocking security gate.

## Scope
### In Scope
- Deliver one unified PR from `origin/develop` that contains the five planning artifacts and the two dependency files, linked with `Closes #310`.
- Remove the unsafe cross-major `fast-uri` override so Ajv's existing `^3.0.1` range resolves patched `fast-uri@3.1.5`.
- Refresh `nanoid` to `3.3.18` within PostCSS 8.5.23's existing `^3.3.16` range.
- Produce fresh frozen-install, resolution, zero-high-audit, build, typecheck, lint, and exact CI-serial test evidence in a NEW final verify report; #6786 remains historical FAIL.

### Out of Scope
- Parent, framework, Ajv, PostCSS, Sentry, or webpack upgrades.
- Deduplication, unrelated lockfile churn, product behavior, source code, CI workflow, or configuration changes.

## Capabilities

### New Capabilities
None. This change introduces no product capability.

### Modified Capabilities
None. This change alters dependency resolution only, not specified behavior.

## Approach

On one `fix/dependency-audit-highs` branch from `origin/develop`, retain these five planning artifacts and apply the atomic two-file dependency sub-boundary. The eventual PR must use `Closes #310`; a separate planning-only PR is superseded because it would close #310 prematurely. Accept only a dependency diff where `fast-uri@3.1.5` and `nanoid@3.3.18` replace the vulnerable resolutions and all parent/importer versions remain unchanged. Do not run broad update or dedupe operations.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `viewpro-app/package.json` | Modified | Remove the unsafe `fast-uri` override. |
| `viewpro-app/pnpm-lock.yaml` | Modified | Record only the two patched transitive resolutions and required references. |
| `openspec/changes/dependency-audit-highs/**` | Added | Five planning artifacts included in the unified PR. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Resolver introduces unrelated churn | Medium | Reject importer, parent, dedupe, or non-target package movement. |
| Patched versions break tooling | Low | Run the full repository verification sequence before merge. |
| Low runtime relevance is mistaken for exemption | Low | Keep `pnpm audit --prod --audit-level high` authoritative. |

## Rollback Plan

Revert both dependency files together if compatibility checks fail and keep the merge paused. Rollback restores the vulnerable resolutions and red audit gate; it is not an acceptable merged steady state.

## Dependencies

- Approved issue #310 authorizes this remediation.
- Exception #6840 permits #310 before #311 only after every mandatory CI and dependency-specific gate passes; #311 owns the stronger concurrent uncached zero-retry acceptance, then proceeds PR0→PR1→PR2 before #309/#308→#284.

## Success Criteria

- [ ] The unified PR contains exactly five planning artifact files plus `viewpro-app/package.json` and `viewpro-app/pnpm-lock.yaml`, within the 400-line budget; only those two non-planning files change.
- [ ] Resolution evidence shows `fast-uri@3.1.5` and `nanoid@3.3.18`, with no parent upgrades or unrelated churn.
- [ ] Frozen install and `pnpm audit --prod --audit-level high` succeed.
- [ ] Build, typecheck, lint, and the CI test topology (both migrations plus `pnpm exec turbo run test --concurrency=1`) pass without retries; a NEW final verify report preserves #6786 as FAIL and assigns the stronger concurrent uncached zero-retry harness to #311.
