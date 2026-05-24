# Seguimiento Filter Hardening Plan

## Goal
Close the Seguimiento slice with small UI polish on activity-kind filter buttons and focused frontend/BFF regression coverage.

## Scope
- Add icons to `Todo`, `Movimientos`, and `Documentos` filter buttons.
- Add a minimal `app-new` Vitest setup.
- Cover `ActivityFilters` behavior, `ActivityFeed` empty-state shell behavior, and `/api/activity/feed` query forwarding.

## Non-Goals
- No new activity behavior.
- No backend contract changes.
- No new routes or sections.
- No redesign of the full filter card.
- No hiding stable UI chrome just because a filter has zero results.

## Implementation Notes
- Keep the existing compact segmented-control style.
- Use existing icon infrastructure from `src/components/icons.tsx`; add aliases only when needed.
- Prefer component-level tests for presentational behavior and helper-level/BFF tests for query forwarding.
- Empty result states should keep the feed header/count and show a no-results message inside the existing shell.

## Validation
- `pnpm --filter next-shadcn-dashboard-starter test`
- `pnpm --filter next-shadcn-dashboard-starter lint`
- `pnpm --filter next-shadcn-dashboard-starter build`
- `git diff --check`
