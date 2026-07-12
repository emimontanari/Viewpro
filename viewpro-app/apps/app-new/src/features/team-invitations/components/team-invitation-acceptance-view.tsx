'use client';

import * as React from 'react';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { InteractiveGridPattern } from '@/features/auth/components/interactive-grid';
import { getApiErrorMessage, isApiError } from '@/lib/api-client';
import { BRAND } from '@/lib/brand/brand';
import { getSessionWithRefresh, type Session } from '@/lib/session';
import { setSelectedTenantId } from '@/lib/tenant-selection';
import { cn } from '@/lib/utils';
import { acceptTeamInvitation, getTeamInvitation } from '../api/service';
import type { TeamInvitationResponse } from '../api/types';

type TeamInvitationAcceptanceViewProps = {
  token: string;
};

type RegisterValues = {
  firstName: string;
  lastName: string;
  password: string;
};

type LoginValues = {
  password: string;
};

type InvitationUiError = {
  title: string;
  description: string;
  showSignInLink?: boolean;
};

const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'Ingresá tu nombre.'),
  lastName: z.string(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')
});

const loginSchema = z.object({
  password: z.string().min(8, 'Ingresá tu contraseña.')
});

export function TeamInvitationAcceptanceView({ token }: TeamInvitationAcceptanceViewProps) {
  const router = useRouter();
  const [invitation, setInvitation] = React.useState<TeamInvitationResponse | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [loadError, setLoadError] = React.useState<unknown>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [submitError, setSubmitError] = React.useState<unknown>(null);
  const [isAcceptingSession, setIsAcceptingSession] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setInvitation(null);
    setSession(null);
    setLoadError(null);
    setSubmitError(null);
    setIsAcceptingSession(false);

    Promise.allSettled([getTeamInvitation(token), getSessionWithRefresh()])
      .then(([invitationResult, sessionResult]) => {
        if (cancelled) {
          return;
        }

        if (invitationResult.status === 'fulfilled') {
          setInvitation(invitationResult.value);
          setLoadError(null);
        } else {
          setInvitation(null);
          setLoadError(invitationResult.reason);
        }

        setSession(sessionResult.status === 'fulfilled' ? sessionResult.value : null);
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

  async function handleAccepted(
    acceptedSession: Session,
    acceptedInvitation: TeamInvitationResponse
  ) {
    const invitedMembership = acceptedSession.memberships.find(
      (membership) => membership.tenant.id === acceptedInvitation.tenant.id
    );

    setSelectedTenantId(invitedMembership?.tenant.id ?? acceptedInvitation.tenant.id);
    router.push('/dashboard');
    router.refresh();
  }

  async function submitRegister(value: RegisterValues) {
    if (!invitation) {
      return;
    }

    setSubmitError(null);

    try {
      const acceptedSession = await acceptTeamInvitation(token, {
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim() || undefined,
        mode: 'register',
        password: value.password
      });
      await handleAccepted(acceptedSession, invitation);
    } catch (error) {
      setSubmitError(error);
    }
  }

  async function submitLogin(value: LoginValues) {
    if (!invitation) {
      return;
    }

    setSubmitError(null);

    try {
      const acceptedSession = await acceptTeamInvitation(token, {
        mode: 'login',
        password: value.password
      });
      await handleAccepted(acceptedSession, invitation);
    } catch (error) {
      setSubmitError(error);
    }
  }

  async function submitCurrentSession() {
    if (!invitation || isAcceptingSession) {
      return;
    }

    setSubmitError(null);
    setIsAcceptingSession(true);

    try {
      const acceptedSession = await acceptTeamInvitation(token, { mode: 'current-session' });
      await handleAccepted(acceptedSession, invitation);
    } catch (error) {
      setSubmitError(error);
    } finally {
      setIsAcceptingSession(false);
    }
  }

  const sessionEmail = session?.user.email.toLowerCase() ?? null;
  const invitationEmail = invitation?.email.toLowerCase() ?? null;
  const isMatchingSession = Boolean(
    sessionEmail && invitationEmail && sessionEmail === invitationEmail
  );
  const isWrongSession = Boolean(
    sessionEmail && invitationEmail && sessionEmail !== invitationEmail
  );

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
            <>
              {isWrongSession ? (
                <WrongAccountCard
                  invitation={invitation}
                  session={session}
                  submitError={submitError}
                />
              ) : null}
              {!isWrongSession && !invitation.emailRegistered ? (
                <RegisterCard
                  invitation={invitation}
                  onSubmit={submitRegister}
                  submitError={submitError}
                />
              ) : null}
              {!isWrongSession && invitation.emailRegistered && isMatchingSession ? (
                <CurrentSessionCard
                  invitation={invitation}
                  isSubmitting={isAcceptingSession}
                  onAccept={submitCurrentSession}
                  session={session}
                  submitError={submitError}
                />
              ) : null}
              {!isWrongSession && invitation.emailRegistered && !isMatchingSession ? (
                <ExistingPasswordCard
                  invitation={invitation}
                  onSubmit={submitLogin}
                  submitError={submitError}
                />
              ) : null}
              <TermsText />
            </>
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
        {BRAND.auth.invitationLabel}
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
            &ldquo;Cada incorporación al equipo queda conectada al tenant correcto desde el primer
            acceso.&rdquo;
          </p>
          <footer className='text-sidebar-foreground/70 text-sm'>{BRAND.auth.testimonialAuthor}</footer>
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
        <p className='text-muted-foreground'>Estamos verificando el link de acceso al equipo.</p>
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

function InvitationSummary({ invitation }: { invitation: TeamInvitationResponse }) {
  return (
    <section className='bg-muted/40 rounded-lg border p-4'>
      <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
        Inmobiliaria invitante
      </p>
      <h2 className='mt-2 text-lg font-semibold'>{invitation.tenant.name}</h2>
      <div className='mt-4 grid gap-3 sm:grid-cols-2'>
        <div className='space-y-1'>
          <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
            Email invitado
          </p>
          <p className='text-sm font-medium'>{invitation.email}</p>
        </div>
        <div className='space-y-1'>
          <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>Rol</p>
          <p className='text-sm font-medium'>{getRoleLabel(invitation.role)}</p>
        </div>
      </div>
    </section>
  );
}

function RegisterCard({
  invitation,
  onSubmit,
  submitError
}: {
  invitation: TeamInvitationResponse;
  onSubmit: (value: RegisterValues) => Promise<void>;
  submitError: unknown;
}) {
  const { FormTextField } = useFormFields<RegisterValues>();
  const form = useAppForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      password: ''
    } as RegisterValues,
    validators: {
      onSubmit: registerSchema
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    }
  });
  const submitUiError = submitError ? getInvitationUiError(submitError) : null;

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Aceptar invitación de equipo</CardTitle>
        <p className='text-muted-foreground'>
          Completá tus datos para crear tu cuenta y sumarte a {invitation.tenant.name}.
        </p>
      </CardHeader>
      <CardContent className='space-y-6'>
        <InvitationSummary invitation={invitation} />
        <form.AppForm>
          <form.Form className='space-y-6'>
            {submitUiError ? <SubmitErrorAlert error={submitUiError} /> : null}
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

function ExistingPasswordCard({
  invitation,
  onSubmit,
  submitError
}: {
  invitation: TeamInvitationResponse;
  onSubmit: (value: LoginValues) => Promise<void>;
  submitError: unknown;
}) {
  const { FormTextField } = useFormFields<LoginValues>();
  const form = useAppForm({
    defaultValues: { password: '' } as LoginValues,
    validators: {
      onSubmit: loginSchema
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    }
  });
  const submitUiError = submitError ? getInvitationUiError(submitError) : null;

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Aceptar invitación de equipo</CardTitle>
        <p className='text-muted-foreground'>
          Este email ya tiene cuenta. Ingresá tu contraseña para sumarte a {invitation.tenant.name}.
        </p>
      </CardHeader>
      <CardContent className='space-y-6'>
        <InvitationSummary invitation={invitation} />
        <form.AppForm>
          <form.Form className='space-y-6'>
            {submitUiError ? <SubmitErrorAlert error={submitUiError} /> : null}
            <FormTextField
              name='password'
              label='Contraseña'
              required
              type='password'
              placeholder='Tu contraseña actual'
              validators={{ onBlur: z.string().min(8, 'Ingresá tu contraseña.') }}
            />
            <form.SubmitButton className='w-full'>Aceptar invitación</form.SubmitButton>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

function CurrentSessionCard({
  invitation,
  isSubmitting,
  onAccept,
  session,
  submitError
}: {
  invitation: TeamInvitationResponse;
  isSubmitting: boolean;
  onAccept: () => Promise<void>;
  session: Session | null;
  submitError: unknown;
}) {
  const submitUiError = submitError ? getInvitationUiError(submitError) : null;

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Aceptar invitación de equipo</CardTitle>
        <p className='text-muted-foreground'>
          Ya estás conectado como {session?.user.email}. Podés aceptar esta invitación directamente.
        </p>
      </CardHeader>
      <CardContent className='space-y-6'>
        <InvitationSummary invitation={invitation} />
        {submitUiError ? <SubmitErrorAlert error={submitUiError} /> : null}
        <Button className='w-full' disabled={isSubmitting} onClick={onAccept} type='button'>
          {isSubmitting ? 'Aceptando invitación...' : 'Aceptar invitación'}
        </Button>
      </CardContent>
    </Card>
  );
}

function WrongAccountCard({
  invitation,
  session,
  submitError
}: {
  invitation: TeamInvitationResponse;
  session: Session | null;
  submitError: unknown;
}) {
  const submitUiError = submitError ? getInvitationUiError(submitError) : null;

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Usá el email invitado</CardTitle>
        <p className='text-muted-foreground'>
          Esta invitación pertenece a {invitation.email}, pero la sesión actual es{' '}
          {session?.user.email}.
        </p>
      </CardHeader>
      <CardContent className='space-y-6'>
        <InvitationSummary invitation={invitation} />
        <Alert variant='destructive'>
          <AlertDescription>
            Cerrá sesión e ingresá con el email invitado para aceptar esta invitación.
          </AlertDescription>
        </Alert>
        {submitUiError ? <SubmitErrorAlert error={submitUiError} /> : null}
      </CardContent>
    </Card>
  );
}

function SubmitErrorAlert({ error }: { error: InvitationUiError }) {
  return (
    <Alert variant='destructive'>
      <AlertDescription className='space-y-3'>
        <span>{error.description}</span>
        {error.showSignInLink ? (
          <Link href='/auth/sign-in' className='block underline underline-offset-4'>
            Iniciar sesión
          </Link>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function TermsText() {
  return (
    <p className='text-muted-foreground px-8 text-center text-sm'>
      Al continuar, aceptás nuestros{' '}
      <Link href='/terms-of-service' className='hover:text-primary underline underline-offset-4'>
        términos de servicio
      </Link>{' '}
      y nuestra{' '}
      <Link href='/privacy-policy' className='hover:text-primary underline underline-offset-4'>
        política de privacidad
      </Link>
      .
    </p>
  );
}

function getInvitationUiError(error: unknown): InvitationUiError {
  if (!isApiError(error)) {
    return {
      title: 'No pudimos cargar la invitación',
      description: BRAND.auth.invitationConnectError
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

  if (error.status === 410 && message.includes('expired')) {
    return {
      title: 'Invitación expirada',
      description: 'Esta invitación expiró. Pedile a la inmobiliaria que te envíe un nuevo link.'
    };
  }

  if (error.status === 410 && message.includes('accepted')) {
    return {
      title: 'Invitación ya aceptada',
      description: BRAND.auth.teamInvitationAlreadyAccepted,
      showSignInLink: true
    };
  }

  if (error.status === 410) {
    return {
      title: 'Invitación no disponible',
      description: 'Esta invitación ya no está disponible. Pedí una nueva invitación.'
    };
  }

  if (error.status === 409) {
    return {
      title: 'Ya pertenecés a esta inmobiliaria',
      description:
        'Este usuario ya pertenece a la inmobiliaria invitante. Iniciá sesión para continuar.',
      showSignInLink: true
    };
  }

  if (error.status === 401) {
    return {
      title: 'No pudimos validar tus credenciales',
      description: 'Revisá tu contraseña y volvé a intentarlo.'
    };
  }

  if (error.status === 403) {
    return {
      title: 'Usá el email invitado',
      description:
        'Esta invitación pertenece a otro email. Cerrá sesión e ingresá con el email invitado.'
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

function getRoleLabel(role: TeamInvitationResponse['role']) {
  return role === 'MANAGER' ? 'Encargado' : 'Vendedor';
}
