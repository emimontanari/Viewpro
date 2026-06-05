'use client';

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { adminDashboardOptions } from '@/features/admin/api/queries';
import { updateAdminTenantLimits, updateAdminTenantStatus } from '@/features/admin/api/service';
import type {
  AdminDashboardData,
  AdminTenant,
  AdminTenantLimits,
  AdminTenantStatus,
  AdminTenantStatusAction
} from '@/features/admin/api/types';
import { getApiErrorMessage } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';

type PendingStatusAction = {
  tenantId: string;
  tenantName: string;
  targetStatus: AdminTenantStatusAction;
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
};

export function AdminTenantManagementPage() {
  const [pendingAction, setPendingAction] = React.useState<PendingStatusAction | null>(null);
  const [limitsTenant, setLimitsTenant] = React.useState<AdminTenant | null>(null);
  const { isLoading: isSessionLoading, session } = useSession();
  const isAdmin = session?.user.globalRole === 'VIEWPRO_ADMIN';
  const isForbidden = !isSessionLoading && !isAdmin;
  const dashboardQuery = useQuery({
    ...adminDashboardOptions(),
    enabled: isAdmin,
    retry: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });
  const statusMutation = useMutation({
    mutationFn: (input: {
      tenantId: string;
      status: AdminTenantStatusAction;
      successMessage: string;
    }) => updateAdminTenantStatus(input.tenantId, { status: input.status }),
    onSuccess: async (result, input) => {
      if (result.unchanged) {
        toast.info('El tenant ya tenía ese estado.');
      } else {
        toast.success(input.successMessage);
      }

      setPendingAction(null);
      await dashboardQuery.refetch();
    },
    onError: () => {
      toast.error('No se pudo actualizar el estado del tenant.');
    }
  });
  const limitsMutation = useMutation({
    mutationFn: (input: { tenantId: string; limits: AdminTenantLimits }) =>
      updateAdminTenantLimits(input.tenantId, input.limits),
    onSuccess: async (result) => {
      if (result.unchanged) {
        toast.info('El tenant ya tenía esos límites.');
      } else {
        toast.success('Límites del tenant actualizados.');
      }

      setLimitsTenant(null);
      await dashboardQuery.refetch();
    },
    onError: () => {
      toast.error('No se pudieron actualizar los límites del tenant.');
    }
  });

  if (isSessionLoading || (isAdmin && dashboardQuery.isLoading)) {
    return <AdminLoadingState />;
  }

  if (isForbidden) {
    return <AdminRestrictedState />;
  }

  if (dashboardQuery.isError) {
    return <AdminErrorState error={getApiErrorMessage(dashboardQuery.error)} />;
  }

  if (!dashboardQuery.data) {
    return null;
  }

  return (
    <section className='min-w-0 space-y-6' aria-label='Consola admin de tenants'>
      <SafeBoundaryCard />
      <AdminSummaryCards data={dashboardQuery.data} />
      <AdminTenantsCard
        data={dashboardQuery.data}
        isMutating={statusMutation.isPending || limitsMutation.isPending}
        onEditLimits={setLimitsTenant}
        onSelectAction={setPendingAction}
      />
      <AdminActivityCard data={dashboardQuery.data} />
      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.description} Esta acción se aplica sobre {pendingAction?.tenantName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={statusMutation.isPending || !pendingAction}
              onClick={() => {
                if (!pendingAction) {
                  return;
                }

                statusMutation.mutate({
                  tenantId: pendingAction.tenantId,
                  status: pendingAction.targetStatus,
                  successMessage: pendingAction.successMessage
                });
              }}
            >
              {statusMutation.isPending
                ? 'Actualizando estado…'
                : (pendingAction?.confirmLabel ?? 'Confirmar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <TenantLimitsDialog
        tenant={limitsTenant}
        isSaving={limitsMutation.isPending}
        onClose={() => setLimitsTenant(null)}
        onSave={(limits) => {
          if (!limitsTenant) {
            return;
          }

          limitsMutation.mutate({ tenantId: limitsTenant.id, limits });
        }}
      />
    </section>
  );
}

function AdminLoadingState() {
  return (
    <section className='space-y-4' aria-label='Cargando consola admin'>
      <p className='text-sm text-muted-foreground'>Cargando consola admin…</p>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className='h-28 rounded-xl' />
        ))}
      </div>
      <Skeleton className='h-72 rounded-xl' />
    </section>
  );
}

function AdminRestrictedState() {
  return (
    <Card className='mx-auto max-w-2xl py-0'>
      <CardHeader className='p-6'>
        <Badge variant='outline' className='mb-2 w-fit rounded-full bg-muted/40'>
          Acceso global
        </Badge>
        <CardTitle>Acceso restringido a ViewPro Admin</CardTitle>
        <CardDescription>
          Necesitás rol global VIEWPRO_ADMIN para abrir este comando operativo. Los roles tenant no
          conceden acceso admin.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function AdminErrorState({ error }: { error: string }) {
  return (
    <Card className='mx-auto max-w-2xl py-0'>
      <CardHeader className='p-6'>
        <CardTitle>No pudimos cargar el admin</CardTitle>
        <CardDescription>{error}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function SafeBoundaryCard() {
  return (
    <Card className='overflow-hidden py-0'>
      <CardHeader className='p-6'>
        <Badge variant='outline' className='w-fit rounded-full bg-muted/40'>
          Frontera segura
        </Badge>
        <CardTitle>Operaciones globales sin mezclar tenant workspace</CardTitle>
        <CardDescription>
          Sin impersonación, billing ni acceso a documentos privados. Esta consola usa endpoints
          admin globales y no depende del tenant seleccionado.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function AdminSummaryCards({ data }: { data: AdminDashboardData }) {
  const items = [
    { label: 'Tenants', value: data.summary.totals.tenants },
    { label: 'Tenants activos', value: data.summary.totals.activeTenants },
    { label: 'Usuarios', value: data.summary.totals.users },
    { label: 'Eventos recientes', value: data.summary.recentActivityCount }
  ];

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
      {items.map((item) => (
        <Card key={item.label} className='py-0'>
          <CardHeader className='p-5'>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className='text-3xl tabular-nums'>{formatNumber(item.value)}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function AdminTenantsCard({
  data,
  isMutating,
  onEditLimits,
  onSelectAction
}: {
  data: AdminDashboardData;
  isMutating: boolean;
  onEditLimits: (tenant: AdminTenant) => void;
  onSelectAction: (action: PendingStatusAction) => void;
}) {
  return (
    <Card className='py-0'>
      <CardHeader className='p-5 pb-0'>
        <CardTitle>Tenants</CardTitle>
        <CardDescription>
          Activá, suspendé o reactivá tenants con audit automático. Mostrando{' '}
          {data.tenants.items.length} de {data.tenants.total}.
        </CardDescription>
      </CardHeader>
      <CardContent className='overflow-x-auto p-5'>
        {data.tenants.items.length === 0 ? (
          <p className='rounded-xl border border-dashed p-6 text-sm text-muted-foreground'>
            No hay tenants para este filtro.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Límites</TableHead>
                <TableHead>Actividad</TableHead>
                <TableHead className='text-right'>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tenants.items.map((tenant) => {
                const action = getTenantAction(tenant);

                return (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div className='space-y-1'>
                        <p className='font-medium'>{tenant.name}</p>
                        <p className='text-xs text-muted-foreground'>{tenant.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={tenant.status} />
                    </TableCell>
                    <TableCell>
                      <TenantLimitsSummary tenant={tenant} />
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        className='mt-2 px-0 text-xs'
                        disabled={isMutating}
                        onClick={() => onEditLimits(tenant)}
                      >
                        Editar límites
                      </Button>
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {tenant.lastActivityAt
                        ? formatDateTime(tenant.lastActivityAt)
                        : 'Sin actividad'}
                    </TableCell>
                    <TableCell className='text-right'>
                      {action ? (
                        <Button
                          size='sm'
                          variant={action.targetStatus === 'SUSPENDED' ? 'destructive' : 'outline'}
                          disabled={isMutating}
                          onClick={() => onSelectAction(action)}
                        >
                          {action.confirmLabel}
                        </Button>
                      ) : (
                        <span className='text-xs text-muted-foreground'>Sin acción</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function TenantLimitsSummary({ tenant }: { tenant: AdminTenant }) {
  const items = [
    { label: 'Usuarios', value: formatLimitValue(tenant.limits.maxUsers) },
    {
      label: 'Publicaciones activas',
      value: formatLimitValue(tenant.limits.maxActivePropertyEngagements)
    },
    { label: 'Storage documentos', value: formatStorageLimit(tenant.limits.maxDocumentsStorageMb) }
  ];

  return (
    <dl className='space-y-1 text-xs text-muted-foreground'>
      {items.map((item) => (
        <div key={item.label} className='flex min-w-48 justify-between gap-3'>
          <dt>{item.label}</dt>
          <dd className='font-medium text-foreground'>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TenantLimitsDialog({
  tenant,
  isSaving,
  onClose,
  onSave
}: {
  tenant: AdminTenant | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (limits: AdminTenantLimits) => void;
}) {
  const [values, setValues] = React.useState<Record<keyof AdminTenantLimits, string>>({
    maxUsers: '',
    maxActivePropertyEngagements: '',
    maxDocumentsStorageMb: ''
  });

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
              maxActivePropertyEngagements: parseLimitInputValue(
                values.maxActivePropertyEngagements
              ),
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
  id: keyof AdminTenantLimits;
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

function AdminActivityCard({ data }: { data: AdminDashboardData }) {
  return (
    <Card className='py-0'>
      <CardHeader className='p-5 pb-0'>
        <CardTitle>Actividad admin reciente</CardTitle>
        <CardDescription>Eventos sanitizados del backoffice global.</CardDescription>
      </CardHeader>
      <CardContent className='p-5'>
        {data.activity.items.length === 0 ? (
          <p className='rounded-xl border border-dashed p-6 text-sm text-muted-foreground'>
            No hay actividad para mostrar.
          </p>
        ) : (
          <div className='space-y-3'>
            {data.activity.items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className='flex flex-col gap-1 rounded-xl border bg-muted/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between'
              >
                <span className='font-medium'>{item.eventName}</span>
                <span className='text-muted-foreground'>{formatDateTime(item.occurredAt)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: AdminTenantStatus }) {
  const label = getStatusLabel(status);
  const variant =
    status === 'ACTIVE' ? 'default' : status === 'SUSPENDED' ? 'destructive' : 'outline';

  return (
    <Badge variant={variant} className='rounded-full'>
      {label}
    </Badge>
  );
}

function getTenantAction(tenant: AdminTenant): PendingStatusAction | null {
  if (tenant.status === 'TRIAL') {
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      targetStatus: 'ACTIVE',
      title: 'Activar tenant',
      description: 'El tenant pasará de trial a activo y recuperará acceso operativo.',
      confirmLabel: 'Activar',
      successMessage: 'Tenant activado.'
    };
  }

  if (tenant.status === 'ACTIVE') {
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      targetStatus: 'SUSPENDED',
      title: 'Suspender tenant',
      description: 'Esta acción bloquea el uso operativo del tenant hasta que lo reactives.',
      confirmLabel: 'Suspender',
      successMessage: 'Tenant suspendido.'
    };
  }

  if (tenant.status === 'SUSPENDED') {
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      targetStatus: 'ACTIVE',
      title: 'Reactivar tenant',
      description: 'El tenant recuperará acceso operativo según sus membresías existentes.',
      confirmLabel: 'Reactivar',
      successMessage: 'Tenant reactivado.'
    };
  }

  return null;
}

function getStatusLabel(status: AdminTenantStatus) {
  const labels: Record<AdminTenantStatus, string> = {
    TRIAL: 'Trial',
    ACTIVE: 'Activo',
    SUSPENDED: 'Suspendido',
    CANCELLED: 'Cancelado'
  };

  return labels[status] ?? status;
}

function formatLimitValue(value: number | null) {
  return value === null ? 'Sin límite' : formatNumber(value);
}

function formatStorageLimit(value: number | null) {
  return value === null ? 'Sin límite' : `${formatNumber(value)} MB`;
}

function limitToInputValue(value: number | null) {
  return value === null ? '' : String(value);
}

function parseLimitInputValue(value: string) {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
}

function isLimitInputValueAllowed(value: string) {
  return value === '' || /^\d+$/.test(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-AR').format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}
