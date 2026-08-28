'use client';

import * as React from 'react';
import * as z from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { getApiErrorMessage } from '@/lib/api-client';
import { requestPasswordReset } from '@/lib/session';
import Link from 'next/link';
import { AuthShell } from './auth-shell';

type ForgotPasswordValues = {
  email: string;
};

export const forgotPasswordSchema = z.object({
  email: z.email('Ingresá un email válido.')
});

// Shown on success regardless of whether the account exists (no email enumeration).
const GENERIC_CONFIRMATION =
  'Si existe una cuenta con ese email, va a recibir un link para restablecer la contraseña. Puede tardar unos minutos; revisá también el spam.';

function ForgotPasswordForm() {
  const [submitted, setSubmitted] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const { FormTextField } = useFormFields<ForgotPasswordValues>();
  const form = useAppForm({
    defaultValues: {
      email: ''
    } as ForgotPasswordValues,
    validators: {
      onSubmit: forgotPasswordSchema
    },
    onSubmit: async ({ value }) => {
      setErrorMessage(null);

      try {
        await requestPasswordReset(value);
        setSubmitted(true);
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error));
      }
    }
  });

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Restablecer contraseña</CardTitle>
        <p className='text-muted-foreground'>
          Ingresá tu email y te enviaremos un link para crear una nueva contraseña.
        </p>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <Alert>
            <AlertDescription>{GENERIC_CONFIRMATION}</AlertDescription>
          </Alert>
        ) : (
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
              <form.SubmitButton className='w-full'>Enviar link</form.SubmitButton>
            </form.Form>
          </form.AppForm>
        )}
      </CardContent>
    </Card>
  );
}

export default function ForgotPasswordViewPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
      <p className='text-muted-foreground px-8 text-center text-sm'>
        <Link href='/auth/sign-in' className='hover:text-primary underline underline-offset-4'>
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
