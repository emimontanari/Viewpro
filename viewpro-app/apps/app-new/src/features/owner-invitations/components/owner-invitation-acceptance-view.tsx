'use client';

import * as React from 'react';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { getApiErrorMessage, isApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { InteractiveGridPattern } from '@/features/auth/components/interactive-grid';
import { acceptOwnerInvitation, getOwnerInvitation } from '../api/service';
import type { OwnerInvitationResponse } from '../api/types';

type OwnerInvitationAcceptanceViewProps = {
  token: string;
};

type AcceptanceValues = {
  firstName: string;
  lastName: string;
  password: string;
};

type InvitationUiError = {
  title: string;
  description: string;
  showSignInLink?: boolean;
};

const acceptanceSchema = z.object({
  firstName: z.string().trim().min(1, 'Ingresá tu nombre.'),
  lastName: z.string(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')
});

export function OwnerInvitationAcceptanceView({ token }: OwnerInvitationAcceptanceViewProps) {
  const router = useRouter();
  const [invitation, setInvitation] = React.useState<OwnerInvitationResponse | null>(null);
  const [loadError, setLoadError] = React.useState<unknown>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [submitError, setSubmitError] = React.useState<unknown>(null);

  React.useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setInvitation(null);
    setLoadError(null);
    setSubmitError(null);

    getOwnerInvitation(token)
      .then((response) => {
        if (!cancelled) {
          setInvitation(response);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error);
          setInvitation(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className='relative flex min-h-screen flex-col items-center justify-center overflow-hidden md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <Link
        href='/auth/sign-in'
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute top-4 right-4 md:top-8 md:right-8'
        )}
      >
        Iniciar sesión
      </Link>
      <div className='relative hidden h-full flex-col p-10 lg:flex dark:border-r'>
        <div className='absolute inset-0 bg-sidebar' />
        <BrandPanel />
      </div>
      <div className='flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='flex w-full max-w-xl flex-col items-center justify-center space-y-6'>
          {isLoading ? <LoadingCard /> : null}
          {!isLoading && loadError ? <InvitationErrorCard error={loadError} /> : null}
          {!isLoading && invitation ? (
            <AcceptanceCard
              invitation={invitation}
              onSubmit={async (value) => {
                setSubmitError(null);

                try {
                  await acceptOwnerInvitation(token, {
                    firstName: value.firstName.trim(),
                    lastName: value.lastName.trim() || undefined,
                    password: value.password
                  });
                  router.push('/owner');
                  router.refresh();
                } catch (error) {
                  setSubmitError(error);
                }
              }}
              submitError={submitError}
            />
          ) : null}
          {!isLoading && invitation ? (
            <p className='text-muted-foreground px-8 text-center text-sm'>
              Al continuar, aceptás nuestros{' '}
              <Link
                href='/terms-of-service'
                className='hover:text-primary underline underline-offset-4'
              >
                términos de servicio
              </Link>{' '}
              y nuestra{' '}
              <Link
                href='/privacy-policy'
                className='hover:text-primary underline underline-offset-4'
              >
                política de privacidad
              </Link>
              .
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <>
      <div className='text-sidebar-foreground relative z-20 flex items-center text-lg font-medium'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='mr-2 h-6 w-6'
        >
          <path d='M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3' />
        </svg>
        ViewPro
      </div>
      <InteractiveGridPattern
        className={cn(
          'mask-[radial-gradient(400px_circle_at_center,white,transparent)]',
          'inset-x-0 inset-y-[0%] h-full skew-y-12'
        )}
      />
      <div className='text-sidebar-foreground relative z-20 mt-auto'>
        <blockquote className='space-y-2'>
          <p className='text-lg'>
            &ldquo;ViewPro nos ayuda a ordenar propiedades, contactos y seguimiento comercial en un
            solo lugar.&rdquo;
          </p>
          <footer className='text-sidebar-foreground/70 text-sm'>Equipo ViewPro</footer>
        </blockquote>
      </div>
    </>
  );
}

function LoadingCard() {
  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Cargando invitación</CardTitle>
        <p className='text-muted-foreground'>Estamos verificando el link de acceso.</p>
      </CardHeader>
      <CardContent>
        <p className='text-muted-foreground text-sm'>Esto puede tardar unos segundos.</p>
      </CardContent>
    </Card>
  );
}

function InvitationErrorCard({ error }: { error: unknown }) {
  const uiError = getInvitationUiError(error);

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>{uiError.title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Alert variant='destructive'>
          <AlertDescription>{uiError.description}</AlertDescription>
        </Alert>
        {uiError.showSignInLink ? (
          <Link
            href='/auth/sign-in'
            className={cn(buttonVariants({ variant: 'default' }), 'w-full')}
          >
            Iniciar sesión
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AcceptanceCard({
  invitation,
  onSubmit,
  submitError
}: {
  invitation: OwnerInvitationResponse;
  onSubmit: (value: AcceptanceValues) => Promise<void>;
  submitError: unknown;
}) {
  const { FormTextField } = useFormFields<AcceptanceValues>();
  const form = useAppForm({
    defaultValues: {
      firstName: invitation.ownerFirstName,
      lastName: invitation.ownerLastName,
      password: ''
    } as AcceptanceValues,
    validators: {
      onSubmit: acceptanceSchema
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    }
  });
  const submitUiError = submitError ? getInvitationUiError(submitError) : null;

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Aceptar invitación</CardTitle>
        <p className='text-muted-foreground'>
          Completá tus datos para crear tu cuenta y acceder al portal de propietarios.
        </p>
      </CardHeader>
      <CardContent className='space-y-6'>
        <section className='bg-muted/40 rounded-lg border p-4'>
          <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
            Propiedad invitada
          </p>
          <h2 className='mt-2 text-lg font-semibold'>{invitation.property.title}</h2>
          <p className='text-muted-foreground text-sm'>{formatPropertyAddress(invitation)}</p>
          <div className='mt-4 space-y-1'>
            <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
              Email invitado
            </p>
            <p className='text-sm font-medium'>{invitation.email}</p>
          </div>
        </section>

        <form.AppForm>
          <form.Form className='space-y-6'>
            {submitUiError ? (
              <Alert variant='destructive'>
                <AlertDescription className='space-y-3'>
                  <span>{submitUiError.description}</span>
                  {submitUiError.showSignInLink ? (
                    <Link href='/auth/sign-in' className='block underline underline-offset-4'>
                      Iniciar sesión
                    </Link>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormTextField
                name='firstName'
                label='Nombre'
                required
                placeholder='Tu nombre'
                validators={{ onBlur: z.string().trim().min(1, 'Ingresá tu nombre.') }}
              />
              <FormTextField name='lastName' label='Apellido' placeholder='Tu apellido' />
            </div>
            <FormTextField
              name='password'
              label='Contraseña'
              required
              type='password'
              placeholder='Al menos 8 caracteres'
              validators={{
                onBlur: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')
              }}
            />
            <form.SubmitButton className='w-full'>Crear cuenta y entrar</form.SubmitButton>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

function getInvitationUiError(error: unknown): InvitationUiError {
  if (!isApiError(error)) {
    return {
      title: 'No pudimos cargar la invitación',
      description: 'No pudimos conectar con ViewPro. Volvé a intentarlo más tarde.'
    };
  }

  const message = error.message.toLowerCase();

  if (error.status === 404) {
    return {
      title: 'Link inválido',
      description:
        'El link de invitación no es válido. Revisá el enlace o pedí una nueva invitación.'
    };
  }

  if (error.status === 409) {
    return {
      title: 'Email ya registrado',
      description: 'Este email ya está registrado. Iniciá sesión para continuar con ViewPro.',
      showSignInLink: true
    };
  }

  if (error.status === 410 && message.includes('expired')) {
    return {
      title: 'Invitación expirada',
      description: 'Esta invitación expiró. Pedile a la inmobiliaria que te envíe un nuevo link.'
    };
  }

  if (error.status === 410 && message.includes('accepted')) {
    return {
      title: 'Invitación ya aceptada',
      description: 'Esta invitación ya fue aceptada. Iniciá sesión para acceder al portal.',
      showSignInLink: true
    };
  }

  if (error.status === 410) {
    return {
      title: 'Invitación no disponible',
      description: 'Esta invitación ya no está disponible. Pedí una nueva invitación.'
    };
  }

  if (error.status === 400) {
    return {
      title: 'Revisá los datos',
      description: getApiErrorMessage(error)
    };
  }

  return {
    title: 'No pudimos completar la operación',
    description: 'No pudimos completar la operación. Volvé a intentarlo más tarde.'
  };
}

function formatPropertyAddress(invitation: OwnerInvitationResponse) {
  return [
    invitation.property.addressLine,
    invitation.property.city,
    invitation.property.province
  ].join(', ');
}
