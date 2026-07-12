# Stage 12 Slice 12.1 Implementation Plan

> **For agents:** Execute this plan task-by-task. Keep changes small, verify after each work unit, and do not commit unless the maintainer explicitly approves.

**Goal:** Rediseñar el workspace cliente de ViewPro para que parezca y funcione como un SaaS real para inmobiliarias.

**Architecture:** Este slice es frontend-first. Reutiliza sesión, selección de inmobiliaria y rutas existentes; cambia shell, dashboard/copy y cobertura smoke sin agregar nuevos endpoints.

**Tech Stack:** Next.js 16, React 19, TypeScript, Playwright, NestJS API existente.

---

## Guardrails

- No usar en UI cliente: `tenant`, `UUID`, `workspace`, `request`, `backend`, `contexto`, `x-tenant-id`.
- No modificar `/admin` salvo que una prueba demuestre una regresión accidental.
- No guardar nada nuevo en `localStorage`; sólo existe `selectedTenantId`.
- No commitear sin aprobación explícita.
- Restaurar cualquier ruido generado por Next antes de revisar diff.

## Review Workload Forecast

| Item | Forecast |
| --- | --- |
| Riesgo de presupuesto de 400 líneas | Bajo/medio |
| Chained PRs recomendado | No |
| Estrategia | Un commit/PR reviewable para Slice 12.1 |
| Motivo | Cambios concentrados en frontend shell, dashboard y tests de copy. |

## Task 1 — Proteger el lenguaje cliente con smoke coverage

**Files:**

- Modify or create: `viewpro-app/apps/web/tests/smoke/*.spec.ts`
- Reference: `viewpro-app/apps/web/src/components/layout/internal-shell.tsx`
- Reference: `viewpro-app/apps/web/src/app/(internal)/dashboard/page.tsx`

**Steps:**

1. Buscar el smoke test más cercano para rutas internas autenticadas o crear uno focalizado si no existe cobertura adecuada.
2. Agregar assertions para que `/dashboard` no muestre copy técnico prohibido cuando se renderiza el estado alcanzable por el test.
3. Cubrir términos visibles de alto riesgo: `Tenant`, `Workspace interno`, `requests`, `contexto de tenant`.
4. Ejecutar desde `viewpro-app`:

   ```bash
   pnpm --filter @viewpro/web test:smoke
   ```

5. Expected before implementation: the new/updated test should fail if it hits the current dashboard copy.

## Task 2 — Rediseñar `InternalShell` como shell SaaS

**Files:**

- Modify: `viewpro-app/apps/web/src/components/layout/internal-shell.tsx`
- Modify if needed: shared CSS/global styles used by `.internal-shell*`

**Steps:**

1. Cambiar el aria-label a navegación de la inmobiliaria.
2. Cambiar enlaces visibles a:
   - Inicio
   - Gestiones
   - Propiedades
   - Propietarios
   - Documentos
   - Equipo
   - Métricas
   - Configuración
3. Mantener enlaces hacia rutas existentes cuando existan.
4. Para secciones aún sin ruta real, usar estado seguro: enlace a `/dashboard` con copy de “Próximo paso” o crear rutas placeholder sólo si reduce confusión sin inflar el slice.
5. Reemplazar badge `Workspace interno` por `Panel de inmobiliaria` o equivalente.
6. Mantener `selectedTenantName` como prop interna, pero mostrarlo como nombre de inmobiliaria.

## Task 3 — Convertir `/dashboard` en Inicio operativo

**Files:**

- Modify: `viewpro-app/apps/web/src/app/(internal)/dashboard/page.tsx`

**Steps:**

1. Cambiar título visible a `Inicio` o `Panel de la inmobiliaria`.
2. Reescribir estado loading: “Preparando el panel de tu inmobiliaria…”.
3. Reescribir estado sin selección:
   - CTA: “Elegir inmobiliaria”
   - title: “Elegí una inmobiliaria para continuar”
   - description sin mencionar localStorage, cookies, backend ni tenant.
4. Reescribir estado de membresía inválida sin término técnico.
5. Para membresía válida, renderizar bloques:
   - prioridades de hoy
   - gestiones activas
   - documentos
   - propietarios
   - equipo
   - métricas
   - accesos rápidos
6. Usar datos reales disponibles de sesión donde existan; no inventar métricas productivas.
7. Si faltan datos, usar estados honestos orientados a negocio.

## Task 4 — Ajustar copy cliente cercano al shell

**Files:**

- Modify: `viewpro-app/apps/web/src/app/(internal)/select-tenant/page.tsx`
- Modify if needed: nearby internal pages/components that visibly say tenant/UUID/request.

**Steps:**

1. Reemplazar copy de selección de tenant por selección de inmobiliaria.
2. Mantener nombres técnicos en código si son tipos o contratos (`TenantMembership`, `selectedTenantId`), pero nunca como texto visible.
3. Reducir fricción de `UUID` en copy visible. Si el campo sigue necesitando un identificador técnico, explicarlo como limitación temporal con lenguaje de producto.
4. No tocar lógica de auth ni persistencia.

## Task 5 — Verificación local

**Files:**

- Review all changed frontend files.

**Steps:**

1. Ejecutar desde `viewpro-app`:

   ```bash
   pnpm --filter @viewpro/web typecheck
   pnpm --filter @viewpro/web test:smoke
   ```

2. Revisar que no haya ruido generado:

   ```bash
   git status --short
   ```

3. Si Next vuelve a modificar `next-env.d.ts` sin intención, restaurarlo antes de pedir review.

## Task 6 — Fresh review antes de commit

**Files:**

- Full diff for Slice 12.1.

**Steps:**

1. Ejecutar una revisión fresca del diff enfocada en:
   - términos técnicos prohibidos en UI cliente
   - rutas rotas
   - separación `/admin` vs workspace cliente
   - no persistencia nueva en `localStorage`
   - accesibilidad básica de navegación
2. Corregir hallazgos confirmados.
3. Pedir aprobación explícita antes de commit.

## Suggested Commit

Sólo después de aprobación explícita:

```bash
git add docs/plans/2026-05-19-stage-12-saas-workspace-design.md \
  docs/plans/2026-05-19-stage-12-slice-12-1-implementation-plan.md \
  viewpro-app/apps/web/src/components/layout/internal-shell.tsx \
  viewpro-app/apps/web/src/app/(internal)/dashboard/page.tsx \
  viewpro-app/apps/web/src/app/(internal)/select-tenant/page.tsx \
  viewpro-app/apps/web/tests/smoke
git commit -m "feat(web): redesign inmobiliaria workspace"
```
