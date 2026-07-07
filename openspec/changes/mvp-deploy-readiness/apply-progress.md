# Apply Progress — InmoView MVP Deploy Readiness

## Status

PR 1, PR 2, and PR 3 local apply complete. Deployed smoke and actual guarded demo seed remain pending until dedicated demo infrastructure exists.

## Scope Applied

- Added API Docker build/start path for Railway.
- Added demo environment checklist.
- Added deploy runbook.
- Added manual demo checklist.
- Marked PR 1 tasks complete in `tasks.md`.

## Changed Files

- `viewpro-app/apps/api/Dockerfile`
- `openspec/changes/mvp-deploy-readiness/env-checklist.md`
- `openspec/changes/mvp-deploy-readiness/deploy-runbook.md`
- `openspec/changes/mvp-deploy-readiness/demo-checklist.md`
- `openspec/changes/mvp-deploy-readiness/tasks.md`
- `openspec/changes/mvp-deploy-readiness/apply-progress.md`

## Validation Evidence

```bash
git diff --check
cd viewpro-app && pnpm --filter @viewpro/api db:validate
cd viewpro-app && pnpm --filter @viewpro/api build
```

Results:

- `git diff --check` passed.
- `pnpm --filter @viewpro/api db:validate` passed; Prisma schema is valid.
- `pnpm --filter @viewpro/api build` passed; Nest API builds.

Additional Docker static-check attempt:

```bash
cd viewpro-app && docker buildx build --check -f apps/api/Dockerfile .
```

Result: not supported by the installed Docker buildx (`unknown flag: --check`). Full Docker build was not run to avoid sending the whole monorepo context without a PR-approved `.dockerignore`.

## Scope Guard

No PR 2 or PR 3 implementation was performed:

- No property image storage refactor.
- No seed guardrail code changes.
- No env example changes.
- No secrets, `.env` files, database dumps, uploads, or credentials.
- No commits.

## Parent Follow-up

After PR 1 apply, the parent corrected the deploy migration command in `deploy-runbook.md` and `design.md` from the local-development `db:migrate` script (`prisma migrate dev`) to an explicit deploy-style command:

```bash
pnpm --filter @viewpro/api exec prisma migrate deploy --schema prisma/schema.prisma
```

Reason: the public demo database must apply committed migrations only; it must not use `prisma migrate dev`.

Additional validation:

```bash
git add -N openspec/changes/mvp-deploy-readiness viewpro-app/apps/api/Dockerfile
git diff --check
grep -RInE "(password|secret|token|key|dsn|DATABASE_URL)=[^<[:space:]]+|sk-[A-Za-z0-9]|BEGIN (RSA|OPENSSH|PRIVATE) KEY" openspec/changes/mvp-deploy-readiness viewpro-app/apps/api/Dockerfile || true
```

Results:

- `git diff --check` passed for the untracked PR 1 files after `git add -N`.
- Secret-pattern grep returned no matches.
- Fresh review subagents could not complete because their sessions lacked filesystem tools; parent performed inline risk/resilience review and recorded this tooling limitation.

## PR 2 Apply — Property Image Object Storage

### Scope Applied

- Added `PROPERTY_IMAGES_STORAGE_PORT` and `PropertyImagesStoragePort`.
- Preserved local filesystem property image storage for local development/test.
- Added S3/R2 property image storage with `PutObjectCommand` and `DeleteObjectCommand`.
- Added `PROPERTY_IMAGES_STORAGE_DRIVER` resolution, requiring `s3` in production/demo mode.
- Added S3/R2 env parsing for property images without logging or committing secret values.
- Updated `PropertyEngagementsModule` to select local or S3 storage by driver.
- Updated upload/delete image use cases to inject the storage port instead of the local adapter directly.
- Updated `next.config.ts` to allow property image public hosts from runtime/build env.
- Added focused unit tests for driver resolution, S3 config, storage-key safety, local persistence, S3 upload URL persistence, and S3 delete behavior.
- Marked implemented PR 2 tasks complete in `tasks.md`; kept DB-backed upload/delete/render proof unchecked because local Postgres was unavailable for the focused e2e.

### Changed Files

- `viewpro-app/apps/api/src/property-engagements/property-images.storage.ts`
- `viewpro-app/apps/api/src/property-engagements/property-images.storage.spec.ts`
- `viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts`
- `viewpro-app/apps/api/src/property-engagements/use-cases/upload-property-image.use-case.ts`
- `viewpro-app/apps/api/src/property-engagements/use-cases/delete-property-image.use-case.ts`
- `viewpro-app/apps/app-new/next.config.ts`
- `openspec/changes/mvp-deploy-readiness/tasks.md`
- `openspec/changes/mvp-deploy-readiness/apply-progress.md`

### Validation Evidence

```bash
cd viewpro-app && pnpm --filter @viewpro/api exec vitest run src/property-engagements/property-images.storage.spec.ts
cd viewpro-app && pnpm --filter @viewpro/api exec vitest run test/property-engagements.use-cases.spec.ts
cd viewpro-app && pnpm --filter @viewpro/api typecheck
cd viewpro-app && pnpm --filter @viewpro/api build
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter lint:strict
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter build
```

Results:

- Property image storage unit tests passed: 1 file, 7 tests.
- Property engagement use-case tests passed: 1 file, 37 tests.
- API typecheck passed.
- API build passed.
- Frontend strict lint passed.
- Frontend production build passed.

Focused e2e attempt:

```bash
cd viewpro-app && pnpm --filter @viewpro/api exec vitest run test/property-engagement-images.e2e-spec.ts
```

Result: failed because the local Postgres test DB was not reachable at `localhost:5432`; no PR 2 assertion failure was observed before DB setup failed.

Broad accidental API test attempt:

```bash
cd viewpro-app && pnpm --filter @viewpro/api test -- src/property-engagements/property-images.storage.spec.ts
```

Result: failed because the package script ignored the file argument and ran the full suite; e2e tests failed on missing local Postgres. A legacy unit fixture initially exposed that storage-key validation was too strict for existing non-prefixed fixture keys, so validation was narrowed to path traversal/backslash/null/absolute-path safety while new saves still generate the `property-images/...` prefix.

### PR 2 Scope Guard

- No demo seed guardrails were implemented.
- No deployed environment wiring was performed.
- No secrets, `.env` files, database dumps, uploads, or credentials were added.
- No commits.

## PR 2 Review Follow-up

Fresh-context review verdict: PASS with WARNING findings.

Actions taken after review:

- Required `PROPERTY_IMAGES_PUBLIC_BASE_URL` to be a valid HTTPS URL before S3/R2 property image URLs are generated.
- Updated the frontend image remote-pattern helper to reject non-local `http://` image hosts; only `https://` or local development hosts are allowlisted.
- Reopened the PR 2 DB-backed upload/delete/render proof checkbox because the focused e2e was blocked by missing local Postgres.

Follow-up validation:

```bash
cd viewpro-app && pnpm --filter @viewpro/api exec vitest run src/property-engagements/property-images.storage.spec.ts
cd viewpro-app && pnpm --filter @viewpro/api typecheck
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter lint:strict
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter build
```

Results:

- Property image storage unit tests passed: 1 file, 7 tests.
- API typecheck passed.
- Frontend strict lint passed.
- Frontend production build passed.

Accepted residual warning:

- Property image delete can orphan a public object if DB deletion succeeds and S3/R2 deletion fails afterward. For this PR, the orphan cleanup stance remains a documented residual risk for demo buckets. A retry/outbox cleanup is larger than this slice and can be added later if needed.

## Final PR 1/PR 2 Cleanup

Parent follow-up before moving to PR 3:

- Added `.pi-subagents/` to `.gitignore` so local agent artifacts are not committed.
- Updated PR 1 checklist/runbook wording that still described PR 2 property image object storage as future work.
- Reconfirmed there is no cloud infrastructure yet; deployed smoke remains future evidence after Railway/Vercel/R2/Sentry wiring.

Validation:

```bash
git diff --check
cd viewpro-app && pnpm --filter @viewpro/api exec vitest run src/property-engagements/property-images.storage.spec.ts
cd viewpro-app && pnpm --filter @viewpro/api exec vitest run test/property-engagements.use-cases.spec.ts
cd viewpro-app && pnpm --filter @viewpro/api typecheck
cd viewpro-app && pnpm --filter @viewpro/api build
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter lint:strict
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter build
```

Results:

- Whitespace diff check passed.
- Property image storage unit tests passed: 1 file, 7 tests.
- Property engagement use-case tests passed: 1 file, 37 tests.
- API typecheck passed.
- API build passed.
- Frontend strict lint passed.
- Frontend production build passed.
- Lens diagnostics reported no blocking errors for edited files; markdown warnings remain style-only on planning artifacts.

## PR 3 Apply — Guarded Demo Reset and Deploy Verification Evidence

### Scope Applied

- Added a pure `seed-demo-safety.mjs` guard helper and focused Vitest coverage.
- Updated `seed-demo.mjs` so local/dev/test seed remains usable only for clearly local/dev/test database URLs.
- Added guarded public demo reset requirements before Prisma client creation or tenant reset:
  - `INMOVIEW_ENVIRONMENT=demo`
  - `INMOVIEW_DEMO_SEED_ALLOWED=true`
  - `INMOVIEW_DEMO_DATABASE_IDENTIFIER` contained in `DATABASE_URL`
- Required `PROPERTY_IMAGES_STORAGE_DRIVER=s3` and S3/R2 property image seed config in guarded demo mode.
- Updated seeded property image creation to write fixture bytes to S3/R2 in demo mode and to local filesystem only outside S3 mode.
- Updated demo image reset cleanup to delete existing seeded S3/R2 property-image objects before DB row deletion when S3 mode is configured.
- Documented stable demo accounts, guarded reset command shape, local/dev/test behavior, and backup/restore/rollback evidence template.
- Marked PR 3 code/docs/local-validation tasks complete in `tasks.md`; deployed smoke remains unchecked until cloud infrastructure exists.

### Changed Files

- `viewpro-app/apps/api/scripts/seed-demo.mjs`
- `viewpro-app/apps/api/scripts/seed-demo-safety.mjs`
- `viewpro-app/apps/api/test/seed-demo-safety.spec.ts`
- `openspec/changes/mvp-deploy-readiness/env-checklist.md`
- `openspec/changes/mvp-deploy-readiness/deploy-runbook.md`
- `openspec/changes/mvp-deploy-readiness/demo-checklist.md`
- `openspec/changes/mvp-deploy-readiness/tasks.md`
- `openspec/changes/mvp-deploy-readiness/apply-progress.md`
- `.gitignore`

### Validation Evidence

```bash
cd viewpro-app/apps/api && node --check scripts/seed-demo.mjs
cd viewpro-app/apps/api && node --check scripts/seed-demo-safety.mjs
cd viewpro-app/apps/api && pnpm exec vitest run test/seed-demo-safety.spec.ts
git diff --check
cd viewpro-app && pnpm --filter @viewpro/api exec vitest run test/seed-demo-safety.spec.ts
cd viewpro-app && pnpm --filter @viewpro/api exec vitest run src/property-engagements/property-images.storage.spec.ts
cd viewpro-app && pnpm --filter @viewpro/api db:validate
cd viewpro-app && pnpm --filter @viewpro/api typecheck
cd viewpro-app && pnpm --filter @viewpro/api build
cd viewpro-app && pnpm openapi:check
```

Results:

- Seed script syntax check passed.
- Seed safety helper syntax check passed.
- Seed safety tests passed: 1 file, 6 tests.
- Whitespace diff check passed.
- Property image storage unit tests passed: 1 file, 7 tests.
- Prisma schema validation passed.
- API typecheck passed.
- API build passed.
- OpenAPI check command passed with existing package message: `OpenAPI contract check not configured yet`.

Parent validation repeated the same non-destructive checks after the worker returned:

```bash
cd viewpro-app/apps/api && node --check scripts/seed-demo.mjs
cd viewpro-app/apps/api && node --check scripts/seed-demo-safety.mjs
cd viewpro-app/apps/api && pnpm exec vitest run test/seed-demo-safety.spec.ts
cd viewpro-app && pnpm --filter @viewpro/api exec vitest run src/property-engagements/property-images.storage.spec.ts
cd viewpro-app && pnpm --filter @viewpro/api db:validate
cd viewpro-app && pnpm --filter @viewpro/api typecheck
cd viewpro-app && pnpm --filter @viewpro/api build
cd viewpro-app && pnpm openapi:check
git diff --check
```

Parent results matched the worker evidence: all commands passed. `pnpm openapi:check`
still reports the existing placeholder message `OpenAPI contract check not configured yet`.

### PR 3 Scope Guard

- Did not run `pnpm demo:seed` or any destructive DB command.
- Did not touch Railway, Vercel, R2/S3, Sentry, DNS, or cloud dashboards.
- Did not add secrets, `.env` files, DB dumps, uploads, or credentials.
- Did not implement ViewPro platform Phase 4, billing, realtime/push, WhatsApp Business API, or transactional email.
- Did not run deployed smoke checks because no cloud infrastructure exists yet.

## Residual Risks

- Demo seed/reset has not been run against a real Railway demo DB; verify only after the dedicated demo DB and secret-store variables exist.
- Deployed smoke checks remain blocked until Railway/Vercel/R2/Sentry/domain wiring exists.
- Dockerfile has not been fully built in Docker locally; validate in Railway or with an approved `.dockerignore`/build context check.
- Railway settings are documented but not applied in external dashboards during this PR.
- R2/S3, Sentry, and domain credentials/values must be configured outside the repository.
- Frontend deployments that render R2 property image URLs must set `NEXT_PUBLIC_PROPERTY_IMAGES_PUBLIC_BASE_URL` or `PROPERTY_IMAGES_PUBLIC_BASE_URL` at build time so Next can allowlist the image host.
- The focused property image e2e suite could not run because local Postgres was unavailable; DB-backed upload/delete/render proof remains unchecked.
- Public property image object cleanup is not retried if S3/R2 delete fails after DB deletion; demo bucket cleanup/monitoring remains operational follow-up.
- Markdown diagnostics report style warnings mostly from long lines in planning artifacts; no blocking code errors were reported.
