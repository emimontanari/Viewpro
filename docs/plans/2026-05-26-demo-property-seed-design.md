# Demo Property Seed Design

## Goal
Add a controlled demo seed for ViewPro so local/dev environments can show realistic properties, movement activity, document requests, dashboard analytics, and Seguimiento data without manually creating records.

## Scope
- Add a developer-only seed command for the API package.
- Recreate a single namespaced demo tenant with deterministic demo users.
- Insert sanitized property records inspired by real listing shapes, not raw portal payloads.
- Create realistic movements and document requests so Inicio and Seguimiento have useful activity.
- Download curated demo image URLs into the existing local property-image storage so the app uses normal `PropertyAssetImage` rows.
- Guard the script against production-like databases.

## Non-goals
- No production import pipeline.
- No UI upload/import flow.
- No raw external JSON committed to the repo.
- No phone numbers, map URLs, Google API-key URLs, portal logos, or publisher/private contact data.
- No schema migration or persistent external-image model.
- No hotlinking from the frontend; source image URLs are used only by the seed script to download local demo copies.

## Data model
The seed writes directly to the existing Prisma models:

```txt
Tenant
 ├─ TenantMembership
 ├─ PropertyEngagement
 │   ├─ PropertyAsset
 │   ├─ PropertyAgent
 │   ├─ PropertyAssetImage
 │   ├─ Movement
 │   └─ DocumentRequest
 └─ User
```

The seed creates:

- one principal manager: `demo@viewpro.local`;
- three demo team members for seller/activity distribution;
- one tenant: `ViewPro Demo Inmobiliaria` / `viewpro-demo-inmobiliaria`;
- about 20 sanitized property engagements;
- owner links using fake `@viewpro.local` owner emails;
- one downloaded local demo image for each property when the CDN is reachable;
- movements dated across the last 30 days;
- document requests for a subset of properties.

## Reset behavior
The command is intentionally reset-style and deterministic.

Before inserting, it deletes only records tied to the demo tenant and demo users:

1. find the demo tenant by slug;
2. collect its engagement and asset IDs;
3. delete document requests, movements, property-agent rows, engagements, owner links, images for those assets, and property assets;
4. delete memberships and tenant;
5. delete deterministic demo users only when they have no remaining references after demo tenant cleanup;
6. recreate the full demo dataset.

It must not delete other tenants, non-demo users, global refresh tokens, or actor analytics outside the demo tenant.

## Safety
The script must refuse to run when:

- `NODE_ENV=production`;
- `DATABASE_URL` is missing;
- `DATABASE_URL` does not look local/dev/test;
- an explicit unsafe override is not provided.

Allowed local/dev URLs should include signals such as `localhost`, `127.0.0.1`, `viewpro_dev`, or `viewpro_test`. If a developer needs to run somewhere else, they can set a clearly named override such as `VIEWPRO_ALLOW_DEMO_SEED=true`.

## Command
Add package scripts:

```bash
pnpm --filter @viewpro/api demo:seed
pnpm demo:seed
```

The root script is just a proxy to the API package.

## Data mapping
Sanitized property records should use the existing API fields:

| Demo field | Prisma/API field |
|---|---|
| title | `PropertyAsset.title` |
| addressLine | `PropertyAsset.addressLine` |
| city | `PropertyAsset.city` |
| province | `PropertyAsset.province` |
| propertyType | `PropertyAsset.propertyType` |
| totalAreaSqm | `PropertyAsset.totalAreaSqm` |
| coveredAreaSqm | `PropertyAsset.coveredAreaSqm` |
| rooms | `PropertyAsset.rooms` |
| bedrooms | `PropertyAsset.bedrooms` |
| bathrooms | `PropertyAsset.bathrooms` |
| garages | `PropertyAsset.garages` |
| ageYears | `PropertyAsset.ageYears` |
| orientation | `PropertyAsset.orientation` |
| operationType | `PropertyEngagement.operationType` |
| publishedPriceCents | `PropertyEngagement.publishedPriceCents` |
| currency | `PropertyEngagement.currency` |
| status | `PropertyEngagement.status` |

## Image rules
The seed may include a curated list of external source image URLs, but those URLs are not part of the product image contract.

At seed time, each URL is downloaded, bounded by timeout, content-length/streamed byte limits, and size/type checks, written to the same local uploads directory used by normal property image uploads, and persisted as a `PropertyAssetImage` with a normal `storageKey`. The API continues to expose images through `buildPropertyImageUrl(storageKey)`.

If an image download fails, the seed should warn and continue so demo data still works without external network access.

## Activity rules
Each property receives one to four movement rows. Movement types should stay within normal business activity:

- `GENERAL_UPDATE`
- `INQUIRY`
- `VISIT_SCHEDULED`
- `VISIT_COMPLETED`
- `OFFER_RECEIVED`
- `DOCUMENTATION_UPDATE`
- `STATUS_CHANGE`

Do not use lifecycle-only `ARCHIVED` or `RESTORED` movements in this seed.

Document requests should use existing titles such as:

- Escritura
- Plano municipal
- Impuesto municipal
- DNI del propietario
- Reglamento de copropiedad
- Estado de expensas

## Testing and validation
Minimum validation:

```bash
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api exec vitest run test/analytics.use-cases.spec.ts test/analytics.e2e-spec.ts
node --check apps/api/scripts/seed-demo.mjs
```

If a local development database is available, manually run:

```bash
pnpm demo:seed
```

Then verify:

- login with `demo@viewpro.local` using the documented demo password;
- `/dashboard` shows populated counters, top properties, sellers, and recent activity;
- `/dashboard/product` shows the seeded properties with images when downloads succeeded;
- `/dashboard/seguimiento` shows movements and document requests.

## Review risks
- Data cleanup must be narrow and tenant-scoped.
- The script must not make production DB writes easy.
- Seed data should remain sanitized and not include portal secrets or contact details.
- Curated external image URLs should never include map URLs, API-key URLs, phones, or publisher/contact metadata.
- Direct Prisma writes should preserve the same relational shape expected by the application use cases.
