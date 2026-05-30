# ProductForm Image Editor Section Refactor Design

This slice continues reducing `product-form.tsx` by extracting the create/edit image gallery/upload UI into a focused component. It is a no-behavior-change refactor.

## Decision

Extract only the visual image editor section that is rendered inside the existing form provider.

| Area | Decision |
|------|----------|
| Scope | Move the editor image gallery/upload section only. |
| New file | `viewpro-app/apps/app-new/src/features/products/components/property-image-editor-section.tsx` |
| Tests | Add focused component tests in `property-image-editor-section.test.tsx`. |
| Behavior | Preserve image summary, upload field, max-slot message, callbacks, copy, and classes. |
| Runtime logic | Keep image delete mutation, upload loop, preview state, submit mutation, and dialogs in `product-form.tsx`. |

## Component to extract

Create this export:

```tsx
<PropertyImageEditorSection
  availableImageSlots={availableImageSlots}
  existingImageCount={existingImageCount}
  images={initialData?.property.images ?? []}
  isEditMode={isEditMode}
  pendingDeleteImageId={
    deleteImageMutation.isPending ? deleteImageMutation.variables?.id : undefined
  }
  onDeleteImage={handleDeleteImage}
  onPreviewImage={setImagePreview}
/>
```

The component renders the current image section:

- “Galería de imágenes” heading and copy;
- loaded-images badge;
- progress bar;
- `ExistingImagesSummary` in edit mode;
- `FormFileUploadField` when image slots are available;
- max-images message when no slots remain.

## What stays in `product-form.tsx`

`product-form.tsx` continues to own runtime behavior:

- image pending deletion state;
- image preview state;
- delete image mutation;
- delete dialog close guard;
- preview/delete dialogs;
- upload loop and upload failure accounting;
- create/edit submit mutation;
- form provider and `form.Form`.

## Form context rule

`PropertyImageEditorSection` must be rendered inside the existing `<form.AppForm>` provider. The component may call:

```ts
const { FormFileUploadField } = useFormFields<ProductFormValues>();
```

Do not move `form.AppForm` or `form.Form` ownership in this slice.

## Behavior preservation requirements

The extracted component must keep these exact behaviors:

- Existing image count badge remains `{existingImageCount} / {PROPERTY_IMAGE_MAX_FILES} cargadas`.
- Progress bar width keeps the same `Math.min((existingImageCount / PROPERTY_IMAGE_MAX_FILES) * 100, 100)` formula.
- `ExistingImagesSummary` renders only in edit mode.
- `ExistingImagesSummary` receives the same images, delete callback, preview callback, and pending delete id.
- Upload field label stays:
  - edit mode: `Sumar nuevas imágenes`;
  - create mode: `Imágenes iniciales`.
- Upload field keeps the same `maxFiles`, `maxSize`, `accept`, and description behavior.
- Full gallery message stays unchanged.

## Test plan

Add component tests for:

- create mode renders “Imágenes iniciales” and does not render existing summary;
- edit mode renders existing summary and “Sumar nuevas imágenes”;
- full gallery renders the max-images message and hides the upload field;
- delete/preview callbacks are forwarded through `ExistingImagesSummary`;
- pending delete id disables the matching delete action.

Tests can use a minimal harness that renders `PropertyImageEditorSection` inside an app form provider or mock the form field component only if the existing form provider setup is too heavy. Prefer real provider wiring when practical.

## Non-goals

- Do not move image delete mutation.
- Do not move upload submit behavior.
- Do not move image dialogs.
- Do not change image validation constants.
- Do not change form schema or TanStack Form wiring.
- Do not extract other visual form sections in this slice.

## Next step

Write the implementation plan, then implement this as a focused refactor PR targeting `develop`.
