'use client';

import * as React from 'react';
import * as z from 'zod';
import type { PublicErrorCode } from '@viewpro/contracts';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { getApiErrorMessage, isApiError } from '@/lib/api-client';
import { BRAND } from '@/lib/brand/brand';
import { registerTenant } from '@/lib/session';
import { setSelectedTenantId } from '@/lib/tenant-selection';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InteractiveGridPattern } from './interactive-grid';

type SignUpValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  tenantName: string;
  whatsappPhone: string;
};

const PHONE_REQUIRED_MESSAGE = 'Ingresá el teléfono de contacto de la inmobiliaria.';

const signUpSchema = z.object({
  firstName: z.string().min(1, 'Ingresá tu nombre.'),
  lastName: z.string(),
  email: z.email('Ingresá un email válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  tenantName: z.string().min(2, 'Ingresá el nombre de tu inmobiliaria.'),
  whatsappPhone: z.string().trim().min(1, PHONE_REQUIRED_MESSAGE)
});

// The client never parses or validates phone shape/country — only presence.
// Validity and the AR-only rule are decided exclusively by the server, which
// answers with one of these three codes. Mirroring that logic client-side
// would be a second rule on one column (see design.md ADR-2).
const PHONE_ERROR_MESSAGES: Partial<Record<PublicErrorCode, string>> = {
  'phone.required': PHONE_REQUIRED_MESSAGE,
  'phone.invalid': 'Ese teléfono no es válido. Revisá el número e intentá de nuevo.',
  'phone.country_unsupported': 'Por ahora solo aceptamos teléfonos de Argentina.'
};

function getPhoneErrorMessage(error: unknown): string | null {
  if (!isApiError(error) || !error.errorCode) {
    return null;
  }

  return PHONE_ERROR_MESSAGES[error.errorCode] ?? null;
}

function SignUpForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [phoneErrorMessage, setPhoneErrorMessage] = React.useState<string | null>(null);
  const { FormTextField } = useFormFields<SignUpValues>();
  const form = useAppForm({
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      tenantName: '',
      whatsappPhone: ''
    } as SignUpValues,
    validators: {
      onSubmit: signUpSchema
    },
    onSubmit: async ({ value }) => {
      setErrorMessage(null);
      setPhoneErrorMessage(null);

      try {
        // No `country` key is ever sent: the AR affordance below is
        // presentation-only, and the global ValidationPipe 400s on any
        // undeclared key before phone logic runs (design.md ADR-3).
        const session = await registerTenant({
          email: value.email,
          firstName: value.firstName,
          lastName: value.lastName || undefined,
          password: value.password,
          tenantName: value.tenantName,
          whatsappPhone: value.whatsappPhone.trim()
        });

        if (session.memberships[0]) {
          setSelectedTenantId(session.memberships[0].tenant.id);
        }

        router.push('/dashboard');
        router.refresh();
      } catch (error) {
        const phoneMessage = getPhoneErrorMessage(error);

        if (phoneMessage) {
          setPhoneErrorMessage(phoneMessage);
        } else {
          setErrorMessage(getApiErrorMessage(error));
        }
      }
    }
  });

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Crear cuenta</CardTitle>
        <p className='text-muted-foreground'>
          {BRAND.auth.signUpSubtitle}
        </p>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form.Form className='space-y-6'>
            {errorMessage ? (
              <Alert variant='destructive'>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormTextField
                name='firstName'
                label='Nombre'
                required
                placeholder='Tu nombre'
                validators={{ onBlur: z.string().min(1, 'Ingresá tu nombre.') }}
              />
              <FormTextField name='lastName' label='Apellido' placeholder='Tu apellido' />
            </div>
            <FormTextField
              name='email'
              label='Email'
              required
              type='email'
              placeholder='tu@email.com'
              validators={{ onBlur: z.email('Ingresá un email válido.') }}
            />
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
            <FormTextField
              name='tenantName'
              label='Inmobiliaria'
              required
              placeholder='Nombre de la inmobiliaria'
              validators={{ onBlur: z.string().min(2, 'Ingresá el nombre de tu inmobiliaria.') }}
            />
            <FormTextField
              name='whatsappPhone'
              label='Teléfono de contacto'
              required
              type='tel'
              placeholder='351 000 0000'
              description='Se registra como número de Argentina (+54).'
              validators={{ onBlur: z.string().trim().min(1, PHONE_REQUIRED_MESSAGE) }}
            />
            {phoneErrorMessage ? (
              <p className='text-destructive text-sm font-normal'>{phoneErrorMessage}</p>
            ) : null}
            <form.SubmitButton className='w-full'>Crear cuenta</form.SubmitButton>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

export default function SignUpViewPage() {
  return (
    <div className='relative h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
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
        <div className='relative z-20 flex items-center'>
          <Image
            src='/logo-theme-claro.png'
            alt={BRAND.auth.signUpLabel}
            width={2048}
            height={1365}
            priority
            className='h-auto w-48 dark:hidden'
          />
          <Image
            src='/logo-inmoview-dark.png'
            alt={BRAND.auth.signUpLabel}
            width={2048}
            height={1365}
            priority
            className='hidden h-auto w-48 dark:block'
          />
        </div>
        <InteractiveGridPattern
          className={cn(
            'mask-[radial-gradient(400px_circle_at_center,white,transparent)]',
            'inset-x-0 inset-y-[0%] h-full skew-y-12'
          )}
        />
      </div>
      <div className='flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='flex w-full max-w-xl flex-col items-center justify-center space-y-6'>
          <SignUpForm />
          <div className='text-muted-foreground space-y-2 px-8 text-center text-xs'>
            <p>{BRAND.auth.signUpContinue}</p>
          </div>
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
        </div>
      </div>
    </div>
  );
}
