'use client';

import * as React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api-client';
import { verifyEmail } from '@/lib/session';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthShell } from './auth-shell';

type VerifyStatus = 'verifying' | 'success' | 'error';

function VerifyEmailCard({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<VerifyStatus>('verifying');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const hasRun = React.useRef(false);

  React.useEffect(() => {
    if (hasRun.current) {
      return;
    }
    hasRun.current = true;

    verifyEmail({ token })
      .then(() => {
        setStatus('success');
        // Refresh the cached session so the "verify your email" banner clears.
        void queryClient.invalidateQueries({ queryKey: ['session'] });
      })
      .catch((error) => {
        setErrorMessage(getApiErrorMessage(error));
        setStatus('error');
      });
  }, [token, queryClient]);

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Verificación de email</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {status === 'verifying' ? (
          <p className='text-muted-foreground'>Verificando tu email…</p>
        ) : null}

        {status === 'success' ? (
          <>
            <Alert>
              <AlertDescription>
                ¡Listo! Tu email quedó verificado.
              </AlertDescription>
            </Alert>
            <Link href='/dashboard' className={cn(buttonVariants(), 'w-full')}>
              Ir al panel
            </Link>
          </>
        ) : null}

        {status === 'error' ? (
          <>
            <Alert variant='destructive'>
              <AlertDescription>
                {errorMessage ?? 'El link de verificación es inválido o expiró.'}
              </AlertDescription>
            </Alert>
            <p className='text-muted-foreground text-sm'>
              Iniciá sesión y pedí un nuevo link de verificación desde el panel.
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MissingTokenCard() {
  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Link inválido</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert variant='destructive'>
          <AlertDescription>
            Este link de verificación es inválido o está incompleto.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailViewPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  return (
    <AuthShell>
      {token ? <VerifyEmailCard token={token} /> : <MissingTokenCard />}
      <p className='text-muted-foreground px-8 text-center text-sm'>
        <Link href='/auth/sign-in' className='hover:text-primary underline underline-offset-4'>
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
