# Stage 23 — WhatsApp Contact Design

Stage 23 makes owner-to-agency communication real without introducing WhatsApp Business API automation. The design uses two contact contexts: general property questions go to the inmobiliaria, while movement-specific questions go to the user who created that movement.

## Decision

Implement communication in two reviewable slices.

| Slice | Outcome | Target |
|---|---|---|
| 23.1 Property contact | Owner can contact the inmobiliaria from a property context. | `Tenant.whatsappPhone` |
| 23.2 Movement contact | Owner can ask about a specific movement/status update. | `Movement.createdByUser.whatsappPhone` |

Configuration UI is out of scope for Stage 23.1. Phone values are added as database fields and can be configured by seed/manual DB updates until an admin/settings slice exists.

## Why two contexts

A property-level contact button is useful for general questions, but it is wrong for movement-specific questions. If a property owner asks about a status update, routing the message to a central tenant number creates manual forwarding work and loses flow. The movement already records `createdByUserId`, so Stage 23.2 can route that question to the internal user who actually created the movement.

Managers/admins and sellers create movements under their own user identity. The product should not let an inmobiliaria create movements "as" another seller. Therefore, `Movement.createdByUserId` is an honest routing source for movement-specific contact.

## Stage 23.1 — Property-level WhatsApp contact

### User outcome

From the owner portal property card, the owner can click **Contactar inmobiliaria** to open WhatsApp with a prefilled property-context message.

### Data model

Add a nullable tenant-level WhatsApp field:

| Model | Field | Notes |
|---|---|---|
| `Tenant` | `whatsappPhone String?` | Stored as a normalized E.164-ish value such as `+549...`. |

No settings UI is included in this slice.

### Backend/API behavior

The owner portal already fetches properties only for active owner access. Reuse that boundary and expose a safe contact capability in the owner property response.

Recommended response shape:

```ts
type OwnerPropertyContact = {
  available: boolean;
  targetType: 'tenant';
  displayLabel: string;
  whatsappPhone?: string;
};
```

If the tenant phone is missing, return `available: false` and do not include a phone.

### Frontend behavior

Replace the current `mailto:` CTA in `owner-home.tsx` with a WhatsApp CTA.

- Button label: `Contactar inmobiliaria`.
- Missing contact copy: `Contacto no configurado`.
- URL format: `https://wa.me/<digits>?text=<encodedMessage>`.
- Message includes property context, not private/internal data.

Example message:

```text
Hola, soy propietario de Av. Siempre Viva 123.
Quería hacer una consulta general sobre esta propiedad.
```

### Analytics

Add `WHATSAPP_CONTACT_CLICKED` to analytics event names.

For Stage 23.1 metadata, store only safe routing context:

```json
{
  "context": "property",
  "targetType": "tenant"
}
```

Do not store the phone number or full message body.

## Stage 23.2 — Movement-level WhatsApp contact

### User outcome

Inside a visible owner movement/status item, the owner can click **Consultar responsable** or **Consultar a {firstName}** to open WhatsApp to the user who created that movement.

### Data model

Add a nullable user-level WhatsApp field if not already added in Stage 23.1:

| Model | Field | Notes |
|---|---|---|
| `User` | `whatsappPhone String?` | Used only when that user is already visible as the movement author inside an authorized owner property context. |

### Backend/API behavior

Expose movement contact capability only through owner-authorized property/movement responses. The target is `movement.createdBy`.

Recommended response shape:

```ts
type OwnerMovementContact = {
  available: boolean;
  targetType: 'movement_author';
  displayLabel: string;
  whatsappPhone?: string;
};
```

If the movement author has no WhatsApp, return `available: false`. Do not fallback to tenant for movement-specific contact in this slice; fallback can hide operational ownership and recreate the forwarding problem.

### Frontend behavior

Add a compact WhatsApp action to each owner-visible movement.

- Preferred label with name: `Consultar a Ana`.
- Generic fallback label: `Consultar responsable`.
- Missing contact copy: `Contacto no configurado`.

Example message:

```text
Hola, soy propietario de Av. Siempre Viva 123.
Quería consultar por este movimiento:

Estado: En negociación
Fecha: 01/06/2026

Gracias.
```

If the movement has an observation, include a short sanitized excerpt only if it is already visible to the owner in the UI.

### Analytics

For Stage 23.2 metadata:

```json
{
  "context": "movement",
  "targetType": "movement_author"
}
```

Attach existing first-class columns where available:

- `propertyEngagementId`
- `propertyAssetId`
- `movementId`
- `actorType: OWNER_USER`
- `actorUserId` when the owner is authenticated

Do not store phone number, author email, author name, owner name, property address, or message body in analytics metadata.

## Security and privacy rules

- Owner contact data is exposed only inside owner-authorized property/movement responses.
- Do not expose arbitrary tenant user phones.
- Do not add phone fields to broad team/member lists unless that future UI needs them.
- Normalize WhatsApp URLs to digits for `wa.me`; keep `+` only in stored value if useful for display/config.
- Use `encodeURIComponent` for message text.
- Treat frontend button visibility as UX only; backend owner portal access remains the authorization boundary.
- Analytics must be non-blocking and must not persist PII-heavy metadata.

## Out of scope

- WhatsApp Business API.
- Sending messages server-side.
- Conversation history.
- Config/settings UI for phone numbers.
- Per-property primary agent assignment.
- Creating movements on behalf of another user.
- Fallback routing from movement author to tenant.

## Likely implementation order

1. Add Prisma fields and migration for `Tenant.whatsappPhone` and `User.whatsappPhone`.
2. Add `WHATSAPP_CONTACT_CLICKED` analytics event.
3. Implement Stage 23.1 owner property contact response and CTA.
4. Implement Stage 23.1 click tracking.
5. Implement Stage 23.2 movement author contact response and CTA.
6. Implement Stage 23.2 click tracking.
7. Add focused API, BFF, service, component, and typecheck validation.

## Acceptance criteria

### Stage 23.1

- Owner sees a WhatsApp property contact CTA when the tenant has a configured WhatsApp phone.
- Owner sees an honest unavailable state when the tenant phone is missing.
- The generated message includes property context.
- Contact click analytics are recorded without phone/message PII.
- Existing owner access isolation remains unchanged.

### Stage 23.2

- Owner sees movement contact actions for visible movements whose author has a configured WhatsApp phone.
- The movement action routes to `Movement.createdByUser.whatsappPhone`.
- The generated message includes property and movement context.
- No tenant fallback is used for movement-specific questions.
- Contact click analytics are recorded without phone/message PII.
