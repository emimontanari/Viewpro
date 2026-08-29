'use client';

import * as React from 'react';
import * as z from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { getApiErrorMessage, isApiError } from '@/lib/api-client';
import { resetPassword } from '@/lib/session';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AuthShell } from './auth-shell';

type ResetPasswordValues = {
  password: string;
  confirmPassword: string;
};

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirmPassword: z.string()
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword']
  });

// `verify-email` and `reset-password` share the `AUTH_TOKEN_INVALID` code — it does not
// distinguish invalid from expired, so each view supplies its own flow-specific recovery copy.
function getResetPasswordErrorMessage(error: unknown): string {
  if (isApiError(error) && error.errorCode === 'AUTH_TOKEN_INVALID') {
    return 'El link para restablecer la contraseña es inválido o expiró. Pedí un nuevo link desde "olvidé mi contraseña".';
  }

  return getApiErrorMessage(error);
}

function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const { FormTextField } = useFormFields<ResetPasswordValues>();
  const form = useAppForm({
    defaultValues: {
      password: '',
      confirmPassword: ''
    } as ResetPasswordValues,
    validators: {
      onSubmit: resetPasswordSchema
    },
    onSubmit: async ({ value }) => {
      setErrorMessage(null);

      try {
        await resetPassword({ token, password: value.password });
        toast.success('Contraseña actualizada. Ya podés iniciar sesión.');
        router.push('/auth/sign-in');
        router.refresh();
      } catch (error) {
        setErrorMessage(getResetPasswordErrorMessage(error));
      }
    }
  });

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Nueva contraseña</CardTitle>
        <p className='text-muted-foreground'>Elegí una contraseña nueva para tu cuenta.</p>
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
              name='password'
              label='Contraseña nueva'
              required
              type='password'
              placeholder='Al menos 8 caracteres'
              validators={{
                onBlur: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')
              }}
            />
            <FormTextField
              name='confirmPassword'
              label='Repetir contraseña'
              required
              type='password'
              placeholder='Repetí la contraseña'
            />
            <form.SubmitButton className='w-full'>Guardar contraseña</form.SubmitButton>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

function InvalidResetLink() {
  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Link inválido</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Alert variant='destructive'>
          <AlertDescription>
            Este link para restablecer la contraseña es inválido o está incompleto.
          </AlertDescription>
        </Alert>
        <Link
          href='/auth/forgot-password'
          className='hover:text-primary text-sm underline underline-offset-4'
        >
          Pedir un nuevo link
        </Link>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordViewPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  return (
    <AuthShell>
      {token ? <ResetPasswordForm token={token} /> : <InvalidResetLink />}
      <p className='text-muted-foreground px-8 text-center text-sm'>
        <Link href='/auth/sign-in' className='hover:text-primary underline underline-offset-4'>
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
