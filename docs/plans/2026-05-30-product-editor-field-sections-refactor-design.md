# ProductForm Editor Field Sections Refactor Design

This slice continues reducing `product-form.tsx` after the image editor section extraction. It is a no-behavior-change refactor focused on visual form field sections in the create/edit editor.

## Decision

Extract reusable visual field groups that can safely consume the existing TanStack Form context through `useFormFields<ProductFormValues>()`.

| Area | Decision |
|------|----------|
| Scope | Move visual editor fields only: basic details, characteristics, and owner reference fields. |
| New file | `viewpro-app/apps/app-new/src/features/products/components/property-editor-field-sections.tsx` |
| Tests | Add focused render tests in `property-editor-field-sections.test.tsx`. |
| Behavior | Preserve labels, placeholders, validators, descriptions, options, layout classes, and field names. |
| Runtime logic | Keep create/edit mutation, upload loop, image state, image dialogs, form provider, and submit/cancel actions in `product-form.tsx`. |
| Price field | Keep `publishedPrice` inline in `product-form.tsx` for this slice because it uses the concrete `form.AppField` instance. |

## Components to extract

### `PropertyBasicFields`

Move these fields unchanged:

- `title`
- `propertyType`
- `addressLine`
- `city`
- `province`
- `operationType`

The component imports the existing option lists from `product-options` and keeps the current `z` blur validators for title/address/city/province.

### `PropertyCharacteristicsFields`

Move the full bordered characteristics section unchanged:

- section wrapper and explanatory copy;
- `totalAreaSqm`
- `coveredAreaSqm`
- `rooms`
- `bedrooms`
- `bathrooms`
- `garages`
- `ageYears`
- `orientation`

The component keeps the current grid classes and orientation max-length validator.

### `PropertyOwnerReferenceFields`

Move the owner reference fields unchanged:

- `ownerName`
- `ownerEmail`

## What stays in `product-form.tsx`

`product-form.tsx` continues to own the editor shell and all runtime behavior:

- `useAppForm` setup and `form.AppForm` / `form.Form` ownership;
- `publishedPrice` custom `form.AppField` and amount formatting/parsing;
- `currency` field if it remains visually adjacent to price in the parent;
- create/edit mutation and navigation;
- image limit guard, upload loop, and upload failures;
- image delete mutation and dialog state;
- image editor section props;
- submit/cancel actions.

## Form context rule

The extracted sections must be rendered inside the existing `<form.AppForm>` provider. Each section may call:

```ts
const { FormTextField, FormSelectField } = useFormFields<ProductFormValues>();
```

Do not move `form.AppForm` or `form.Form` ownership in this slice.

## Behavior preservation requirements

The refactor must preserve:

- every field `name`;
- every label, placeholder, description, and required flag;
- every select option source;
- every numeric field `type`, `min`, and `step` prop;
- all `z` blur validators and messages;
- current section wrapper classes;
- current field order around the inline price/currency fields.

## Proposed editor layout after extraction

Inside the existing grid:

```tsx
<PropertyBasicFields />

<form.AppField name='publishedPrice'>...</form.AppField>

<FormSelectField name='currency' ... />

<PropertyCharacteristicsFields />

<PropertyOwnerReferenceFields />

<PropertyImageEditorSection ... />
```

If keeping currency inline leaves `product-form.tsx` needing `useFormFields`, keep only `FormSelectField` there. Do not force currency into the new component if that makes the price/currency relationship less readable.

## Test plan

Add component tests for:

- `PropertyBasicFields` renders key commercial/address labels and select placeholders;
- `PropertyCharacteristicsFields` renders the section heading/copy and all physical characteristic labels/descriptions;
- `PropertyOwnerReferenceFields` renders owner name/email fields;
- extracted fields can render under the real app form provider.

## Non-goals

- Do not change field semantics or validation.
- Do not move `publishedPrice` in this slice.
- Do not move submit/cancel actions.
- Do not move create/edit mutation or upload behavior.
- Do not move image editor behavior.
- Do not introduce new shared UI primitives or global styles.

## Next step

Write the implementation plan, then implement this focused refactor PR targeting `develop`.
