# Stage 11 Backup and Restore Design

Stage 11 Slice 5 documents a basic PostgreSQL backup and restore process for ViewPro before the pilot. This is intentionally documentation-first: production topology is not chosen yet, and scripts would create false confidence before the deployment provider is known.

## Decision

Add clear backup/restore instructions and verification checklists for PostgreSQL. Do not add automation scripts yet.

## Scope

### In scope

- Document local `pg_dump` backup using Docker Compose PostgreSQL.
- Document restore into an isolated disposable database.
- Document verification after restore.
- Document managed production PostgreSQL guidance without provider-specific assumptions.
- Document what is and is not covered today.
- Update Stage 11 roadmap status.

### Out of scope

- Shell scripts for production backup/restore.
- Provider-specific runbooks.
- Scheduled backups.
- Retention policy automation.
- Object storage backup for documents.
- Deploy/staging configuration.

## Current durable state

| Area | Backup status |
|------|---------------|
| PostgreSQL | Primary durable state. Must be backed up and restorable. |
| Prisma migrations | Committed in repo under `apps/api/prisma/migrations`. |
| Document metadata | Stored in PostgreSQL and covered by DB backup. |
| Document bytes | Not production-backed yet; current storage adapter is fake. Future S3/R2/MinIO needs separate backup policy. |
| Secrets/env vars | Not backed up by DB dump. Must live in deployment secret manager. |

## Local backup shape

Run from `viewpro-app/` with the local Docker Compose database running:

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U viewpro -d viewpro --format=custom --no-owner --no-acl > backups/viewpro-$(date +%Y%m%d-%H%M%S).dump
```

Use custom format so restore can run through `pg_restore`.

## Safe restore shape

Never restore over active development or production directly. Restore into a disposable DB first:

```bash
docker compose exec -T postgres createdb -U viewpro viewpro_restore_check
docker compose exec -T postgres pg_restore -U viewpro -d viewpro_restore_check --clean --if-exists --no-owner --no-acl < backups/<dump-file>.dump
```

Then verify counts and representative queries before considering a real restore.

## Verification checklist

- Backup file exists and is non-empty.
- `pg_restore --list` can read the dump.
- Restore into disposable DB completes.
- Core tables exist after restore:
  - users;
  - tenants;
  - tenant memberships;
  - property assets/engagements;
  - movements;
  - document requests/documents/versions;
  - analytics events.
- App can connect to the restored database when pointed at it.
- No restore was performed against the active DB by accident.

## Production guidance

For managed PostgreSQL, prefer provider-native automated backups/PITR when available. Manual dumps are a fallback or portability mechanism, not the only backup strategy.

Minimum production requirements before pilot:

- automated daily backups enabled;
- restore tested at least once into a non-production database;
- retention period known;
- backup location/provider known;
- restore owner documented;
- secrets stored outside database dumps.

## Acceptance criteria

- README contains copy-pastable local backup/restore commands.
- README explicitly says restore must target an isolated database first.
- README clarifies document bytes are not covered until real storage exists.
- Roadmap marks Slice 5 completed.
