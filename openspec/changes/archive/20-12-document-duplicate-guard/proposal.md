# Proposal — Stage 20.12 Document Duplicate Guard and Visibility Decision

**Status:** proposed, D5 resolved 2026-06-23 — ready for `sdd-spec`.
**Origin:** `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`, FB-9.
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase B, slice B8.

## Slice contract

```txt
Stage: 20
Slice: 20.12 — Document duplicate guard and visibility decision
Objective: prevent owner-frustrating duplicate document requests if a canonical type taxonomy is approved.
Evidence needed: approved-document duplicate tests, free-text normalization tests, requester/role visibility tests.
Do not touch: OCR/scanning, storage adapter, document panel redesign.
Done: users cannot re-request already-approved canonical documents and unrelated sellers do not see seller-specific requests.
Next slice: Stage 23.3/23.4 or next confirmed P0.
```

## Product decision D5 — RESOLVED 2026-06-23

A canonical document-type taxonomy was required before this slice could be implemented safely. Without taxonomy, duplicate detection relies on free-text normalization, unreliable for legal/identity documents. Today the system has NO document-type concept: `DocumentRequest.title` is free text (max 200), with no type/category column and zero server-side dedup. The approved taxonomy below is designed from scratch, grounded in the real seed/test values in use.

**Canonical types** (`key` | label | normalized synonyms):

| Key | Label | Synonyms |
|---|---|---|
| `escritura` | Escritura | escritura, escritura firmada, título, título de propiedad |
| `dni` | DNI del propietario | dni, documento de identidad, dni del propietario, cédula |
| `plano` | Plano municipal | plano, plano municipal, plano de mensura, planos |
| `impuesto_municipal` | Impuesto municipal | impuesto municipal, abl, tasa municipal, impuesto inmobiliario |
| `reglamento_copropiedad` | Reglamento de copropiedad | reglamento, reglamento de copropiedad, propiedad horizontal |
| `expensas` | Estado de expensas | expensas, estado de expensas, libre deuda de expensas |
| `boleto_compraventa` | Boleto de compra-venta | boleto, boleto de compraventa, boleto de compra-venta |
| `constancia_servicios` | Comprobante de servicios | servicios, comprobante de servicios, constancia de servicios |
| `informe_dominio` | Informe de dominio | informe de dominio, dominio |
| `otro` | Otro (free text) | *fallback — no match → NO guard* |

**Normalization rule:** lowercase + strip NFD diacritics + trim, then match against the synonym set (mirrors the existing frontend `normalizeSearchText`).

**Guard rules:**
1. The duplicate guard triggers ONLY when an `APPROVED` request of the same canonical type already exists on the same engagement. `PENDING`/`REJECTED`/`SUBMITTED` do not block (owner may still need to upload/re-upload).
2. The `otro` fallback (title matches no canonical type) applies NO guard — the title stays free text.

## Out of scope

OCR or scanning of document bytes, storage adapter changes, document panel redesign, owner-facing taxonomy editor, agency-defined custom document types.

## Next phases

Move to SDD `sdd-explore` to map current document-request schema and approved-state semantics, then `sdd-spec` once taxonomy is confirmed.
