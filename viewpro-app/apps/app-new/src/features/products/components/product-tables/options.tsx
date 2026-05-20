import {
  operationTypeOptions,
  propertyStatusOptions,
  propertyTypeOptions
} from '@/features/products/constants/product-options';

export const OPERATION_TYPE_OPTIONS = operationTypeOptions;
export const PROPERTY_STATUS_OPTIONS = propertyStatusOptions;
export const PROPERTY_TYPE_OPTIONS = propertyTypeOptions;

// Backwards-compatible export while product-named modules are migrated.
export const CATEGORY_OPTIONS = OPERATION_TYPE_OPTIONS;
