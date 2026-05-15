# ViewPro Stage 8 Pilot Metrics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add internal pilot analytics so ViewPro can measure whether agencies keep owners informed during the MVP pilot.

**Architecture:** Persist safe backend events into Postgres through an `AnalyticsService` and `AnalyticsRepository`. Existing use cases emit events without depending on external analytics; manager-only reports query internal events and engagement data.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL, Vitest, Supertest, existing ViewPro auth/tenant/permission modules.

---

## Rules for this stage

- Follow strict TDD.
- Keep each slice as a reviewable work unit.
- Do not commit unless the user explicitly authorizes it.
- Do not add PostHog or any external analytics dependency in Stage 8.
- Do not track sensitive data: emails, names, addresses, document contents, movement observations, tokens, passwords, or secrets.
- Analytics failures must not break the primary product flow.

## Verification commands

Run from `viewpro-app/` unless noted otherwise:

```bash
pnpm db:migrate
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

## Slice 1 — Base analytics

### Task 1: Add Prisma analytics schema

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: `viewpro-app/apps/api/prisma/migrations/<timestamp>_add_analytics_events/migration.sql`
- Test: `viewpro-app/apps/api/test/analytics.repository.spec.ts`

**Step 1: Write failing repository tests**

Create `analytics.repository.spec.ts` covering:
- creating an analytics event
- listing tenant events paginated
- filtering by event name
- counting tenant events in a date range
- ensuring metadata can be null or safe JSON

**Step 2: Run tests and confirm failure**

```bash
pnpm --filter @viewpro/api test
```

Expected: fail because analytics schema/repository does not exist.

**Step 3: Add Prisma enums/model**

Add:
- `AnalyticsActorType`
- `AnalyticsEventName`
- `AnalyticsEvent`

Recommended indexes:
- `[tenantId, eventName, occurredAt]`
- `[tenantId, occurredAt]`
- `[propertyEngagementId, occurredAt]`
- `[actorUserId, occurredAt]`

**Step 4: Generate migration**

```bash
pnpm --filter @viewpro/api exec prisma migrate dev --name add_analytics_events
```

Expected: migration created and Prisma Client generated.

### Task 2: Add analytics module, repository, and service

**Files:**
- Create: `viewpro-app/apps/api/src/analytics/analytics.module.ts`
- Create: `viewpro-app/apps/api/src/analytics/analytics.repository.ts`
- Create: `viewpro-app/apps/api/src/analytics/prisma-analytics.repository.ts`
- Create: `viewpro-app/apps/api/src/analytics/analytics.service.ts`
- Create: `viewpro-app/apps/api/src/analytics/analytics-event.mapper.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts`
- Test: `viewpro-app/apps/api/test/analytics.service.spec.ts`

**Step 1: Write service tests**

Cover:
- service delegates to repository
- service sanitizes metadata by dropping sensitive keys
- service catches repository errors and resolves without throwing

**Step 2: Implement repository/service**

Use a DI token for the repository.

`AnalyticsService.track(...)` should never throw to callers.

**Step 3: Run verification**

```bash
pnpm db:migrate
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
```

Expected: pass.

**Step 4: Commit checkpoint**

Only if the user explicitly authorizes it:

```bash
git add viewpro-app/apps/api/prisma viewpro-app/apps/api/src/analytics viewpro-app/apps/api/src/app.module.ts viewpro-app/apps/api/test/analytics.repository.spec.ts viewpro-app/apps/api/test/analytics.service.spec.ts
git commit -m "feat(api): add analytics event foundation"
```

## Slice 2 — Emit backend events

### Task 3: Track auth and movement events

**Files:**
- Modify: `viewpro-app/apps/api/src/auth/`
- Modify: `viewpro-app/apps/api/src/movements/use-cases/create-movement.use-case.ts`
- Test: relevant auth/movement use-case tests

**Step 1: Write failing tests**

Cover:
- internal login emits `SELLER_LOGGED_IN` when tenant context can be resolved
- movement creation emits `MOVEMENT_CREATED`
- status-changing movement emits `PROPERTY_STATUS_CHANGED`
- analytics failure does not fail login/movement creation

**Step 2: Implement tracking**

Inject `AnalyticsService` only into use cases/services where needed. Keep event metadata safe:
- status enum values are allowed
- observations are not allowed

**Step 3: Run tests**

```bash
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
```

Expected: pass.

### Task 4: Track owner and document events

**Files:**
- Modify: `viewpro-app/apps/api/src/owner-portal/use-cases/get-owner-property.use-case.ts`
- Modify: `viewpro-app/apps/api/src/documents/use-cases/create-document-request.use-case.ts`
- Modify: `viewpro-app/apps/api/src/documents/use-cases/confirm-owner-document-upload.use-case.ts`
- Modify: `viewpro-app/apps/api/src/documents/use-cases/approve-document-request.use-case.ts`
- Modify: `viewpro-app/apps/api/src/documents/use-cases/reject-document-request.use-case.ts`
- Test: owner/document use-case tests

**Step 1: Write failing tests**

Cover:
- owner property detail emits `OWNER_VIEWED_PROPERTY`
- document request creation emits `DOCUMENT_REQUESTED`
- upload confirmation emits `DOCUMENT_UPLOADED`
- approval emits `DOCUMENT_APPROVED`
- rejection emits `DOCUMENT_REJECTED`
- analytics failure does not break the primary flow

**Step 2: Implement tracking**

Include only IDs and safe enum/status metadata.

**Step 3: Run verification**

```bash
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
```

Expected: pass.

**Step 4: Commit checkpoint**

Only if the user explicitly authorizes it:

```bash
git add viewpro-app/apps/api/src/auth viewpro-app/apps/api/src/movements viewpro-app/apps/api/src/owner-portal viewpro-app/apps/api/src/documents viewpro-app/apps/api/test
git commit -m "feat(api): track pilot analytics events"
```

## Slice 3 — Pilot reports

### Task 5: Add report use cases

**Files:**
- Create: `viewpro-app/apps/api/src/analytics/use-cases/get-pilot-summary.use-case.ts`
- Create: `viewpro-app/apps/api/src/analytics/use-cases/list-inactive-engagements.use-case.ts`
- Create: `viewpro-app/apps/api/src/analytics/use-cases/list-analytics-events.use-case.ts`
- Modify: `viewpro-app/apps/api/src/analytics/analytics.repository.ts`
- Modify: `viewpro-app/apps/api/src/analytics/prisma-analytics.repository.ts`
- Test: `viewpro-app/apps/api/test/analytics.reports.spec.ts`

**Step 1: Write failing tests**

Cover:
- pilot summary computes active engagement update percentage
- inactive engagements excludes active engagements with recent movement events
- events list is tenant-scoped and paginated

**Step 2: Implement reports**

Default reporting window: current week for `pilot-summary`, 7 days for inactive engagements.

**Step 3: Run tests**

```bash
pnpm --filter @viewpro/api test
```

Expected: pass.

### Task 6: Add manager-only analytics endpoints

**Files:**
- Create: `viewpro-app/apps/api/src/analytics/analytics.controller.ts`
- Create: `viewpro-app/apps/api/src/analytics/dto/list-analytics-events.query.ts`
- Create: `viewpro-app/apps/api/src/analytics/dto/list-inactive-engagements.query.ts`
- Modify: `viewpro-app/apps/api/src/analytics/analytics.module.ts`
- Test: `viewpro-app/apps/api/test/analytics.e2e-spec.ts`

**Step 1: Write failing e2e tests**

Cover endpoints:
- `GET /api/analytics/pilot-summary`
- `GET /api/analytics/inactive-engagements`
- `GET /api/analytics/events`

Cover access:
- manager can access
- seller/agent cannot access aggregate reports
- cross-tenant data is not returned

**Step 2: Implement controller**

Use existing `AuthGuard`, `TenantMembershipGuard`, and permission patterns. Reports should require manager-level access.

**Step 3: Run tests**

```bash
pnpm --filter @viewpro/api test
```

Expected: pass.

### Task 7: Update docs and run full verification

**Files:**
- Modify: `README.md`
- Modify: `viewpro-app/README.md`
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`
- Modify: `docs/plans/2026-05-15-viewpro-stage-8-pilot-metrics-design.md`
- Modify: `docs/plans/2026-05-15-viewpro-stage-8-pilot-metrics-implementation.md`

**Step 1: Update docs**

Document:
- internal event log
- safe metadata rule
- emitted events
- report endpoints
- PostHog future adapter only

**Step 2: Run full verification**

```bash
pnpm db:migrate
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

Expected: all pass.

**Step 3: Commit checkpoint**

Only if the user explicitly authorizes it:

```bash
git add README.md viewpro-app/README.md docs/plans/2026-05-13-viewpro-implementation-roadmap.md docs/plans/2026-05-15-viewpro-stage-8-pilot-metrics-design.md docs/plans/2026-05-15-viewpro-stage-8-pilot-metrics-implementation.md viewpro-app/apps/api/src/analytics viewpro-app/apps/api/test/analytics.e2e-spec.ts viewpro-app/apps/api/test/analytics.reports.spec.ts
git commit -m "feat(api): expose pilot analytics reports"
```

## Review workload forecast

Estimated total changed lines for all slices: high, likely over 400 lines.

Recommended delivery:
- Keep Stage 8 split into the three slices above.
- Commit each slice separately after explicit user approval.
- Do not squash into one large commit before review.

## Done when

- Analytics events are persisted internally.
- Key pilot events are emitted by existing backend flows.
- Analytics failures do not break primary product behavior.
- Manager-only pilot reports are available.
- Full verification passes.
