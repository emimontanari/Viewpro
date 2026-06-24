'use client';

import * as React from 'react';
import * as z from 'zod';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { getApiErrorMessage } from '@/lib/api-client';
import { BRAND } from '@/lib/brand/brand';
import { registerTenant } from '@/lib/session';
import { setSelectedTenantId } from '@/lib/tenant-selection';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InteractiveGridPattern } from './interactive-grid';

type SignUpValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  tenantName: string;
};

const signUpSchema = z.object({
  firstName: z.string().min(1, 'Ingresá tu nombre.'),
  lastName: z.string(),
  email: z.email('Ingresá un email válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  tenantName: z.string().min(2, 'Ingresá el nombre de tu inmobiliaria.')
});

function SignUpForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const { FormTextField } = useFormFields<SignUpValues>();
  const form = useAppForm({
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      tenantName: ''
    } as SignUpValues,
    validators: {
      onSubmit: signUpSchema
    },
    onSubmit: async ({ value }) => {
      setErrorMessage(null);

      try {
        const session = await registerTenant({
          email: value.email,
          firstName: value.firstName,
          lastName: value.lastName || undefined,
          password: value.password,
          tenantName: value.tenantName
        });

        if (session.memberships[0]) {
          setSelectedTenantId(session.memberships[0].tenant.id);
        }

        router.push('/dashboard');
        router.refresh();
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error));
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
          {BRAND.auth.signUpLabel}
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
              &ldquo;{BRAND.auth.testimonialQuote}&rdquo;
            </p>
            <footer className='text-sidebar-foreground/70 text-sm'>{BRAND.auth.testimonialAuthor}</footer>
          </blockquote>
        </div>
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
