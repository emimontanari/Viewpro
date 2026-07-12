# Design — Stage 26.1 Billing Route Cleanup

## Decision

Remove all pilot-visible billing entry points and make `/dashboard/billing` redirect to `/dashboard`. Do not implement billing, pricing, subscriptions, Stripe, or future billing UX.

## Target changes

| File | Change |
| --- | --- |
| `viewpro-app/apps/app-new/src/config/nav-config.ts` | Remove `Facturación`, `/dashboard/billing`, and shortcut `b b` from default dashboard nav. |
| `viewpro-app/apps/app-new/src/config/nav-config.test.ts` | Assert dashboard nav and account dropdown sources do not expose billing. |
| `viewpro-app/apps/app-new/src/components/kbar/palette.test.ts` | Assert navigation-derived command actions do not include billing. |
| `viewpro-app/apps/app-new/src/components/layout/app-sidebar.tsx` | Remove hard-coded billing dropdown item. |
| `viewpro-app/apps/app-new/src/components/layout/user-nav.tsx` | Remove hard-coded billing dropdown item. |
| `viewpro-app/apps/app-new/src/app/dashboard/billing/page.tsx` | Replace placeholder client page with server redirect to `/dashboard`. |
| `viewpro-app/apps/app-new/src/app/dashboard/billing/page.test.ts` | Assert route calls `redirect('/dashboard')`. |
| `viewpro-app/apps/app-new/src/config/infoconfig.ts` | Remove now-unused billing info-panel copy. |

## Verification

```bash
cd viewpro-app/apps/app-new && pnpm test -- src/config/nav-config.test.ts src/components/kbar/palette.test.ts src/app/dashboard/billing/page.test.ts
cd viewpro-app/apps/app-new && ! rg -n "/dashboard/billing|Facturación" src/config src/components --glob '!**/*.test.ts' --glob '!**/*.test.tsx'
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter lint:strict
git diff --check
```

## Risks

A redirect keeps the route segment allocated. That is intentional: future billing can replace it through a separate accepted OpenSpec change.
