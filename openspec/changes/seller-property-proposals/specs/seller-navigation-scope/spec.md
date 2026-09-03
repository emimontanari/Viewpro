# Delta for Seller Navigation Scope

## MODIFIED Requirements

### Requirement: Sidebar and KBar have complete rendered parity

PR1 MUST apply the same filtered navigation policy to Sidebar and KBar. Tests MUST exercise rendered consumer behavior for realistic resolved MANAGER, PRINCIPAL_MANAGER, and AGENT states plus loading. Proposal destinations MUST be included in the role-aware matrix without changing any existing destination.

#### Scenario: Parameterized exact rendered destinations

- GIVEN one test case from this matrix: resolved AGENT with seller proposal authority; resolved MANAGER with `engagements.view_all`, `team.view`, and proposal review authority; resolved PRINCIPAL_MANAGER with `engagements.view_all`, `team.view`, `tenant.manage_settings`, and proposal review authority; or retained MANAGER, PRINCIPAL_MANAGER, or AGENT membership while context is loading
- WHEN Sidebar and KBar render
- THEN each test case exposes exactly its title/routes: AGENT: `Inicio` (`/dashboard`), `Propiedades` (`/dashboard/product`), `Seguimiento` (`/dashboard/seguimiento`), `Perfil` (`/dashboard/profile`), and `Propuestas de propiedades` (`/dashboard/property-proposals`); MANAGER: `Inicio` (`/dashboard`), `Propiedades` (`/dashboard/product`), `Seguimiento` (`/dashboard/seguimiento`), `Perfil` (`/dashboard/profile`), `Solicitudes de estado` (`/dashboard/status-change-requests`), `Inmobiliarias` (`/dashboard/workspaces`), `Equipo` (`/dashboard/users`), and `Revisión de propuestas` (`/dashboard/property-proposals/review`); PRINCIPAL_MANAGER: `Inicio` (`/dashboard`), `Propiedades` (`/dashboard/product`), `Seguimiento` (`/dashboard/seguimiento`), `Perfil` (`/dashboard/profile`), `Solicitudes de estado` (`/dashboard/status-change-requests`), `Inmobiliarias` (`/dashboard/workspaces`), `Equipo` (`/dashboard/users`), `Revisión de propuestas` (`/dashboard/property-proposals/review`), and `Contacto WhatsApp` (`/dashboard/settings/tenant-contact`); any loading role: `Inicio` (`/dashboard`), `Propiedades` (`/dashboard/product`), `Seguimiento` (`/dashboard/seguimiento`), and `Perfil` (`/dashboard/profile`)
- AND loading cases expose no protected destination, including either proposal destination
- AND AGENT exposes no `Revisión de propuestas` or direct canonical property-create destination
- AND MANAGER and PRINCIPAL_MANAGER expose no seller proposal drafting destination
- AND MANAGER exposes no `Contacto WhatsApp`

## ADDED Requirements

### Requirement: Proposal destinations require role-specific authorization

The seller proposal destination MUST be available only to an authorized active same-tenant `AGENT`, and the proposal review destination MUST be available only to an authorized active same-tenant `MANAGER` or `PRINCIPAL_MANAGER`. Sidebar and KBar MUST render the same authorized proposal destination. Proposal authorization MUST remain separate from direct canonical property creation and MUST fail closed when membership, capability, or context resolution is absent.

#### Scenario: Seller proposal navigation is available only to an authorized seller

- GIVEN a resolved active same-tenant `AGENT` has seller proposal authority
- WHEN Sidebar and KBar render
- THEN both expose `Propuestas de propiedades` (`/dashboard/property-proposals`)
- AND neither exposes `Revisión de propuestas` or a direct canonical property-create destination

#### Scenario: Manager review navigation is available only to an authorized manager

- GIVEN a resolved active same-tenant `MANAGER` or `PRINCIPAL_MANAGER` has proposal review authority
- WHEN Sidebar and KBar render
- THEN both expose `Revisión de propuestas` (`/dashboard/property-proposals/review`)
- AND neither exposes the seller proposal drafting destination
- AND a manager without proposal review authority receives no proposal review destination

#### Scenario: Proposal navigation fails closed without resolved authorization

- GIVEN proposal capability is absent, membership is inactive or belongs to another tenant, or role and membership context is loading or unresolved
- WHEN Sidebar and KBar render
- THEN both omit `Propuestas de propiedades` (`/dashboard/property-proposals`) and `Revisión de propuestas` (`/dashboard/property-proposals/review`)
- AND baseline destinations remain unchanged
