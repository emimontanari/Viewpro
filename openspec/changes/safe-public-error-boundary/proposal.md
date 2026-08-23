# Proposal: Safe Public Error Boundary

## Intent

Close #356's error boundary under #285. Production exposes generic `Request failed` for 401/403/409/410 invitation failures; no expired/accepted distinction exists to preserve.

## Scope

### In Scope
- Ordered append-only runtime catalog: exactly the 13 established codes plus `REQUEST_FAILED`.
- Tolerant direct App New `api-client.ts`: parsing never throws; transport status remains authoritative; only catalog-valid code and canonical request ID survive; details/prose are dropped; fallback is generic.
- One default-off switch controlling a global envelope with exact keys `statusCode`, `errorCode`, `requestId`; unknown/missing codes become `REQUEST_FAILED`.
- Fresh server-owned UUID v4 replacing every incoming ID across configured header, enabled error body, internal context, and bounded telemetry; telemetry failure cannot alter responses.
- Candidate-bound unset/false/true enablement evidence and switch-off-first rollback.

### Out of Scope
- New auth/invitation/actionable codes, producer annotations, or invitation UI/copy/recovery changes.
- Ten feature-local parser migrations and 57 BFF forwarders.
- Credential/session semantics and full Sentry/logging redesign.
- #340/WU3a, CI, root package metadata, and cutover surfaces.

## Capabilities

### New Capabilities
- `safe-public-error-boundary`: Closed shaping, safe direct consumption, server-owned correlation, and reversible enablement.

### Modified Capabilities
- None.

## Approach and Delivery

Global shaping closes disclosure across all routes; only the direct client adopts actionability now.

| Unit | Delivery | Budget |
|---|---|---:|
| WU/PR1 | Catalog + direct safe consumer | 220–310 lines |
| WU/PR2 | Producer boundary + correlation | 280–370 lines |
| Operations | Enablement evidence | 0 repository lines |

## Affected Areas

| Area | Impact |
|---|---|
| `packages/contracts` | Catalog, guard, envelope, proof |
| `apps/app-new/src/lib/api-client.ts` | Safe tolerant direct consumer |
| `apps/api/src/common`, `bootstrap`, `config`, `test` | Boundary, correlation, switch, proof |

## Risks

- Catalog omission downgrades outcomes; require ordered set/uniqueness proof.
- Premature enablement risks mixed behavior; bind evidence to one SHA/deployment.
- Off mode keeps server-owned IDs; rollback controls envelope shape, not unsafe ID trust.
- Deferred parser duplication adds no leak after global shaping.

## Rollback Plan

Switch off first and verify false-state smoke. Revert PR2, then PR1 only when no enabled producer depends on its exports.

## Dependencies

- Approved #285, amended #356, and completed predecessor #346 / PR #355.
- PR2 depends on PR1. No dependency on #340/WU3a surfaces.

## Success Criteria

- [ ] Runtime proof preserves the ordered 13-code set and appends `REQUEST_FAILED`.
- [ ] Direct client retains only valid code/request ID; other bodies get generic fallback.
- [ ] Enabled 4xx/5xx responses have exactly three keys; all routes deny unknown fields/codes.
- [ ] Fresh IDs replace incoming IDs and match across header, body, context, and telemetry; capture failure is contained.
- [ ] Candidate-bound unset/false/true evidence and switch-off rollback pass.
