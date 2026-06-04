import type {
  PropertyEngagementStatus,
  PropertyOperationType,
  PropertyOwnerAccessStatus
} from '../api/types';

export type ProductStatusTone = 'danger' | 'info' | 'neutral' | 'success' | 'warning';

export type ProductStatusToneClasses = {
  badge: string;
  panel: string;
};

export const productStatusTones = {
  danger: {
    badge:
      'border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/15 dark:text-destructive',
    panel:
      'border-destructive/30 bg-destructive/10 text-foreground dark:border-destructive/40 dark:bg-destructive/15'
  },
  info: {
    badge:
      'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300',
    panel:
      'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200'
  },
  neutral: {
    badge:
      'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300',
    panel:
      'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200'
  },
  success: {
    badge:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    panel:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
  },
  warning: {
    badge:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    panel:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
  }
} satisfies Record<ProductStatusTone, ProductStatusToneClasses>;

export const propertyEngagementToneByStatus = {
  ACTIVE_PUBLICATION: 'success',
  CANCELLED: 'danger',
  CAPTURE: 'warning',
  CLOSED: 'neutral',
  DOCUMENTATION_PENDING: 'warning',
  FINAL_DOCUMENTATION: 'info',
  INQUIRIES_AND_VISITS: 'info',
  OFFER_NEGOTIATION: 'info',
  PUBLICATION_PREPARATION: 'info',
  RESERVATION_STARTED: 'warning'
} satisfies Record<PropertyEngagementStatus, ProductStatusTone>;

export const propertyOperationToneByType = {
  RENT: 'info',
  SALE: 'success'
} satisfies Record<PropertyOperationType, ProductStatusTone>;

export const ownerAccessToneByStatus = {
  ACTIVE: 'success',
  INVITED: 'warning',
  REVOKED: 'neutral'
} satisfies Record<PropertyOwnerAccessStatus, ProductStatusTone>;

export function getProductStatusBadgeTone(tone: ProductStatusTone) {
  return productStatusTones[tone].badge;
}

export function getProductStatusPanelTone(tone: ProductStatusTone) {
  return productStatusTones[tone].panel;
}
