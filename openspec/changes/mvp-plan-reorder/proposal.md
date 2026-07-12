# Proposal — MVP Plan Reorder

## Intent

Reconcile the canonical MVP execution order with the Stage 26.0 audit findings by adopting the audit-proposed sub-slices into a revised execution plan, without deleting or rewriting any historical artifact.

## Slice contract

```txt
Stage: meta
Slice: mvp-plan-reorder
Objective: align the live execution order with the audit-confirmed P0 findings while preserving every existing planning artifact.
Evidence needed: revised execution plan, updated handoff, sub-slice stubs in OpenSpec, README index that points to the revised plan.
Do not touch: product code, seeds, migrations, runtime config, the 2026-06-04 canonical plan, the 2026-06-08 audit, or any older dated planning doc.
Done: a new session reads the handoff and the revised plan and identifies the same next slice that the audit recommends.
Next slice: highest confirmed P0 from the revised order (see Open product decisions below).
```

## Problem

The canonical plan `docs/plans/2026-06-04-final-mvp-execution-plan.md` defines 21 sequential slices and remains the recorded plan of record.

The Stage 26.0 audit on 2026-06-13 (`docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`) reproduced P0 failures against seeded data:

- seller sees and operates `Nueva propiedad`, `Editar`, `Archivar`, `Gestionar vendedores`, `Solicitar documento`, status comboboxes, and owner invitation controls on assigned properties;
- seller mutated `Casa compacta en Funes` from `Preparando publicación` to `Publicación activa` with a success toast;
- seller activity feed returns 26 items including properties assigned to other sellers (`Casa con jardín en Villa Catalina`, `Casa premium en Cerro de las Rosas`, `Casa de categoría en Farm Club`);
- template/starter routes still reachable when authenticated: `dashboard/chat`, `dashboard/kanban`, `dashboard/forms/*`, `dashboard/elements/icons`, `dashboard/react-query`, `dashboard/workspaces`;
- owner movement-level WhatsApp action renders `Contacto no configurado`;
- no `VIEWPRO_ADMIN` seeded account for browser admin proof;
- owner timeline placement, Seguimiento filter behavior, and read/unread reload remain partial.

The audit also proposed 8 corrective sub-slices: **22.8**, **20.10**, **20.11**, **20.12**, **23.5**, **21.7**, **26.5a**, **26.6a**. None of these were ever adopted into the execution order. The live handoff `docs/plans/CURRENT_MVP_EXECUTION.md` still points at `26.3` next, ignoring the audit, and is itself outdated because Stage 26.2 has since merged via PR #146 (`c7b646c`).

The result is an execution plan whose order does not match the evidence it depends on, a handoff that does not match develop, and 8 proposed slices stranded in the audit without a path into SDD.

## Scope

- Create `docs/plans/2026-06-14-mvp-execution-plan-revision.md` as the active execution plan, explicitly referencing the 2026-06-04 canonical plan as its source.
- Adopt the 8 audit-proposed sub-slices (22.8, 20.10, 20.11, 20.12, 23.5, 21.7, 26.5a, 26.6a) into the revised execution order with explicit gates and priority.
- Mark every already-merged slice as `Done` with PR/commit evidence (`0.2`, `0.3`, `21.5`, `21.6`, `25.1`, `25.2`, `25.3`, `25.4`, `26.1`, `26.2`).
- Reopen the validation gate for `26.1` because the audit reproduced residual template routes after PR #140.
- Create OpenSpec change-folder stubs (proposal only) for the 8 adopted sub-slices so they enter the SDD pipeline.
- Update `docs/plans/CURRENT_MVP_EXECUTION.md` to reflect: `26.2` Done, `26.1` validation reopened, revised plan as source precedence #2, and the next slice driven by the open product decisions below.
- Update `docs/plans/README.md` to add the revised plan as the active source while keeping the canonical plan as historical anchor.

## Preserve unchanged

These remain authoritative for trace and evidence; no edit, no delete:

- `docs/plans/2026-06-04-final-mvp-execution-plan.md` — canonical plan of record.
- `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md` — evidence overlay.
- `docs/plans/2026-06-04-mvp-closure-slices.md` — historical closure matrix.
- All older dated planning docs under `docs/plans/`.
- All previously accepted OpenSpec changes.

## Open product decisions surfaced by this reorder

The revised execution order depends on four decisions that this proposal must surface, not resolve unilaterally. They are listed in the revised plan as `decision pending` until the user records the answer.

1. **20.10 — State authority.** Does beta ship with sellers able to change official property status, or must a Cuenta Madre approval workflow gate state changes before pilot? Priority: P0 immediate if approval required; deferred to backlog if seller mutation is acceptable for beta.
2. **21.7 — Transactional invitation email.** Is manual copy-link acceptable for beta onboarding, or must real provider-backed email delivery ship now? Priority: P0 if must-ship; backlog if copy-link OK.
3. **FB-8 — Image limit 5→10.** Is the increase confirmed by product, including the storage implication? Priority: small media slice if yes; backlog if no.
4. **PR #138 revalidation.** Do seller permission guards hold in browser today against seeded `martin.demo@viewpro.local`? If the audit findings reproduce, `22.8` becomes immediate P0. If guards hold, `22.8` closes as already-done evidence.

## Out of scope

- Product code, seeds, migrations, tests, runtime config, or implementation of any adopted sub-slice. This change only reorders the plan and stages the sub-slices in OpenSpec.
- Rewriting, editing, or removing the 2026-06-04 canonical plan, the 2026-06-08 audit, the 2026-06-04 closure matrix, or any older dated planning doc.
- Reopening completed slices without a regression confirmed in browser or test.
- Broad historical roadmap rewrites or per-tool roadmap copies.
- New OpenSpec changes for backlog items (`FB-13` Apify/Zonaprop/Excel/AI/mobile/etc.).

## Affected areas

- `docs/plans/2026-06-14-mvp-execution-plan-revision.md` (new).
- `docs/plans/CURRENT_MVP_EXECUTION.md` (update).
- `docs/plans/README.md` (update index).
- `openspec/changes/mvp-plan-reorder/` (this change folder).
- `openspec/changes/22-8-seller-permission-hotfix/proposal.md` (stub).
- `openspec/changes/20-10-state-authority-decision/proposal.md` (stub).
- `openspec/changes/20-11-seguimiento-filter-corrections/proposal.md` (stub).
- `openspec/changes/20-12-document-duplicate-guard/proposal.md` (stub).
- `openspec/changes/23-5-owner-contact-cta-semantics/proposal.md` (stub).
- `openspec/changes/21-7-transactional-invitation-email/proposal.md` (stub).
- `openspec/changes/26-5a-inmoview-domain-handoff/proposal.md` (stub).
- `openspec/changes/26-6a-inmoview-copy-pass/proposal.md` (stub).

## Success criteria

- A new session opens `docs/plans/CURRENT_MVP_EXECUTION.md`, follows the source precedence, and identifies the same next slice that the revised plan and the audit recommend.
- Every audit-confirmed P0 maps to a slice in the revised order with a defined gate.
- Every already-completed slice is marked Done with PR/commit evidence and is not reopened.
- The four open product decisions are visible in the proposal and the revised plan, not buried.
- Historical docs remain accessible as evidence with explicit `historical` labels and no content edits.
- Sub-slice stubs exist in `openspec/changes/` so future SDD phases (spec/design/tasks/apply) can begin without re-deriving intent from the audit.

## Risks

- Adopting sub-slices the user has not approved could lock in a worse execution order than the canonical plan. Mitigation: keep the four decisions explicit and unresolved until the user records them; the revised plan marks dependent slices `decision pending` rather than forcing priority.
- Reopening the `26.1` validation gate could delay `26.3`. Mitigation: the gate is a browser-only revalidation, not a re-implementation; if guards hold, `26.1` re-closes the same day.
- Documentation drift between revised plan, handoff, audit, and README. Mitigation: Task #6 in the change runs an explicit cross-reference pass before commit.
- Sub-slice stubs could be mistaken for adopted scope. Mitigation: each stub explicitly states `status: proposed, awaiting decision` and references the open product decision it depends on.

## Rollback

Revert the new revised plan doc, the eight sub-slice stub folders, the handoff edit, the README edit, and this OpenSpec change folder. The 2026-06-04 canonical plan and the 2026-06-08 audit remain untouched, so rollback restores prior state without loss of any historical content.
