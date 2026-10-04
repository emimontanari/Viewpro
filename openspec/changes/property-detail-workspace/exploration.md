# Exploration: Property detail workspace (#349)

## Decision

**Status: ACCEPTED FOR IMPLEMENTATION PLANNING.** The user accepted the detail-hub design: same-page links to four existing groups—**Datos e imágenes**, **Personas**, **Actividad**, and **Documentos**—while preserving `/dashboard/product/{id}/edit`. This records design acceptance only; it does not claim implementation or verification.

## Evidence and boundaries

`/dashboard/product/[productId]` and `/edit` wrap `ProductViewPage`; detail/edit render paths share `ProductForm`. Detail already contains image carousel, read-only property information, owner/agents, status, movement history, and document requests. Existing `/edit`, list return, cancel, and save destinations must remain intact.

Management, movement/status requests, and document request/review have distinct existing permission checks. Keep owner/agent management gated; preserve seller viewing and existing status-request/document actions. Preserve archive-state behavior. Backend authorization remains authoritative. No new APIs, mutations, permissions, inline editing, or hidden tabs.

## Implementation constraint

Navigation must have stable, valid targets and be useful rather than decorative. In particular, **Datos e imágenes** must visibly take users to existing property-data/image content, with editing available through the existing `/edit` affordance; it must not imply inline editing. Keep all content available on narrow and wide layouts and support keyboard navigation.
