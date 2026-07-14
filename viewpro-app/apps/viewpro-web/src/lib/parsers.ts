import { createParser } from 'nuqs/server';

import { dataTableConfig } from '@/config/data-table';

import type { ExtendedColumnFilter, ExtendedColumnSort } from '@/types/data-table';

const filterVariants = new Set<string>(dataTableConfig.filterVariants);
const operators = new Set<string>(dataTableConfig.operators);

type SortingItem = {
  id: string;
  desc: boolean;
};

export type FilterItemSchema = {
  id: string;
  value: string | string[];
  variant: (typeof dataTableConfig.filterVariants)[number];
  operator: (typeof dataTableConfig.operators)[number];
  filterId: string;
};

export const getSortingStateParser = <TData>(columnIds?: string[] | Set<string>) => {
  const validKeys = columnIds ? (columnIds instanceof Set ? columnIds : new Set(columnIds)) : null;

  return createParser({
    parse: (value) => {
      try {
        const parsed: unknown = JSON.parse(value);

        if (!Array.isArray(parsed) || !parsed.every(isSortingItem)) {
          return null;
        }

        if (validKeys && parsed.some((item) => !validKeys.has(item.id))) {
          return null;
        }

        return parsed as ExtendedColumnSort<TData>[];
      } catch {
        return null;
      }
    },
    serialize: (value) => JSON.stringify(value),
    eq: (a, b) =>
      a.length === b.length &&
      a.every((item, index) => item.id === b[index]?.id && item.desc === b[index]?.desc)
  });
};

export const getFiltersStateParser = <TData>(columnIds?: string[] | Set<string>) => {
  const validKeys = columnIds ? (columnIds instanceof Set ? columnIds : new Set(columnIds)) : null;

  return createParser({
    parse: (value) => {
      try {
        const parsed: unknown = JSON.parse(value);

        if (!Array.isArray(parsed) || !parsed.every(isFilterItem)) {
          return null;
        }

        if (validKeys && parsed.some((item) => !validKeys.has(item.id))) {
          return null;
        }

        return parsed as ExtendedColumnFilter<TData>[];
      } catch {
        return null;
      }
    },
    serialize: (value) => JSON.stringify(value),
    eq: (a, b) =>
      a.length === b.length &&
      a.every(
        (filter, index) =>
          filter.id === b[index]?.id &&
          filter.value === b[index]?.value &&
          filter.variant === b[index]?.variant &&
          filter.operator === b[index]?.operator
      )
  });
};

function isSortingItem(value: unknown): value is SortingItem {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as SortingItem).id === 'string' &&
    typeof (value as SortingItem).desc === 'boolean'
  );
}

function isFilterItem(value: unknown): value is FilterItemSchema {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<FilterItemSchema>;

  return Boolean(
    typeof item.id === 'string' &&
    isFilterValue(item.value) &&
    typeof item.variant === 'string' &&
    filterVariants.has(item.variant) &&
    typeof item.operator === 'string' &&
    operators.has(item.operator) &&
    typeof item.filterId === 'string'
  );
}

function isFilterValue(value: unknown): value is FilterItemSchema['value'] {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}
