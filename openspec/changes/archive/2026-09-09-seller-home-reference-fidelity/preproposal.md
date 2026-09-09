# Pre-Proposal Gate — Seller Home Reference Fidelity

## Status

Product decisions confirmed by the user. Research is unselected because repository contracts and the stored reference provide sufficient evidence. Proposal may proceed.

## Confirmed boundary

- Exact authenticated `AGENT` home only; manager, owner, public/auth, #306, and #327 remain protected.
- Frontend-only recomposition over the two existing independent seller queries.
- Real sources only: assigned engagements, rolling 24-hour movement count, seven-day stale count, narrow attention count, and permitted movement/document activity.
- Independent loading, empty, error, partial-availability, and retry semantics; failures never become zero/empty success.
- No global movement action, direct property creation, proposals, tasks, agenda, clients, calls, messages, visits, photos, price changes, performance, percentages, alerts, badges, or duplicate mobile shell.
- Responsive/accessibility proof is required by #523; exact browser-slice placement is a delivery-planning decision, not a product choice.

## Confirmed product decisions

1. `greeting:personalized` — use the real authenticated display name; keep the active tenant as adjacent context.
2. `priority:short-list` — render the two supported aggregates as non-checkable rows, without individual tasks or deadlines.

Rejected alternatives: tenant-led heading and standalone priority cards.

## Evidence

- `exploration.md`
- `assets/seller-home-reference.jpeg`
- Issue #523 (`status:approved`)
