'use client';

import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { resendVerification } from '@/lib/session';
import { useSession } from '@/lib/session-context';
import { toast } from 'sonner';

export function EmailVerificationBanner() {
  const { session } = useSession();
  const [sending, setSending] = React.useState(false);

  // Only shown for authenticated users whose email is not yet verified.
  if (!session || session.user.emailVerifiedAt) {
    return null;
  }

  const handleResend = async () => {
    setSending(true);

    try {
      await resendVerification();
      // Only what the system can back. The API catches and logs send failures
      // (resend-email-verification.use-case.ts), so a resolved call proves the
      // request was accepted — not that a message left, and not that it arrived.
      toast.success(
        `Pedimos un nuevo email de verificación para ${session.user.email}. Puede tardar unos minutos.`
      );
    } catch {
      toast.error('No pudimos reenviar el email. Probá de nuevo en un momento.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className='px-4 pt-4 md:px-6'>
      <Alert>
        <AlertTitle>Verificá tu email</AlertTitle>
        <AlertDescription className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <span>
            Enviamos un link de verificación a {session.user.email}. Si no llegó, revisá spam o
            pedí uno nuevo.
          </span>
          <Button size='sm' variant='outline' onClick={handleResend} disabled={sending}>
            {sending ? 'Enviando…' : 'Reenviar email'}
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
