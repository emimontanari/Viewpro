# Arquitectura de Repositorio ViewPro MVP

ViewPro usará un **monorepo con frontend y backend separados**. Esta decisión prioriza velocidad de desarrollo para un solo desarrollador, sin sacrificar límites técnicos ni capacidad futura de separar aplicaciones si el equipo crece.

## Decisión

```txt
viewpro/
  viewpro-app/
    apps/
      web/   → Next.js
      api/   → NestJS

    packages/
      contracts/  → tipos/contrato OpenAPI compartido
      config/     → configuración compartida futura

  docs/
    plans/
    diagrams/
```

Regla central:

> Un solo repo no significa una sola aplicación. `web` y `api` serán aplicaciones independientes, con deploys independientes y responsabilidades separadas.

## Por qué monorepo

El desarrollador inicial será una sola persona. En ese contexto, separar repos desde el día uno agregaría coordinación sin aportar escalabilidad real.

El monorepo ayuda a:

- trabajar frontend/backend en una misma unidad de producto
- versionar juntos decisiones de API y UI
- mantener documentación y arquitectura cerca del código
- generar cliente OpenAPI sin publicar paquetes externos
- simplificar CI/CD inicial
- reducir fricción para cambios completos de punta a punta

La deuda técnica no se evita por tener más repos. Se evita con límites claros.

## Qué NO significa monorepo

Monorepo no significa:

- mezclar lógica de frontend y backend
- importar código de NestJS desde Next.js
- compartir modelos internos de base de datos con la UI
- deployar frontend y backend como una sola unidad obligatoria
- convertir todo en una aplicación gigante

Antipatrón:

```txt
apps/web importa services internos de apps/api
```

Correcto:

```txt
apps/web → usa cliente generado desde OpenAPI → apps/api
```

## Límites técnicos

### `apps/web`

Responsable de:

- Next.js App Router
- rutas y layouts por zona
- experiencia de usuario
- formularios
- TanStack Query
- cliente API generado
- Sentry frontend

No debe contener:

- reglas de negocio autoritativas
- acceso directo a base de datos
- secretos backend
- validaciones de permisos como fuente de verdad

### `apps/api`

Responsable de:

- NestJS
- auth
- permisos
- tenant context
- use cases
- repositories
- Prisma
- OpenAPI/Swagger
- jobs/eventos
- Sentry backend

No debe depender de componentes o código de UI.

### `packages/contracts`

Responsable de:

- tipos generados desde OpenAPI
- helpers mínimos del contrato si hacen falta
- compatibilidad entre frontend y backend

No debe contener:

- lógica de dominio
- queries de base de datos
- componentes React
- dependencias pesadas de frontend o backend

### `packages/config`

Futuro paquete para configuración compartida:

- TypeScript config
- ESLint config
- Prettier config si aplica

Debe mantenerse simple. Si una configuración compartida empieza a complicar más de lo que ayuda, se evita.

## Deploy independiente

Aunque vivan en el mismo repo, cada app debe poder desplegarse por separado.

```txt
apps/web → Vercel
apps/api → Railway / Render / Fly.io / otro runtime Node
```

Reglas:

- un cambio en docs no debería redeployar producción
- un cambio sólo en `apps/web` no debería obligar deploy de `apps/api`
- un cambio sólo en `apps/api` no debería obligar deploy de `apps/web`
- los contratos deben versionarse en el repo y validarse en CI

## Contrato API

El contrato entre frontend y backend será REST + OpenAPI.

Flujo esperado:

```txt
NestJS genera OpenAPI
→ se genera cliente/tipos TypeScript
→ apps/web consume el cliente
→ CI valida que contrato y cliente estén sincronizados
```

Esto permite que el monorepo siga teniendo una frontera clara.

Si en el futuro `web` y `api` se separan en repos distintos, el contrato OpenAPI sigue siendo el puente.

## CI/CD inicial

La automatización debe acompañar los límites.

MVP:

```txt
docs changed      → revisar markdown, sin build pesado
apps/web changed  → lint/typecheck/build web
apps/api changed  → lint/typecheck/test api
contract changed  → validar cliente generado
```

No hace falta construir una plataforma CI compleja al inicio. Sí hace falta que los scripts estén separados por app.

## Escalabilidad futura

Esta estructura deja abierta la posibilidad de separar repos más adelante.

Señales reales para separar:

- aparece un equipo frontend y un equipo backend independientes
- los ciclos de release se vuelven muy distintos
- hay permisos/ownership de código separados
- CI del monorepo se vuelve lenta o compleja incluso con filtros
- integraciones externas necesitan consumir contratos publicados formalmente

Mientras eso no ocurra, repos separados serían una carga operativa prematura.

## Regla de separación futura

Desde el día uno, escribir el código como si `web` y `api` pudieran vivir separados mañana.

Checklist:

- [ ] `apps/web` sólo habla con `apps/api` por HTTP/cliente API.
- [ ] `apps/web` no importa Prisma ni entidades internas del backend.
- [ ] `apps/api` no importa componentes ni utilidades de UI.
- [ ] `packages/contracts` no contiene lógica de negocio.
- [ ] cada app tiene sus propios scripts de build/test.
- [ ] cada app puede tener variables de entorno separadas.
- [ ] cada app puede desplegarse sin arrastrar a la otra.

## Decisión final

Para ViewPro MVP:

```txt
Monorepo sí.
Frontend/backend mezclados no.
Deploys independientes sí.
Contrato OpenAPI como frontera sí.
Preparado para separar repos en el futuro sí.
```

Esta decisión reduce fricción ahora y evita deuda técnica porque la separación se diseña en los límites, no en la cantidad de repos.

## Próximo paso

Después de validar la arquitectura de repositorio:

1. Definir bootstrap técnico inicial.
2. Elegir package manager y tooling del monorepo.
3. Definir scripts mínimos por app.
4. Crear roadmap de implementación por etapas.
