# ProductForm Image Dialogs Refactor Design

This slice continues reducing `product-form.tsx` by extracting image dialog components into a focused module. It is a no-behavior-change refactor.

## Decision

Extract only the image delete and preview dialogs.

| Area | Decision |
|------|----------|
| Scope | Move image dialog components only. |
| New file | `viewpro-app/apps/app-new/src/features/products/components/property-image-dialogs.tsx` |
| Tests | Add focused dialog tests in `property-image-dialogs.test.tsx`. |
| Behavior | Preserve delete confirmation, preview, set-primary mutation, toasts, and invalidation. |
| Styling | Preserve existing classes and Spanish UI copy exactly. |

## Components to extract

Move these exports:

- `DeletePropertyImageDialog`
- `PropertyImagePreviewDialog`

Keep existing prop contracts as much as possible.

## What stays in `product-form.tsx`

`product-form.tsx` continues to own broader image behavior:

- `imagePendingDeletion` state;
- `imagePreview` state;
- delete image mutation;
- delete dialog close guard while pending;
- upload field and selected files;
- upload submit flow;
- image limit/slot calculation;
- form editor orchestration.

## Behavior preservation requirements

The extracted dialogs must keep these exact behaviors:

- Delete dialog:
  - controlled by `open` and `onOpenChange`;
  - shows the selected filename in the warning text;
  - disables cancel while `loading`;
  - shows loading on confirm while `loading`;
  - calls `onConfirm` unchanged.
- Preview dialog:
  - controlled by `open` and `onOpenChange`;
  - renders `PropertyImagePreview` for the selected image;
  - owns the set-primary mutation;
  - calls `setProductImageAsPrimary(engagementId, image.id)`;
  - on success, calls `onPrimaryChange(updatedImage)`;
  - invalidates `productKeys.all`;
  - shows `Imagen principal actualizada`;
  - disables primary CTA when no engagement/image or image is already primary;
  - preserves the existing error fallback text.

## Data flow

```txt
product-form.tsx
  ├─ owns image selected state + delete mutation
  ├─ renders ExistingImagesSummary callbacks
  ├─ renders DeletePropertyImageDialog from property-image-dialogs.tsx
  └─ renders PropertyImagePreviewDialog from property-image-dialogs.tsx
```

The preview dialog remains slightly behaviorful because it already owns the set-primary mutation. This slice preserves that placement instead of redesigning image management.

## Test plan

Add tests for extracted dialogs:

- delete dialog renders the filename and calls confirm;
- delete dialog disables cancel and shows loading state while `loading`;
- preview dialog renders selected image and primary CTA;
- primary image button is disabled/text changes when image is already primary;
- non-primary image click calls `setProductImageAsPrimary`;
- success calls `onPrimaryChange`, invalidates `productKeys.all`, and shows success toast;
- error shows the existing toast fallback.

Tests should use `QueryClientProvider` for the preview dialog and mock `sonner` plus `setProductImageAsPrimary`.

## Non-goals

- Do not move upload behavior.
- Do not change image slot/max-file calculations.
- Do not move delete mutation into the dialog.
- Do not extract a full image management section in this slice.
- Do not change API/service behavior.
- Do not redesign image UI.

## Next step

Write the implementation plan, then implement this as a small refactor PR targeting `develop`.
