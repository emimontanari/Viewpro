# Proposal — Stage 22.8 Seller Permission and Activity-Scope Hotfix

**Status:** **closed by evidence — 2026-06-14**. Gate G1 reproduced the audit scenario in browser as `martin.demo@viewpro.local` against the migrated demo seed: none of the flagged UI controls render (`Nueva propiedad`, `Gestionar vendedores`, `Editar/Archivar propiedad`, `Solicitar documento`, `Invitar propietario`, status combobox). The API `POST /property-engagements/<id>/movements` with `ACTIVE_PUBLICATION` returned `403 Forbidden "Insufficient permissions"`. PR #138 guards hold; no hotfix code required.
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

**Gate G1 result — 2026-06-14:** PASS. Guards hold both in UI (no flagged controls visible) and at the API layer (`403 Forbidden`). Slice closes as evidence-only. No implementation runs.

## Out of scope

Custom statuses per agency, ProductForm redesign, team analytics, billing, bulk import, broad navigation redesign.

## Next phases

No further phases. Slice is closed by evidence. Reopen only if a future regression reproduces the audit findings.
