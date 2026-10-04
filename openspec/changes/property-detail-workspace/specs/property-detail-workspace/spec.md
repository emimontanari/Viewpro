# Property Detail Workspace Specification

## Purpose

Make existing property detail content easier to find without changing editing, authorization, or property operations.

## Requirements

### Requirement: Detail groups navigate to stable visible content
The detail page MUST provide same-page links named **Datos e imágenes**, **Personas**, **Actividad**, and **Documentos**. Each link MUST resolve to a stable valid target containing its corresponding existing data/images, owner/agent content, activity/status/movements, or document content/actions. Datos e imágenes MUST be a meaningful navigation destination, not decorative; editing remains available through the existing permission-gated `/dashboard/product/{id}/edit` affordance. All targeted content MUST remain visible in narrow and wide layouts, and links MUST be keyboard operable. No group may be a hidden tab.

#### Scenario: Each group reaches its existing content
- GIVEN a user views a property detail page
- WHEN the user activates any of the four group links
- THEN the browser navigates to a stable target containing that group's existing content, including property data/images for Datos e imágenes

#### Scenario: Navigation works across input and viewport modes
- GIVEN a user views detail at a narrow or wide viewport
- WHEN they navigate links using keyboard or pointer
- THEN each target remains visible and usable without hiding other groups

### Requirement: Existing route and edit-return contracts are preserved
The change MUST preserve the `/dashboard/product/{id}/edit` deep link, explicit return to the property list, and existing edit cancel/save returns to detail. Editing MUST continue through the existing editor; navigation MUST NOT imply inline editing.

#### Scenario: Existing edit flow remains available
- GIVEN a user with existing edit permission opens detail or its `/edit` deep link
- WHEN they cancel or save using the existing editor
- THEN the existing detail destination and explicit list-return behavior remain unchanged

### Requirement: Navigation adds no authority or operations
The change MUST NOT add APIs, mutations, or permissions. It MUST preserve existing owner/agent management gates, seller viewing and status-request affordances, and document actions and their existing permission checks. Backend authorization remains authoritative.

#### Scenario: Roles retain existing affordances
- GIVEN a manager or seller views a property
- WHEN the new navigation is present
- THEN owner/agent management remains gated as before, while seller viewing and permitted status-request/document actions remain unchanged

### Requirement: Archived-property behavior is unchanged
The detail navigation MUST preserve existing archive-state content and action behavior and MUST NOT introduce archived-property operations.

#### Scenario: Archived property remains governed by existing state behavior
- GIVEN a user views an archived property
- WHEN they use detail navigation
- THEN existing archive-specific affordances remain unchanged and no new action becomes available
