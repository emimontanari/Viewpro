'use client';

// D11/D13: page-local step-up gate — no global provider (dies with the page,
// e.g. logout unmount clears it). Holds the stashed retry closure and the
// StepUpDialog's controlled props. handleStepUpError is the single seam
// mutation onError handlers call to decide "is this STEP_UP_REQUIRED, and if
// so, should I re-run the original mutation after the operator re-enters
// their password?" A wrong password (401 from stepUp) is scoped to this
// hook's inline error state — it NEVER triggers a logout or redirect (D13,
// AC7 counterpart on the FE side).
import * as React from 'react';
import {
  isStepUpRequiredError,
  isApiError,
  isSessionExpiredError,
  getApiErrorMessage,
  redirectToSignIn
} from '@/lib/api-client';
import { stepUp } from '@/lib/session';

export function useStepUpGate() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const pendingRetryRef = React.useRef<(() => void) | null>(null);

  const handleStepUpError = React.useCallback((stepUpError: unknown, retry: () => void): boolean => {
    if (!isStepUpRequiredError(stepUpError)) {
      return false;
    }

    // Latest wins: a second destructive action that also 403s while the
    // modal is already open re-stashes the newer retry closure.
    pendingRetryRef.current = retry;
    setError(undefined);
    setIsOpen(true);
    return true;
  }, []);

  // Operator dismissed the modal (Escape / overlay / X-icon / Cancel button).
  // Abandon cleanly: drop the stashed retry so a later, unrelated destructive
  // action can never accidentally reuse it, clear any inline wrong-password
  // error, and close. Dismissing NEVER runs the pending mutation and NEVER
  // triggers a logout — it is a pure cancel of the in-progress step-up.
  const onOpenChange = React.useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      return;
    }

    pendingRetryRef.current = null;
    setError(undefined);
    setIsOpen(false);
  }, []);

  const onSubmit = React.useCallback(async (password: string) => {
    setIsVerifying(true);
    setError(undefined);

    try {
      await stepUp(password);

      const retry = pendingRetryRef.current;
      pendingRetryRef.current = null;
      setIsOpen(false);
      retry?.();
    } catch (submitError) {
      // /auth/step-up is exempt from the global 401 interceptor, so an ACCESS
      // session that expired mid-modal surfaces here as an AuthGuard 401
      // ("Authentication required", thrown BEFORE the password is checked and
      // clearing both cookies). Treating that like a wrong password would tell
      // the operator their CORRECT password is invalid forever. Distinguish it
      // and bounce to sign-in — reusing the same mechanism as the api-client
      // interceptor — instead of showing the inline error (JD).
      if (isSessionExpiredError(submitError)) {
        pendingRetryRef.current = null;
        setIsOpen(false);
        redirectToSignIn();
        return;
      }

      // Wrong password (401 "Invalid password") — or any other stepUp failure —
      // stays inline in the modal. Never a logout, never a redirect.
      const message = isApiError(submitError)
        ? 'Contraseña incorrecta'
        : getApiErrorMessage(submitError);
      setError(message);
    } finally {
      setIsVerifying(false);
    }
  }, []);

  return {
    dialogProps: { open: isOpen, isVerifying, error, onSubmit, onOpenChange },
    handleStepUpError
  };
}
