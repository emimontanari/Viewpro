# Proposal — Stage 20.12 Document Duplicate Guard and Visibility Decision

**Status:** proposed, awaiting product decision on canonical document taxonomy.
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

## Open product decision

A canonical document-type taxonomy is required before this slice can be implemented safely. Without taxonomy, duplicate detection must rely on free-text normalization, which is unreliable for legal/identity documents (escritura, DNI, plano, etc.). Product must confirm the canonical list and the synonym map before SDD `sdd-spec` runs.

## Out of scope

OCR or scanning of document bytes, storage adapter changes, document panel redesign, owner-facing taxonomy editor, agency-defined custom document types.

## Next phases

Move to SDD `sdd-explore` to map current document-request schema and approved-state semantics, then `sdd-spec` once taxonomy is confirmed.
