# Current MVP Execution Handoff

**Current answer:** the project is in **100% development mode**. There is no pilot deadline, no demo-to-sell pressure, and no deploy clock. The remaining work focuses on closing the development backlog (8 audit-adopted slices in order below). Deploy, architectural scalability prep, external service integration, and the pilot-ready deck are explicitly deferred until the development phase is fully complete.

**Active phase:** development. **Next active slice:** `26.6a` — InmoView copy and role-language pass.

Phase A (gates) is closed. Phase B (product flows) is mostly closed with movement outcomes, state change request workflow, full seeded E2E, and security/isolation regression all merged. Eight audit-adopted product slices remain; deploy is held until they all land.

## Source precedence

| Priority | Source | Use it for |
|---|---|---|
| 1 | This handoff | Mutable status ledger and next-slice pointer. |
| 2 | `docs/plans/2026-06-14-mvp-execution-plan-revision.md` | Active execution plan and gate definitions. |
| 3 | `docs/plans/2026-06-04-final-mvp-execution-plan.md` | Canonical anchor: gates, non-goals, slice template. Historical, never rewritten. |
| 4 | `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md` | Evidence overlay and origin of the adopted sub-slices. Historical, never rewritten. |
| 5 | `docs/plans/README.md` | Planning index. |
| 6 | Older dated `docs/plans/*` docs | Historical context only unless promoted by sources 1–4 or accepted OpenSpec. |

Unsupported completed/current/next claims are not execution directives. Future product/source changes must go through SDD/OpenSpec before code, seed, migration, test, or runtime-config edits.

## Status ledger

| State | Slice or claim | Evidence | Action |
|---|---|---|---|
| Canonical | 2026-06-04 plan remains the historical anchor. | `docs/plans/2026-06-04-final-mvp-execution-plan.md`. | Do not rewrite. |
| Active plan | 2026-06-14 revision is the active execution order. | `docs/plans/2026-06-14-mvp-execution-plan-revision.md`. | Read for slice priorities and gates. |
| Evidence overlay | Stage 26.0 audit records pilot-readiness gaps. | `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`. | Use as evidence/correction context. |
| Completed | Phase A gates G1/G2/G3 all PASS; 22.8 closed by evidence. | PR #149. | D4 resolved. |
| Completed | MVP plan reorder adopted Stage 26.0 audit sub-slices. | PR #147. | Active plan = 2026-06-14 revision. |
| Completed | Stage 26.1 template/demo route cleanup. | PR #140 + #144 (billing route gated). | G2 PASS. |
| Completed | Stage 26.2 deterministic seed contract. | PR #146 (`c7b646c`). | Seed contract in place. |
| Completed | Stage 26.2.1 visible demo property image fixtures. | PR #148 (`5384f05`). | Demo renders real photos. |
| Completed | Stage 20.13 movement outcomes + custom tenant labels. | PR #152 (PR 1) + #155 (PR 2 recovery). | Sellers label movements operationally without moving official state. |
| Completed | Stage 20.10 state change request workflow. | PR #157 (PR 1 schema+API+tests) + #158 (PR 2 BFF+UI+bandeja+smoke). | Seller proposes, manager approves; API 403 guard preserved. |
| Completed | Owner invitation expiry test stability fix. | PR #159. | Closes the 14-day expiry time bomb introduced by the deterministic seed clock. |
| Completed | Stage 26.3 full seeded E2E. | PR #161. | 22/22 seeded smoke green; full pilot choreography reproducible from one command. |
| Completed | Stage 26.4 security and isolation regression. | PR #163. | 13 API negative tests + 2 seeded UI tests; sanity-inversion proven. |
| Next | Stage 26.6a — InmoView copy and role-language pass. | Revised plan Phase F (re-prioritized to run early). | Rename Agente → Vendedor and Manager → Encargado consistently across UI strings. |

## Active gates

Phase A gates all PASSED on 2026-06-14 and are kept here for traceability.

| Gate | Status | Evidence |
|---|---|---|
| G1 | PASS 2026-06-14 | Seller does not see flagged management controls. API direct call returns `403 Insufficient permissions`. |
| G2 | PASS 2026-06-14 | `dashboard/{chat,kanban,forms,forms/simple,elements/icons,react-query,exclusive}` → `404`. `dashboard/billing` → redirect. |
| G3 | PASS 2026-06-14 | `pnpm demo:seed` clean offline; `test:seeded` 24/24 after 26.3 + 26.4. |

## Open product decisions

| # | Decision | Affects | Status |
|---|---|---|---|
| D1 | Beta ships with seller status mutation, or Cuenta Madre approval gates state changes. | `20.10` priority | **Resolved 2026-06-14** — approval workflow shipped via 20.10. |
| D2 | Manual copy-link acceptable, or transactional email ships now. | `21.7` priority | **Deferred** — no email provider work scheduled while in development mode. |
| D3 | Image limit 5→10 confirmed by product. | `FB-8` small media slice | Pending — default backlog until product confirms. |
| D4 | PR #138 guards hold in browser, or the audit reproductions stand. | `22.8` priority | **Resolved 2026-06-14** — guards hold per gate G1; `22.8` closes as evidence-only. |
| D5 | Document type taxonomy | `20.12` document duplicate guard | Pending — required before 20.12 can enter `sdd-spec`. |

## Phase ordering — development first, deploy at the end

Project is in **development mode**. The eight audit-adopted product slices that remain run in this order. Deploy + scalability prep + pilot deck are explicitly deferred until all eight land.

### Development-phase order

```
1. 26.6a  Copy pass (Vendedor / Encargado / Cuenta Madre)        ← NEXT
2. 20.11  Seguimiento daily workflow corrections (filter fixes)
3. 20.9   Seguimiento document activity proof
4. 23.3   WhatsApp tenant contact configuration (UI editor)
5. 23.5   Owner contact CTA semantics (movement-level)
6. 23.4   WhatsApp contact priority and tracking proof
7. 24.5   Notification routing E2E (mostly evidence after 26.3)
8. 20.12  Document duplicate guard (gated on D5 — taxonomy decision)
```

Reasoning for the order:

- `26.6a` first so the vocabulary is correct for every string the next slices touch.
- Seguimiento group (`20.11` → `20.9`) bundled by feature area.
- WhatsApp group (`23.3` → `23.5` → `23.4`) bundled by feature area; `23.5` runs after `23.3` so the editor exists before movement-level priority is tested.
- `24.5` near the end because much of it is implicitly covered by `26.3`.
- `20.12` last because it is blocked by D5 product decision on document taxonomy.

### Deferred until development complete

These slices stay in the plan but **do not run** until the eight development slices above are merged.

```
26.5    Staging / deploy checklist
26.5a   InmoView domain handoff
        Architectural scalability prep (multi-user, service integration)
        External services wiring (Sentry, S3/R2 verification, email provider, etc.)
26.6    Pilot-ready deck
```

When development is complete, a new handoff revision reopens deploy planning explicitly.

## Next slice contract

```txt
Stage: 26
Slice: 26.6a — InmoView copy and role-language pass
Objective: rename user-facing strings to the real-estate industry terms (Vendedor instead of Agente, Encargado instead of Manager) and keep Cuenta Madre consistent across the UI.
Evidence needed: every user-facing UI string updated in a single coherent pass, with no internal enum/permission rename and no schema change. Audit-row trace in the PR description.
Do not touch: TenantRole enum values, GlobalRole values, database role columns, permission guards, the API 403 guard, the 26.2 deterministic seed contract, or the 26.2.1 image fixtures.
Done: `rg -i "Agente"` and `rg -i "Manager"` in user-facing string locations return no false positives; existing tests still pass without modification beyond updated assertion strings.
Next slice: 20.11 — Seguimiento daily workflow corrections.
```

## Adopted sub-slices from the audit

These are staged in `openspec/changes/` and follow the new development order. Each carries an explicit `Status:` line in its proposal.

- `openspec/changes/26-6a-inmoview-copy-pass/` — **next**.
- `openspec/changes/20-11-seguimiento-filter-corrections/` — Phase 2 of dev.
- `openspec/changes/20-9-seguimiento-document-activity-proof/` — not yet created; will be added before its turn.
- `openspec/changes/23-3-whatsapp-tenant-contact-configuration/` — not yet created.
- `openspec/changes/23-5-owner-contact-cta-semantics/` — proposal exists (Phase B4 in the revised plan).
- `openspec/changes/23-4-whatsapp-contact-priority-tracking/` — not yet created.
- `openspec/changes/24-5-notification-routing-e2e/` — not yet created.
- `openspec/changes/20-12-document-duplicate-guard/` — proposal exists, blocked on D5.

Deferred until development complete:
- `openspec/changes/26-5a-inmoview-domain-handoff/` — proposal exists; do not run.
- `openspec/changes/21-7-transactional-invitation-email/` — proposal exists; do not run.

## Update rule

Update this file whenever a slice handoff, validation result, merge, or accepted OpenSpec change changes completed/current/next MVP status. Every status update needs evidence. Do not delete prior revisions of the revised plan; create a new dated revision under `docs/plans/` and update this handoff to point at it.
