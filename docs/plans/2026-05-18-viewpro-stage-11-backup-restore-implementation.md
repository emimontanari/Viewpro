# Stage 11 Backup and Restore Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Document a safe, basic PostgreSQL backup/restore workflow for ViewPro before the pilot.

**Architecture:** Add a documentation-only runbook to the technical README and roadmap. Keep automation out of this slice because production provider and storage topology are not chosen yet.

**Tech Stack:** PostgreSQL 16 Docker Compose, Prisma migrations, pnpm/Turbo monorepo docs.

---

## Constraints

- Documentation-only unless a broken command is discovered.
- Do not add backup scripts yet.
- Do not include real credentials, DSNs, production hosts, or secret values.
- Restore instructions must never target active dev/prod directly.
- Mention object/document storage backup as future once real storage exists.
- Do not commit unless the user explicitly approves.

## Task 1: Add backup/restore runbook to README

**Files:**
- Modify: `viewpro-app/README.md`

**Step 1: Add section after “Base de datos local”**

Add:

```markdown
## Backup and restore básico

El estado durable actual de ViewPro vive en PostgreSQL. Las migraciones Prisma están versionadas en el repo; los dumps respaldan datos, no secretos ni variables de entorno.

### Backup local

Desde `viewpro-app/`:

```bash
pnpm db:up
mkdir -p backups
docker compose exec -T postgres pg_dump -U viewpro -d viewpro --format=custom --no-owner --no-acl > backups/viewpro-$(date +%Y%m%d-%H%M%S).dump
```

### Verificar que el dump se puede leer

```bash
docker compose exec -T postgres pg_restore --list < backups/<dump-file>.dump
```

### Restore seguro en base aislada

Nunca restaures primero sobre la base activa. Usá una base descartable:

```bash
docker compose exec -T postgres dropdb -U viewpro --if-exists viewpro_restore_check
docker compose exec -T postgres createdb -U viewpro viewpro_restore_check
docker compose exec -T postgres pg_restore -U viewpro -d viewpro_restore_check --clean --if-exists --no-owner --no-acl < backups/<dump-file>.dump
```

### Checklist post-restore

- El comando de restore termina sin errores.
- Existen tablas core: `users`, `tenants`, `tenant_memberships`, `property_engagements`, `movements`, `document_requests`, `analytics_events`.
- Las migraciones del repo siguen siendo la fuente de verdad del schema.
- No se restauró sobre una base activa por accidente.

### Producción

En producción, preferir backups automáticos/PITR del proveedor PostgreSQL. Este runbook manual sirve como mecanismo de verificación/portabilidad, no reemplaza backups gestionados.

Antes del piloto real tiene que estar definido:

- proveedor de PostgreSQL;
- retención de backups;
- restore probado en una base no productiva;
- dueño del procedimiento de restore;
- dónde viven los secretos fuera del dump.

### Document storage

Stage 7 usa un adapter fake de storage. La metadata documental vive en PostgreSQL y queda cubierta por el dump; los bytes de documentos necesitarán backup separado cuando exista S3/R2/MinIO u otro storage real.
```

**Step 2: Check markdown formatting**

Run:

```bash
git diff --check
```

Expected: PASS.

## Task 2: Update Stage 11 roadmap

**Files:**
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`

**Step 1: Add Slice 5 status**

Under Stage 11 status, add:

```markdown
- Slice 5 implementado: runbook básico de backup/restore PostgreSQL con restore aislado, checklist de verificación y nota de storage documental futuro.
```

**Step 2: Check diff**

Run:

```bash
git diff -- docs/plans/2026-05-13-viewpro-implementation-roadmap.md viewpro-app/README.md
```

Expected: Roadmap and README docs only.

## Task 3: Verification

**Step 1: Run markdown/diff checks**

```bash
git diff --check
```

Expected: PASS.

**Step 2: Optionally verify local commands are syntactically aligned with Docker Compose service**

Read `viewpro-app/docker-compose.yml` and confirm service is `postgres`, user/db are `viewpro`.

Do not run destructive restore commands unless explicitly requested.

## Commit boundary

Only if the user explicitly authorizes it:

```bash
git add docs/plans/2026-05-13-viewpro-implementation-roadmap.md \
  docs/plans/2026-05-18-viewpro-stage-11-backup-restore-design.md \
  docs/plans/2026-05-18-viewpro-stage-11-backup-restore-implementation.md \
  viewpro-app/README.md
git commit -m "docs: add backup restore runbook"
```

Do not push unless the user explicitly approves after commit.
