'use client';

// Modal limits editor (D6/D7): raw useState<Record<keyof TenantLimits,string>> form,
// copy-adapted from app-new's LimitInput pattern (not @tanstack/react-form — three
// optional numeric fields do not justify a form library).
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TenantLimits, TenantListItem } from '@/features/tenants/api/types';

type Props = {
  tenant: TenantListItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (limits: TenantLimits) => void;
};

type LimitField = keyof TenantLimits;

const EMPTY_VALUES: Record<LimitField, string> = {
  maxUsers: '',
  maxActivePropertyEngagements: '',
  maxDocumentsStorageMb: ''
};

/**
 * Modal dialog to edit a tenant's 3 optional numeric limits (D6/D7). Seeded
 * from `tenant.limits` on open via `useEffect([tenant])`; there is no
 * single-tenant GET, so the row's data is the only source of truth. Clearing
 * a field ("Sin límite") sends `null` for that field on submit.
 */
export function TenantLimitsDialog({ tenant, isSaving, onClose, onSave }: Props) {
  const [values, setValues] = React.useState<Record<LimitField, string>>(EMPTY_VALUES);

  React.useEffect(() => {
    if (!tenant) {
      return;
    }

    setValues({
      maxUsers: limitToInputValue(tenant.limits.maxUsers),
      maxActivePropertyEngagements: limitToInputValue(tenant.limits.maxActivePropertyEngagements),
      maxDocumentsStorageMb: limitToInputValue(tenant.limits.maxDocumentsStorageMb)
    });
  }, [tenant]);

  return (
    <Dialog open={Boolean(tenant)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar límites{tenant ? ` de ${tenant.name}` : ''}</DialogTitle>
          <DialogDescription>
            Dejá un campo vacío para mantenerlo sin límite. Publicaciones activas controla
            operaciones activas, no propiedades históricas.
          </DialogDescription>
        </DialogHeader>
        <form
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              maxUsers: parseLimitInputValue(values.maxUsers),
              maxActivePropertyEngagements: parseLimitInputValue(values.maxActivePropertyEngagements),
              maxDocumentsStorageMb: parseLimitInputValue(values.maxDocumentsStorageMb)
            });
          }}
        >
          <LimitInput
            id='maxUsers'
            label='Usuarios'
            value={values.maxUsers}
            onChange={(value) => setValues((current) => ({ ...current, maxUsers: value }))}
          />
          <LimitInput
            id='maxActivePropertyEngagements'
            label='Publicaciones activas'
            value={values.maxActivePropertyEngagements}
            onChange={(value) =>
              setValues((current) => ({ ...current, maxActivePropertyEngagements: value }))
            }
          />
          <LimitInput
            id='maxDocumentsStorageMb'
            label='Storage documentos (MB)'
            value={values.maxDocumentsStorageMb}
            onChange={(value) =>
              setValues((current) => ({ ...current, maxDocumentsStorageMb: value }))
            }
          />
          <DialogFooter>
            <Button type='button' variant='outline' disabled={isSaving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type='submit' disabled={isSaving}>
              {isSaving ? 'Guardando límites…' : 'Guardar límites'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LimitInput({
  id,
  label,
  value,
  onChange
}: {
  id: LimitField;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between gap-3'>
        <Label htmlFor={id}>{label}</Label>
        <Button type='button' variant='ghost' size='sm' onClick={() => onChange('')}>
          Sin límite
        </Button>
      </div>
      <Input
        id={id}
        type='number'
        min={0}
        step={1}
        inputMode='numeric'
        placeholder='Sin límite'
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;

          if (isLimitInputValueAllowed(nextValue)) {
            onChange(nextValue);
          }
        }}
      />
    </div>
  );
}

function limitToInputValue(value: number | null) {
  return value === null ? '' : String(value);
}

function parseLimitInputValue(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
}

function isLimitInputValueAllowed(value: string) {
  return value === '' || /^\d+$/.test(value);
}
