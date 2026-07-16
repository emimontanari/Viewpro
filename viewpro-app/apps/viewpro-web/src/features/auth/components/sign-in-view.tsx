'use client';

import * as React from 'react';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { getApiErrorMessage } from '@/lib/api-client';
import { BRAND } from '@/lib/brand/brand';
import { login } from '@/lib/session';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { InteractiveGridPattern } from './interactive-grid';

type SignInValues = {
  email: string;
  password: string;
};

const DEFAULT_SIGN_IN_REDIRECT = '/dashboard';

// D8: shown when the operator lands on sign-in via the api-client 401
// interceptor's `reason=session_expired` redirect (D7).
const SESSION_EXPIRED_COPY = 'Tu sesión expiró. Iniciá sesión de nuevo para continuar.';

const signInSchema = z.object({
  email: z.email('Ingresá un email válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')
});

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(() =>
    searchParams.get('reason') === 'session_expired' ? SESSION_EXPIRED_COPY : null
  );
  const { FormTextField } = useFormFields<SignInValues>();
  const form = useAppForm({
    defaultValues: {
      email: '',
      password: ''
    } as SignInValues,
    validators: {
      onSubmit: signInSchema
    },
    onSubmit: async ({ value }) => {
      setErrorMessage(null);

      try {
        await login(value);
        router.push(getSafeSignInRedirect(searchParams.get('redirect_url')));
        router.refresh();
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error));
      }
    }
  });

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Iniciar sesión</CardTitle>
        <p className='text-muted-foreground'>Ingresá tus credenciales para acceder a tu cuenta.</p>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form.Form className='space-y-6'>
            {errorMessage ? (
              <Alert variant='destructive'>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
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
              placeholder='Tu contraseña'
              validators={{
                onBlur: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')
              }}
            />
            <form.SubmitButton className='w-full'>Entrar</form.SubmitButton>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

export function getSafeSignInRedirect(redirectUrl: string | null) {
  if (!redirectUrl) {
    return DEFAULT_SIGN_IN_REDIRECT;
  }

  if (!redirectUrl.startsWith('/') || redirectUrl.startsWith('//')) {
    return DEFAULT_SIGN_IN_REDIRECT;
  }

  const rawPath = redirectUrl.split(/[?#]/, 1)[0];
  const hasSafeRawPath = isSafeAppRedirectPath(rawPath);

  if (!hasSafeRawPath || hasPathTraversal(rawPath)) {
    return DEFAULT_SIGN_IN_REDIRECT;
  }

  try {
    const url = new URL(redirectUrl, 'http://viewpro.local');
    const isRelativeUrl = url.origin === 'http://viewpro.local';

    if (!isRelativeUrl || !isSafeAppRedirectPath(url.pathname)) {
      return DEFAULT_SIGN_IN_REDIRECT;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_SIGN_IN_REDIRECT;
  }
}

function isSafeAppRedirectPath(pathname: string) {
  // Operator console only has /dashboard* protected paths.
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function hasPathTraversal(path: string) {
  const normalizedPath = path.toLowerCase();

  return (
    normalizedPath.includes('%2e') ||
    path.includes('/../') ||
    path.endsWith('/..') ||
    path.includes('/./') ||
    path.endsWith('/.')
  );
}

export default function SignInViewPage() {
  return (
    <div className='relative flex min-h-screen flex-col items-center justify-center overflow-hidden md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <div className='relative hidden h-full flex-col p-10 lg:flex dark:border-r'>
        <div className='absolute inset-0 bg-sidebar' />
        <div className='relative z-20 flex items-center'>
          <Image
            src='/logo-theme-claro.png'
            alt={BRAND.auth.signInLabel}
            width={2048}
            height={1365}
            priority
            className='h-auto w-48 dark:hidden'
          />
          <Image
            src='/logo-inmoview-dark.png'
            alt={BRAND.auth.signInLabel}
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
          <SignInForm />
          <div className='text-muted-foreground space-y-2 px-8 text-center text-xs'>
            <p>{BRAND.auth.signInContinue}</p>
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
