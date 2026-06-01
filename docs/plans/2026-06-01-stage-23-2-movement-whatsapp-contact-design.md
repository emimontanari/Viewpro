# Stage 23.2 — Movement WhatsApp Contact Design

Stage 23.2 lets an owner ask about a specific movement/status update by contacting the internal user who created that movement. This preserves the operational flow: general property questions go to the inmobiliaria from Stage 23.1, while movement-specific questions go to the responsible user for that update.

## Decision

Add movement-level WhatsApp contact inside owner-visible timeline items.

| Topic | Decision |
|---|---|
| Contact target | `Movement.createdByUser.whatsappPhone` |
| UI copy | Always `Consultar responsable` |
| Fallback | No tenant fallback for movement-specific questions |
| Message content | Property + structured movement context; no free-text observation in this slice |
| Tracking | Reuse `WHATSAPP_CONTACT_CLICKED` with `context: "movement"` |

## Why this route

A movement is authored by the user who actually created it. Managers/admins and sellers create movements under their own identity; the app does not create a movement as another seller. Therefore `Movement.createdByUserId` is the most honest contact target for movement-specific questions.

Using the tenant number as fallback would recreate the forwarding problem Stage 23.2 is meant to remove, so this slice does not fallback to the tenant/inmobiliaria when the movement author has no WhatsApp configured.

## Backend behavior

Owner timeline responses already come from an owner-authorized path:

```txt
GET /api/owner/engagements/:engagementId/timeline
```

Stage 23.2 adds a contact capability to each owner-visible movement:

```ts
type OwnerMovementContact = {
  available: boolean;
  targetType: 'movement_author';
  displayLabel: 'Consultar responsable' | 'Contacto no configurado';
  whatsappPhone?: string;
};
```

The repository may select `createdBy.whatsappPhone`, but the response must not expose that phone under `createdBy`. The only phone exposure is the explicit `movement.contact` object, and only after owner access to the engagement has been verified.

## Tracking endpoint

Add a movement-specific endpoint instead of overloading the Stage 23.1 property endpoint:

```txt
POST /api/owner/engagements/:engagementId/movements/:movementId/whatsapp-contact-click
```

The backend must verify:

1. the owner has active access to the engagement's property;
2. the movement belongs to that engagement;
3. analytics failures do not break the request.

On success, return `204`.

Track the existing event:

```ts
AnalyticsEventName.WHATSAPP_CONTACT_CLICKED
```

Use safe metadata only:

```json
{
  "context": "movement",
  "targetType": "movement_author"
}
```

Use first-class analytics columns for IDs:

- `tenantId`
- `propertyEngagementId`
- `propertyAssetId`
- `movementId`
- `actorType: OWNER`
- `actorUserId`

Do not store phone, message text, author name/email, owner name, tenant name, or property address in metadata.

## Frontend behavior

In owner timeline movement cards, add a compact WhatsApp action:

- available: `Consultar responsable` opens WhatsApp;
- unavailable: `Contacto no configurado`, disabled/non-link state.

The WhatsApp URL must use:

```txt
https://wa.me/<digits>?text=<encodedMessage>
```

Use the same digit normalization approach as Stage 23.1.

### Message content

For user experience, include enough context that the responsible user understands the question immediately, without copying free-text observations into an external URL.

Recommended message:

```text
Hola, soy propietario de Av. Siempre Viva 123.
Quería consultar por este movimiento:

Tipo: Cambio de estado
Estado: En negociación
Fecha: 01/06/2026

Gracias.
```

Rules:

- Include only owner-visible structured fields.
- Include status when present.
- Include movement type and date.
- Do not include `observation` in this slice.
- Do not include internal IDs in the WhatsApp text.

## Security and privacy rules

- Do not expose arbitrary user phones.
- Do not add `whatsappPhone` under `createdBy`.
- Do not add movement contact to internal/dashboard APIs in this slice.
- Frontend visibility is UX only; backend validates owner access before tracking.
- No tenant fallback for unavailable movement-author WhatsApp.
- Analytics metadata remains PII-free.

## Out of scope

- Editing/configuring user WhatsApp phones in UI.
- Tenant fallback for movement questions.
- Contacting assigned agents who did not create the movement.
- Including free-text observation in WhatsApp message.
- WhatsApp Business API.
- Conversation history.

## Acceptance criteria

- Owner timeline movements whose author has `User.whatsappPhone` show `Consultar responsable`.
- The WhatsApp link routes to the movement author's phone.
- Movements whose author lacks a valid WhatsApp show `Contacto no configurado`.
- `createdBy.whatsappPhone` is not exposed directly.
- Click tracking records `WHATSAPP_CONTACT_CLICKED` with `context: "movement"`, safe metadata, and `movementId`.
- Non-owners cannot fetch movement contact data or track movement contact clicks.
- Stage 23.1 property contact behavior remains unchanged.
