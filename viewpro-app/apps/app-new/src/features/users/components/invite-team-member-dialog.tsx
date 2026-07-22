import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useEffect, useState, type SyntheticEvent } from 'react';
import type { CreateTeamInvitationPayload, TeamInvitationRole } from '../api/types';

const INITIAL_FORM: CreateTeamInvitationPayload = {
  email: '',
  role: 'AGENT'
};

const ROLE_OPTIONS: Array<{ label: string; value: TeamInvitationRole }> = [
  { label: 'Vendedor', value: 'AGENT' },
  { label: 'Encargado', value: 'MANAGER' }
];

type FieldErrors = Partial<Record<keyof CreateTeamInvitationPayload, string>>;

type InviteTeamMemberDialogProps = {
  invitationUrl: string | null;
  isSubmitting: boolean;
  onInviteAnother: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateTeamInvitationPayload) => void;
  open: boolean;
};

export function InviteTeamMemberDialog({
  invitationUrl,
  isSubmitting,
  onInviteAnother,
  onOpenChange,
  onSubmit,
  open
}: InviteTeamMemberDialogProps) {
  const [form, setForm] = useState<CreateTeamInvitationPayload>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setErrors({});
    }
  }, [open]);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CreateTeamInvitationPayload = {
      email: form.email.trim().toLowerCase(),
      role: form.role
    };
    const nextErrors = validatePayload(payload);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    onSubmit(payload);
  }

  function updateEmail(value: string) {
    setForm((current) => ({ ...current, email: value }));
    setErrors((current) => ({ ...current, email: undefined }));
  }

  function updateRole(value: string) {
    if (!isTeamInvitationRole(value)) {
      setErrors((current) => ({ ...current, role: 'Seleccioná un rol válido.' }));
      return;
    }

    setForm((current) => ({ ...current, role: value }));
    setErrors((current) => ({ ...current, role: undefined }));
  }

  function handleInviteAnother() {
    setForm(INITIAL_FORM);
    setErrors({});
    onInviteAnother();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Invitar miembro</DialogTitle>
          <DialogDescription>
            Creá una invitación para sumar un encargado o vendedor al equipo. Le enviamos el link por
            email automáticamente; también podés copiarlo abajo para compartirlo por otra vía.
          </DialogDescription>
        </DialogHeader>

        <form id='invite-team-member-form' className='space-y-5' noValidate onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor='team-invitation-email'>Email</FieldLabel>
            <Input
              id='team-invitation-email'
              type='email'
              value={form.email}
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              autoComplete='email'
              placeholder='vendedor@email.com'
              onChange={(event) => updateEmail(event.target.value)}
            />
            <FieldDescription>
              La invitación se crea para el tenant seleccionado actualmente.
            </FieldDescription>
            <FieldError>{errors.email}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor='team-invitation-role'>Rol</FieldLabel>
            <Select value={form.role} disabled={isSubmitting} onValueChange={updateRole}>
              <SelectTrigger
                id='team-invitation-role'
                aria-label='Rol'
                aria-invalid={!!errors.role}
                className='w-full'
              >
                <SelectValue placeholder='Seleccioná un rol' />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Solo se pueden invitar encargados o vendedores.</FieldDescription>
            <FieldError>{errors.role}</FieldError>
          </Field>

          {invitationUrl ? (
            <div className='bg-muted/40 rounded-lg border border-dashed p-4 text-sm'>
              <p className='font-medium'>Link de la invitación (también enviado por email):</p>
              <a
                href={invitationUrl}
                className='text-primary mt-2 block break-all underline-offset-4 hover:underline'
                target='_blank'
                rel='noreferrer'
              >
                {invitationUrl}
              </a>
            </div>
          ) : null}
        </form>

        <DialogFooter className='gap-2 sm:justify-between'>
          {invitationUrl ? (
            <Button
              type='button'
              variant='outline'
              disabled={isSubmitting}
              onClick={handleInviteAnother}
            >
              Invitar otra persona
            </Button>
          ) : (
            <Button
              type='button'
              variant='outline'
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          )}
          <Button
            type='submit'
            form='invite-team-member-form'
            disabled={isSubmitting}
            isLoading={isSubmitting}
          >
            Crear invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function validatePayload(payload: CreateTeamInvitationPayload) {
  const errors: FieldErrors = {};

  if (!payload.email) {
    errors.email = 'El email es obligatorio.';
  } else if (!isValidEmail(payload.email)) {
    errors.email = 'Ingresá un email válido.';
  }

  if (!isTeamInvitationRole(payload.role)) {
    errors.role = 'Seleccioná un rol válido.';
  }

  return errors;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isTeamInvitationRole(value: string): value is TeamInvitationRole {
  return ROLE_OPTIONS.some((option) => option.value === value);
}
