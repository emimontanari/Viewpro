# Design: Property detail workspace

**Status: ACCEPTED UX; implementation not yet performed or verified.**

## Interaction

Keep the existing property header, list-return action, and permission-aware edit action. Add semantic same-page links for **Datos e imágenes**, **Personas**, **Actividad**, and **Documentos**, each targeting a stable ID on meaningful existing rendered content. Retain all sections visibly available at narrow and wide breakpoints; use ordinary keyboard-operable links with visible focus, not tabs or hidden panels.

The Datos e imágenes link must navigate to existing property-data/image content. Keep an explicit, permission-gated `/dashboard/product/{id}/edit` affordance as the way to edit; do not imply inline editing. The other links target existing owner/agent, activity/status/movement, and document areas. Preserve the existing fine-grained management, status-request, and document permission checks, seller viewing/actions, and archived-state behavior.

## Boundaries and validation intent

This is navigation-only: no new APIs, mutations, permissions, route migration, or restructuring that changes operations. Preserve `/edit`, list return, and edit cancel/save destinations. Behavior-first tests should prove links resolve to stable targets and cover roles/archive state before implementation; then exercise keyboard and viewport behavior. When a local fixture environment is available, browser-check desktop/mobile and existing edit, save, cancel, and return flows. Record checks that cannot run as unavailable, not passed.
