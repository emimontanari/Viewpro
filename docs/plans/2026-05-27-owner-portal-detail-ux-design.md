# Owner Portal Detail UX Design

## Context

The first owner portal slice lets an owner sign in, see linked properties, and read follow-up activity. The next refinement makes the owner-facing property detail feel like a real client portal: the owner should see the property as loaded in ViewPro and understand the current commercial state at a glance.

## Goal

Improve `/owner/properties/[propertyId]` so a property owner can:

- see a read-only property summary with images and ficha técnica;
- see the linked inmobiliaria context;
- switch between `Resumen` and `Seguimiento` tabs;
- understand the current engagement status through a line-and-dot path;
- still read the movement history below the state path.

## Non-goals

This slice does not include:

- editing property data;
- owner document upload;
- document request UI;
- owner invitations/activation;
- WhatsApp tracking;
- adding a public description field to the schema;
- exposing internal manager/seller controls.

The current data model does not have a `description` field for properties, so this design displays the property data already loaded in the system: images, location, type, price, operation, status, and physical facts.

## Data Contract

Current owner property responses only expose minimal fields. To render the property detail safely, expand the owner property response with owner-safe fields from `PropertyAsset`:

```ts
{
  id,
  title,
  addressLine,
  city,
  province,
  propertyType,
  totalAreaSqm,
  coveredAreaSqm,
  rooms,
  bedrooms,
  bathrooms,
  garages,
  ageYears,
  orientation,
  images,
  primaryImage,
  createdAt,
  updatedAt
}
```

Image fields should follow the existing internal property image shape where possible:

```ts
{
  id,
  storageKey,
  filename,
  mimeType,
  sizeBytes,
  sortOrder,
  isPrimary,
  createdAt
}
```

Do not expose owner private/internal fields beyond what the owner already sees or what describes their own property.

## Owner Detail UX

`/owner/properties/[propertyId]` should render:

1. A hero/header with title, location, property type, current status, and inmobiliaria.
2. Tabs:
   - `Resumen`
   - `Seguimiento`
3. `Resumen` tab:
   - primary property image or placeholder;
   - thumbnail strip if multiple images exist;
   - price and operation from the current engagement;
   - ficha técnica grid with known values only;
   - assigned agency/team summary.
4. `Seguimiento` tab:
   - state path / stepper showing all known engagement states;
   - current state highlighted;
   - completed states marked before the current state;
   - future states muted;
   - movement history below the path.

## Status Path

Use the existing product status ordering/labels from app-new product constants when possible. The path should show all major states:

```txt
Captación
Preparando publicación
Publicación activa
Consultas y visitas
Negociación
Reserva iniciada
Documentación pendiente
Documentación final
Cerrada
```

If an engagement has an exceptional state such as `CANCELLED`, show it as a terminal/current state with a clear visual tone.

The path communicates the overall engagement stage. Movements remain the historical activity log.

## Read-only Rules

The owner detail must not render:

- `Nueva propiedad`;
- `Editar`;
- status mutation controls;
- assign/remove agent controls;
- owner linking controls;
- document upload/review actions.

All access enforcement remains backend-owned through `/api/owner/*` active owner access checks.

## Testing

Add or update tests to cover:

- owner property response includes images/facts only for owner-accessible properties;
- owner detail renders image/facts/status path;
- tabs render `Resumen` and `Seguimiento`;
- current status is highlighted;
- no internal actions are visible;
- seeded smoke sees the linked agency, property detail, and status path.

## Review Risk

This touches both API response mapping and owner UI. Keep the change scoped to owner-safe read-only data and owner detail presentation. Defer description/schema and document workflows.
