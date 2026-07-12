# ProductForm Mapper Refactor Design

This slice continues reducing `product-form.tsx` by extracting pure create/edit form mapping and formatting helpers. It is a no-behavior-change refactor.

## Decision

Extract default values, payload conversion, and amount/message helper logic into a pure module.

| Area | Decision |
|------|----------|
| Scope | Pure create/edit form mappers and helpers only. |
| New file | `viewpro-app/apps/app-new/src/features/products/components/product-form-mappers.ts` |
| Tests | Add focused unit tests in `product-form-mappers.test.ts`. |
| Behavior | Preserve create/update payload shape, defaults, amount formatting/parsing, and save messages. |
| UI | Do not move form JSX or image upload/delete behavior in this slice. |

## Functions to extract

Export these functions from `product-form-mappers.ts`:

- `getDefaultValues`
- `toCreatePayload`
- `toUpdatePayload`
- `formatAmountInput`
- `parseAmountInput`
- `getImageUploadDescription`
- `getPropertySaveSuccessMessage`

Keep these as internal helpers in the new module:

- `optionalIntegerValue`
- `optionalIntegerOrNull`
- `centsToAmount`
- `amountToCents`
- `optionalAmountToCentsOrNull`
- `optionalStringOrNull`

## What stays in `product-form.tsx`

`product-form.tsx` continues to own runtime behavior:

- create/edit form component and JSX;
- submit mutation;
- image delete mutation;
- image upload loop;
- image preview/delete selected state;
- detail page restore behavior;
- all extracted sections/controllers already wired in.

## Behavior preservation requirements

The extracted mappers must keep these exact behaviors:

- create mode default values remain empty/undefined with `currency: 'ARS'` and `image: []`.
- edit mode maps property data into form values and converts cents to amount.
- create payload:
  - includes only defined finite optional numeric fields;
  - includes `publishedPriceCents` only when `publishedPrice` is a number;
  - uppercases currency when provided;
  - includes owner/orientation only when truthy, preserving current non-trimmed owner behavior.
- update payload:
  - sends nullable optional fields;
  - converts empty/undefined numeric fields to `null`;
  - trims optional strings and sends `null` for empty strings;
  - converts amount to cents when finite.
- amount formatting/parsing keeps current `es-AR` formatting and digit-only parsing.
- save and upload description copy stays unchanged.

## Test plan

Add unit tests for:

- create defaults;
- edit defaults from a `Product` fixture;
- create payload omits empty optional values and includes finite values;
- update payload nulls empty optional values and trims strings;
- amount formatting/parsing;
- save success messages;
- image upload description singular/plural.

These are pure unit tests and should not need React Query or DOM wrappers.

## Non-goals

- Do not move `uploadSelectedImages`.
- Do not move `getCarouselImages` in this slice.
- Do not split visual form sections.
- Do not change TanStack Form wiring.
- Do not change API/service behavior.
- Do not rename product/property modules.

## Next step

Write the implementation plan, then implement this as a focused refactor PR targeting `develop`.
