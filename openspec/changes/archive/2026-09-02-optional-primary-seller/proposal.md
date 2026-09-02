# Proposal: Optional Primary Seller

## Decision

Extend the existing multi-seller property-assignment flow with one optional, explicitly managed primary seller per property engagement. The primary seller must be one of the property's currently assigned, active same-tenant `AGENT` members. Nothing is selected automatically.

Owner movement WhatsApp contact will stop using the oldest assignment. It will resolve only to the currently valid primary seller when that seller has a usable phone; otherwise the contact remains unavailable.

## Origin and Baseline

- Product request: issue #304.
- Change: `optional-primary-seller`.
- Grounding baseline: `origin/develop` at `d6e5ffea8c9141b503d6f8952c041373b3d88f79`.
- Existing assignment behavior remains the foundation; this proposal does not introduce a replacement assignment system.

## Intent

Give property managers a deliberate way to identify the single seller responsible for owner-facing movement contact without changing the collaborative access model for all assigned sellers. The outcome should be predictable for managers, safe under concurrent updates, and explainable to owners: contact is available only when a valid primary seller with a usable phone has been intentionally selected.

## Verified Current-State Gap

The current system supports multiple seller assignments but has no primary designation:

- `apps/api/src/property-engagements/` assigns and removes sellers and scopes property visibility through any matching assignment.
- `property-agents-section.tsx` and `manage-property-agents-dialog.tsx` let authorized users manage the assignment set, but expose no primary-seller state or action.
- `prisma-owner-portal.repository.ts` orders assigned sellers by oldest `assignedAt`, then `agentUserId`.
- `owner-whatsapp-contact.ts` consumes the first ordered assignment and makes movement contact available when that seller has a usable phone.

Consequently, an incidental assignment timestamp determines the owner-facing contact. Managers cannot explicitly set, change, or clear that responsibility, and removing or deactivating the selected-by-order seller can silently shift contact to another assignment.

## Product Rules

1. A property may have zero or one primary seller.
2. A primary seller is eligible only when all of the following are true at selection time:
   - the user is active;
   - the user's same-tenant membership is active;
   - the membership role is exactly `AGENT`; and
   - the seller is currently assigned to the property.
3. Setting, changing, and clearing the primary seller are explicit actions. Assignment creation, existing data, and reads never auto-select, backfill, infer, or silently replace a primary.
4. Concurrent writes must preserve the zero-or-one invariant at the durable-data boundary.
5. Removing the assignment designated as primary leaves the property with no primary.
6. Deactivation of the primary user or membership makes the designation invalid for consumption. It does not select another seller.
7. Existing authorization and visibility based on any assigned seller remain unchanged. Primary status grants no additional access and removes no existing access.
8. Owner movement WhatsApp contact may use only a currently valid primary seller with a usable phone. With no valid primary or no usable phone, contact is unavailable; the oldest-assignment behavior is superseded and must not act as fallback.

## Scope

### Assignment API and Persistence

- Represent an optional primary designation against the existing property-seller assignment model.
- Expose primary state through the existing property-assignment API response path.
- Add explicit set/change and clear operations under the existing assignment-management authorization boundary.
- Validate property, tenant, assignment, user status, membership status, and exact `AGENT` role before accepting a set/change operation.
- Enforce at most one primary for a property under concurrent requests, not only through application-side checks.
- Couple assignment removal with primary clearing so no removed assignment remains designated.
- Return stable conflict/validation outcomes for stale, ineligible, cross-tenant, or unassigned selections without mutating the assignment set.

### BFF and Property Management UI

- Extend the existing BFF/service/query types and mutations rather than creating a parallel management flow.
- Show which currently assigned seller is primary in the existing property seller section/dialog.
- Let users who can already manage assignments explicitly set, change, or clear the primary.
- Represent the no-primary state clearly and keep it valid; do not prompt or force a selection.
- Refresh assignment and primary state after mutations and surface actionable failures without optimistic states that can misrepresent the durable winner.

### Owner Movement WhatsApp Contact

- Replace oldest-assignment resolution with valid-primary-only resolution.
- Revalidate the designated seller for active user, active same-tenant membership, `AGENT` role, current assignment, and usable phone when producing owner contact.
- Preserve the existing unavailable-contact response and owner UI behavior when no valid contact exists.
- Preserve existing WhatsApp URL/message semantics and click-tracking semantics except for the seller-resolution source.

### Lifecycle and Verification

- Cover explicit set, change, clear, primary-assignment removal, inactive user, inactive membership, role mismatch, cross-tenant attempts, stale assignment, unusable phone, no-primary state, and concurrent writes.
- Preserve multi-seller assignment, authorization, visibility, owner access, and unrelated contact behavior.

## Explicit Non-Goals

- No redesign or replacement of the assignment picker, assignment API, membership management, or seller-management workflow.
- No automatic primary selection for first assignment, sole assignment, oldest assignment, seeded data, or existing production records.
- No backfill, fallback, inferred winner, or silent replacement after removal, deactivation, role change, or phone loss.
- No primary-only authorization, visibility, ownership, notification routing, or workflow permissions.
- No seller phone-management UI or changes to phone validation/canonicalization.
- No proposal or approval workflow for changing the primary.
- No operational homepage work.
- No changes to property-level agency WhatsApp contact behavior, WhatsApp message templates, analytics event shape, or click tracking beyond resolving the movement contact from the valid primary.

## Likely Capability Deltas

| Delta | Type | Expected contract |
|---|---|---|
| `property-primary-seller` | New capability | Optional explicit primary designation, eligibility, lifecycle behavior, concurrency invariant, assignment-management API/BFF/UI, and unchanged any-assignment access. |
| `owner-portal` | Modified capability | Owner movement WhatsApp contact resolves only from a currently valid primary seller with a usable phone and is unavailable otherwise. |

The spec phase should confirm these final delta names without broadening scope. No spec delta is created during this initialization step.

## Affected Areas

| Area | Expected impact |
|---|---|
| Prisma schema and migration | Durable optional designation and database-enforced zero-or-one invariant. |
| `apps/api/src/property-engagements/` | Primary state, explicit mutations, eligibility checks, assignment-removal lifecycle, and authorization reuse. |
| API contracts and tenant-isolation safeguards | Primary fields/results remain tenant-scoped and cannot reference another tenant's user, membership, property, or assignment. |
| `apps/app-new` BFF and products API layer | Proxy contracts, types, service methods, query invalidation, and safe mutation errors. |
| Property seller management UI | Primary indicator plus explicit set/change/clear actions in the existing management surface. |
| `apps/api/src/owner-portal/prisma-owner-portal.repository.ts` | Replace oldest-assignment read shape with valid-primary contact data. |
| `apps/api/src/owner-portal/owner-whatsapp-contact.ts` | Valid-primary-only mapping and unavailable behavior. |
| Tests and deterministic fixtures | Eligibility, lifecycle, concurrency, tenant isolation, UI states, and owner contact regression proof. |

## Security and Data Invariants

- Primary selection cannot cross tenant boundaries or point outside the property's current assignment set.
- The same authorization used to manage seller assignments governs primary set/change/clear operations; primary status introduces no new role or permission.
- Database state must make two simultaneous primary winners impossible.
- Read-time consumption must fail closed when status, membership, role, assignment, or phone validity no longer qualifies.
- Invalid consumption does not require silently rewriting historical designation state; it only prevents the designation from being used and never promotes another seller.
- Existing visibility predicates based on `agents.some(...)` or equivalent any-assignment membership remain authoritative and unchanged.

## Risks and Tradeoffs

| Risk or tradeoff | Impact | Required control |
|---|---|---|
| Concurrency is guarded only in service code | Two primary sellers can survive simultaneous writes. | Enforce uniqueness/invariant in durable storage and test competing writes. |
| Eligibility is checked only when selecting | A deactivated or role-changed seller can remain exposed to owners. | Revalidate all eligibility and phone conditions at consumption time. |
| Removal or invalidation promotes another seller | Responsibility changes without manager intent. | Clear on primary-assignment removal and return unavailable for every other invalidation; never fall back. |
| Primary is confused with access ownership | Existing sellers may unexpectedly lose visibility or permissions. | Keep authorization and visibility based on any assignment and test non-primary access. |
| UI displays stale primary state after races | Managers may believe the losing update succeeded. | Render server-confirmed state after mutation and expose stable conflict handling. |
| Migration or rollback reintroduces oldest-assignment contact | Owner contact becomes implicit again. | Keep rollback fail-closed for movement contact unless an explicit product decision accepts the old behavior. |
| Read joins for status, membership, role, assignment, and phone grow costly | Owner timeline latency can regress. | Design a scoped query that proves validity without per-movement N+1 reads. |

## Rollout and Rollback

Roll out schema support before enabling primary management and primary-only owner contact consumption. Existing records begin with no primary and remain valid; there is no backfill. Enable the API/BFF/UI and owner resolver only after the concurrency invariant, tenant isolation, lifecycle rules, and unavailable states are verified.

For rollback, first disable or remove primary-management UI and write endpoints while retaining the nullable designation data. Revert read integration to a fail-closed unavailable movement contact rather than silently restoring the oldest-assignment fallback. Preserve stored designations during an application rollback so a later redeploy can recover them. Any schema removal is a separately reviewed, data-safe migration after confirming retained designations are no longer needed.

## Success Criteria

- [ ] Authorized assignment managers can explicitly set, change, and clear one primary seller through the existing property seller-management flow.
- [ ] A property can remain with no primary before any selection and after an explicit clear.
- [ ] Only a currently assigned seller whose user is active and whose active same-tenant membership role is exactly `AGENT` can be selected.
- [ ] Cross-tenant, inactive, non-`AGENT`, unassigned, removed, or stale candidates are rejected without changing assignments or the current valid primary.
- [ ] Concurrent set/change requests leave at most one durable primary seller for the property, with a server-confirmed winner.
- [ ] Removing the primary assignment leaves no primary and never promotes another assigned seller.
- [ ] User or membership deactivation, role change, or loss of usable phone makes owner movement contact unavailable and never chooses a replacement.
- [ ] Owner movement WhatsApp contact uses only a currently valid primary seller with a usable phone; oldest-assignment selection no longer affects contact.
- [ ] Existing any-assignment authorization and visibility behave identically for primary and non-primary assigned sellers.
- [ ] Existing multi-seller assignment, property-level agency contact, WhatsApp formatting, and click tracking remain unchanged outside the stated resolution source.
- [ ] Existing records require no backfill and safely expose the no-primary state after deployment.

## Proposal Question Round

The proposal-shaping questions are recorded here because this delegated auto-mode step must initialize and stop rather than pause for interaction. Issue #304's approved product contract resolves them as follows:

1. **Should the system infer a primary when only one seller is assigned?** No; every set/change is manual and no existing or future assignment is auto-promoted.
2. **Who can manage the primary?** The existing assignment-management authorization boundary is reused; primary status creates no new access policy.
3. **What happens when the primary becomes invalid?** Consumption fails closed and no replacement is selected; removing the primary assignment leaves none.
4. **What determines owner movement contact?** Only a currently valid primary with a usable phone; the oldest-assignment rule and every fallback are superseded.
5. **How strong is the one-primary rule?** It is a durable invariant that must hold under concurrent writes, not a UI convention.

These are fixed proposal assumptions from the approved contract. A later correction should amend the proposal explicitly rather than allowing spec or design to infer a different rule.

## Proposal Status

Initialized and ready for review as the first artifact for `optional-primary-seller`. Per the `sdd-new` boundary, no spec, design, tasks, implementation, commit, branch, or GitHub mutation is included.
