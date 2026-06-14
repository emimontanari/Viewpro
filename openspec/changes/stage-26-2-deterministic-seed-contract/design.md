# Design — Stage 26.2 Deterministic Seed Contract

## Decision

Tighten the existing demo seed instead of building new product behavior. The seed contract will use stable emails, titles, counts, fixed dates, generated local image bytes, seeded admin/contact/notification fixtures, and focused seeded-smoke assertions. Full workflow choreography stays in Stage 26.3.

## Target changes

| File | Change |
| --- | --- |
| `viewpro-app/apps/api/scripts/seed-demo.mjs` | Add admin persona, tenant limits, fixed seed clock, deterministic local images, notification fixtures, contact phone fixture, admin audit events, safer summary logs. |
| `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` | Add focused Stage 26.2 proof for notifications, contact fixtures, admin tenant limits, and deterministic image/contact anchors. |
| `openspec/changes/stage-26-2-deterministic-seed-contract/*` | Record proposal/spec/design/tasks/apply/verify evidence. |

## Seed contract choices

- Stable selectors/counts are required; stable database IDs are not required for Stage 26.2.
- Dates use `VIEWPRO_DEMO_NOW` or a fixed default so contract evidence is repeatable.
- Images use generated local PNG bytes for every property; no external image fetch is required.
- Admin is `admin.demo@viewpro.local` with `GlobalRole.VIEWPRO_ADMIN` and no tenant membership.
- Tenant limits are deterministic: users `12`, active engagements `25`, document storage `512` MB.
- Notifications are seeded as data fixtures with safe relative owner/internal links and read/unread states.
- Contact fixtures use tenant WhatsApp, Martín seller WhatsApp, and Sofía no-config movement contact.

## Validation

```bash
cd viewpro-app && pnpm --filter @viewpro/api db:validate
cd viewpro-app && pnpm --filter @viewpro/api typecheck
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter lint:strict
cd viewpro-app && pnpm demo:seed
APP_PUBLIC_URL=http://127.0.0.1:3100 VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3101 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3100 pnpm --filter next-shadcn-dashboard-starter test:seeded
```

If local Postgres/Docker is unavailable, record seed/E2E as blocked and keep focused static/type/lint evidence.
