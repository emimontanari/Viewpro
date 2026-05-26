# Demo Property Seed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a safe demo seed command that recreates a realistic local ViewPro tenant with properties, images, movements, owners, and document requests.

**Architecture:** Implement a developer-only Node script in the API package that uses Prisma directly. The script loads local env files, refuses production-like database URLs, resets only the deterministic demo tenant/users, inserts sanitized demo records, and downloads curated image URLs into normal local property-image storage.

**Tech Stack:** Node.js `.mjs` script, Prisma Client, argon2, pnpm scripts, existing ViewPro Prisma schema.

---

### Task 1: Add the demo seed script shell

**Files:**
- Create: `viewpro-app/apps/api/scripts/seed-demo.mjs`
- Modify: `viewpro-app/apps/api/package.json`
- Modify: `viewpro-app/package.json`

**Step 1: Create the script with env loading and safety guard**

Implement these foundations:

- load `.env` from API cwd and root cwd if present;
- require `DATABASE_URL`;
- reject `NODE_ENV=production`;
- allow URLs containing `localhost`, `127.0.0.1`, `viewpro_dev`, or `viewpro_test`;
- allow override with `VIEWPRO_ALLOW_DEMO_SEED=true`;
- initialize and disconnect `PrismaClient`.

**Step 2: Add package commands**

Add to `viewpro-app/apps/api/package.json`:

```json
"demo:seed": "node scripts/seed-demo.mjs"
```

Add to `viewpro-app/package.json`:

```json
"demo:seed": "pnpm --filter @viewpro/api demo:seed"
```

**Step 3: Validate syntax**

Run:

```bash
cd viewpro-app
node --check apps/api/scripts/seed-demo.mjs
```

Expected: no syntax errors.

---

### Task 2: Implement reset-only demo tenant cleanup

**Files:**
- Modify: `viewpro-app/apps/api/scripts/seed-demo.mjs`

**Step 1: Add deterministic demo constants**

Use:

```js
const DEMO_TENANT_SLUG = 'viewpro-demo-inmobiliaria'
const DEMO_TENANT_NAME = 'ViewPro Demo Inmobiliaria'
const DEMO_PASSWORD = process.env.VIEWPRO_DEMO_PASSWORD ?? buildDefaultDemoPassword()
const DEMO_USERS = [
  { email: 'demo@viewpro.local', firstName: 'Demo', lastName: 'ViewPro', role: 'PRINCIPAL_MANAGER' },
  { email: 'sofia.demo@viewpro.local', firstName: 'Sofía', lastName: 'Demo', role: 'MANAGER' },
  { email: 'martin.demo@viewpro.local', firstName: 'Martín', lastName: 'Demo', role: 'AGENT' },
  { email: 'lucia.demo@viewpro.local', firstName: 'Lucía', lastName: 'Demo', role: 'AGENT' }
]
```

**Step 2: Add `resetDemoTenant(prisma)`**

Behavior:

1. find tenant by slug;
2. if missing, return;
3. collect engagement IDs and asset IDs;
4. transactionally delete tenant-scoped and asset-scoped records in safe dependency order:
   - `documentRequest.deleteMany({ tenantId })`;
   - `movement.deleteMany({ tenantId })`;
   - `propertyAgent.deleteMany({ tenantId })`;
   - `propertyEngagement.deleteMany({ tenantId })`;
   - `propertyAssetOwner.deleteMany({ propertyAssetId: { in: assetIds } })`;
   - `propertyAssetImage.deleteMany({ propertyAssetId: { in: assetIds } })`;
   - `propertyAsset.deleteMany({ id: { in: assetIds } })`;
   - `tenantMembership.deleteMany({ tenantId })`;
   - `tenant.delete({ id: tenantId })`.
5. delete deterministic demo users only if they have no remaining references after tenant/assets are gone. Do not delete global refresh tokens or actor analytics outside the demo tenant.

**Step 3: Validate type-level behavior**

Run:

```bash
cd viewpro-app
node --check apps/api/scripts/seed-demo.mjs
pnpm --filter @viewpro/api typecheck
```

Expected: both pass.

---

### Task 3: Add sanitized demo dataset and insert users/tenant/properties

**Files:**
- Modify: `viewpro-app/apps/api/scripts/seed-demo.mjs`

**Step 1: Add sanitized property fixtures**

Create about 20 records with only safe fields:

```js
{
  title: 'Casa familiar con pileta en Villa Centenario',
  addressLine: 'Villa Centenario',
  city: 'Córdoba',
  province: 'Córdoba',
  propertyType: 'HOUSE',
  operationType: 'SALE',
  status: 'ACTIVE_PUBLICATION',
  currency: 'USD',
  price: 125000,
  totalAreaSqm: 360,
  coveredAreaSqm: 231,
  rooms: 7,
  bedrooms: 6,
  bathrooms: 2,
  garages: 2,
  ageYears: 25,
  orientation: 'N'
}
```

Do not include raw portal JSON, phones, map URLs, API-key URLs, publisher details, or portal metadata. Curated source image URLs are allowed only for the seed downloader and must be persisted as local `PropertyAssetImage.storageKey` rows, not frontend hotlinks.

**Step 2: Add creation helpers**

Implement:

- `createDemoUsers(prisma)`;
- `createDemoTenant(prisma, users)`;
- `createDemoProperties(prisma, tenant, users)`.

Use direct Prisma creates matching existing relational shape:

- `propertyAsset.create`;
- `propertyEngagement.create`;
- `propertyAssetOwner.create`;
- `propertyAgent.create`.

**Step 3: Validate script syntax**

Run:

```bash
cd viewpro-app
node --check apps/api/scripts/seed-demo.mjs
```

---

### Task 4: Add local demo property images

**Files:**
- Modify: `viewpro-app/apps/api/scripts/seed-demo.mjs`

**Step 1: Add curated source image URLs**

Add a compact `DEMO_PROPERTY_IMAGE_URLS` array with one safe image URL per demo property. Do not add raw listing JSON, map URLs, API-key URLs, phones, publisher data, or contact metadata.

**Step 2: Download into existing storage shape**

Implement helpers that:

- fetch images with a timeout;
- accept only JPEG, PNG, or WebP;
- reject files larger than 5 MB using `Content-Length` when present and streamed byte counting while reading;
- write files under `uploads/property-images/<tenantId>/<propertyAssetId>/<imageId>.<ext>` or `PROPERTY_IMAGES_UPLOADS_ROOT` when configured;
- create `PropertyAssetImage` rows with `storageKey`, `originalFilename`, `mimeType`, `sizeBytes`, `isPrimary`, and `uploadedByUserId`.

**Step 3: Keep seed resilient**

If a download fails, log a warning and continue. The seed should still create properties, movements, and document requests without external network access.

**Step 4: Reset image files**

When resetting the demo tenant, delete only the demo tenant upload directory under `property-images/<tenantId>`.

---

### Task 5: Add movement and document request activity

**Files:**
- Modify: `viewpro-app/apps/api/scripts/seed-demo.mjs`

**Step 1: Add relative dates**

Implement helper:

```js
function daysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}
```

**Step 2: Seed movements**

For every property, create at least one movement. Across all properties include:

- `GENERAL_UPDATE`
- `INQUIRY`
- `VISIT_SCHEDULED`
- `VISIT_COMPLETED`
- `OFFER_RECEIVED`
- `DOCUMENTATION_UPDATE`
- `STATUS_CHANGE`

Do not use `ARCHIVED` or `RESTORED`.

Set `createdByUserId` across the three demo team members so `topSellers` is meaningful.

**Step 3: Seed document requests**

For a subset of properties, create document requests tied to their fake owner link:

- Escritura
- Plano municipal
- Impuesto municipal
- DNI del propietario
- Reglamento de copropiedad
- Estado de expensas

Use varied `createdAt` dates inside the last 30 days.

**Step 4: Validate script syntax**

Run:

```bash
cd viewpro-app
node --check apps/api/scripts/seed-demo.mjs
```

---

### Task 6: Validate and document usage

**Files:**
- Modify: `README.md` or add a short section in `docs/plans/2026-05-26-demo-property-seed-implementation.md` if README scope is too broad.

**Step 1: Run non-mutating validation**

Run:

```bash
cd viewpro-app
node --check apps/api/scripts/seed-demo.mjs
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api exec vitest run test/analytics.use-cases.spec.ts test/analytics.e2e-spec.ts
```

Expected: all pass.

**Step 2: Optional local DB smoke test**

Only when the local DB is available and safe:

```bash
cd viewpro-app
pnpm demo:seed
```

Expected output:

```txt
Seeded ViewPro Demo Inmobiliaria
Login: demo@viewpro.local
Password: value printed by the script or `VIEWPRO_DEMO_PASSWORD`
Properties: 20
Images: <count>
Movements: <count>
Document requests: <count>
```

**Step 3: Manual app verification**

- log in as `demo@viewpro.local`;
- open `/dashboard`;
- confirm counters, top properties, sellers, and recent activity are populated;
- open `/dashboard/product`;
- confirm properties render with images when image downloads succeeded;
- open `/dashboard/seguimiento`;
- confirm movement and document activity render.

---

### Task 7: Fresh review before commit

**Files:**
- All files changed by the seed slice.

**Step 1: Run final checks**

```bash
cd viewpro-app
node --check apps/api/scripts/seed-demo.mjs
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api exec vitest run test/analytics.use-cases.spec.ts test/analytics.e2e-spec.ts
cd ..
git diff --check
```

**Step 2: Run fresh reviewer**

Ask for a fresh-context review focused on:

- production safety guard;
- reset scope;
- sanitized data;
- no accidental secrets/raw portal data;
- curated image URL safety and local-storage persistence;
- command correctness.

**Step 3: Commit**

```bash
git add docs/plans/2026-05-26-demo-property-seed-design.md docs/plans/2026-05-26-demo-property-seed-implementation.md viewpro-app/apps/api/scripts/seed-demo.mjs viewpro-app/apps/api/package.json viewpro-app/package.json
git commit -m "feat(api): add demo property seed"
```
