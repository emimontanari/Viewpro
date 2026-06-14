# Proposal — Stage 22.8 Seller Permission and Activity-Scope Hotfix

**Status:** proposed, awaiting product decision D4 (PR #138 browser revalidation).
**Origin:** `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`, FB-1, FB-3, manual demo walkthrough 2026-06-13.
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase A, slice A2.

## Slice contract

```txt
Stage: 22
Slice: 22.8 — Seller permission and activity-scope hotfix
Objective: close confirmed seller permission leaks and prove seller-scoped visibility.
Evidence needed: API/BFF/UI/seeded proof that sellers cannot manage other sellers and see only allowed property/update scopes.
Do not touch: team redesign, advanced analytics, billing, broad navigation redesign.
Done: seller cannot access assignment management or unrelated seller-specific history through UI or API.
Next slice: return to Stage 26.0 decision rule (now Phase A4 G2).
```

## Reproductions to fix (from audit)

- Seller sees `Nueva propiedad`, status comboboxes, `Editar`, `Archivar propiedad`, `Agregar actualización`, `Editar propiedad`, owner invitation controls, `Gestionar vendedores`, and `Solicitar documento` on an assigned property.
- Seller changed `Casa compacta en Funes` from `Preparando publicación` to `Publicación activa` and received success toast.
- Seller activity feed returns 26 items including properties assigned to other sellers (`Casa con jardín en Villa Catalina`, `Casa premium en Cerro de las Rosas`, `Casa de categoría en Farm Club`).

## Gate before this slice opens

PR #138 browser revalidation (G1). Run as `martin.demo@viewpro.local`. If guards hold, this slice closes as `evidence-only` without code changes. If guards fail to hold, this slice runs as immediate P0.

## Out of scope

Custom statuses per agency, ProductForm redesign, team analytics, billing, bulk import, broad navigation redesign.

## Next phases

Move to SDD `sdd-spec` once D4 is recorded and gate result is known.
