'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { clearLatestApplicationRequestId, isBffError } from '@/lib/bff-client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { submitFeedback } from '../api/service';
import type { FeedbackType } from '../api/types';

const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 2000;
type Phase = 'editing' | 'submitting' | 'success' | 'retryable-error' | 'rate-limited';
type Failure = { errorCode?: string; status?: number };

export function feedbackFailureCopy({ errorCode, status }: Failure) {
  if (status === 429) return 'Esperá a que venza la ventana de diez minutos antes de reintentar.';
  if (status === 401 || errorCode === 'SESSION_EXPIRED') return 'Tu sesión venció. Volvé a iniciar sesión e intentá de nuevo.';
  return 'No pudimos enviar tu comentario. Conservamos lo que escribiste para que puedas reintentar.';
}

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('ERROR');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string>();
  const [failure, setFailure] = useState<Failure>();
  const [phase, setPhase] = useState<Phase>('editing');
  const submitting = useRef(false);
  const isSubmitting = phase === 'submitting';

  useEffect(() => {
    clearLatestApplicationRequestId();
    return clearLatestApplicationRequestId;
  }, []);

  function reset() {
    setDescription('');
    setPhase('editing');
    setType('ERROR');
    setFailure(undefined);
    setValidationError(undefined);
  }

  function onOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) return;
    if (!nextOpen && phase === 'success') reset();
    setOpen(nextOpen);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (description.length < MIN_DESCRIPTION_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) {
      setValidationError(`La descripción debe tener al menos ${MIN_DESCRIPTION_LENGTH} caracteres.`);
      return;
    }

    submitting.current = true;
    setValidationError(undefined);
    setPhase('submitting');
    try {
      await submitFeedback({ type, description });
      setPhase('success');
    } catch (error) {
      const nextFailure = isBffError(error) ? error : undefined;
      setFailure(nextFailure);
      setPhase(nextFailure?.status === 429 ? 'rate-limited' : 'retryable-error');
    } finally {
      submitting.current = false;
    }
  }

  const error = phase === 'rate-limited' || phase === 'retryable-error'
    ? feedbackFailureCopy(failure ?? {})
    : validationError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        aria-label='Enviar comentarios'
        className='fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 size-11 rounded-full shadow-lg'
        size='icon'
        title='Enviar comentarios'
        type='button'
        onClick={() => setOpen(true)}
      >
        <Icons.chat aria-hidden='true' />
      </Button>
      <DialogContent
        aria-describedby='feedback-description'
        onEscapeKeyDown={(event) => isSubmitting && event.preventDefault()}
        onPointerDownOutside={(event) => isSubmitting && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Enviar comentarios</DialogTitle>
          <DialogDescription id='feedback-description'>Tu comentario nos ayuda a mejorar ViewPro.</DialogDescription>
        </DialogHeader>
        {phase === 'success' ? (
          <div aria-live='polite' className='space-y-2'>
            <Icons.circleCheck aria-hidden='true' className='text-green-600' />
            <p className='font-medium'>Tu comentario fue recibido.</p>
            <p className='text-sm text-muted-foreground'>La recepción quedó registrada.</p>
          </div>
        ) : (
          <form className='space-y-5' onSubmit={submit}>
            <fieldset disabled={isSubmitting}>
              <legend className='mb-2 text-sm font-medium'>Tipo de comentario</legend>
              {(['ERROR', 'SUGGESTION'] as const).map((option) => (
                <label key={option} className='mr-4 inline-flex items-center gap-2 text-sm'>
                  <input aria-label={option} checked={type === option} name='feedback-type' type='radio' value={option} onChange={() => setType(option)} />
                  {option}
                </label>
              ))}
            </fieldset>
            <Field>
              <FieldLabel htmlFor='feedback-description-input'>Contanos qué pasó</FieldLabel>
              <Textarea
                aria-describedby='feedback-help feedback-count'
                aria-invalid={!!validationError}
                disabled={isSubmitting}
                id='feedback-description-input'
                maxLength={MAX_DESCRIPTION_LENGTH}
                minLength={MIN_DESCRIPTION_LENGTH}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <div className='flex justify-between gap-3 text-xs text-muted-foreground'>
                <FieldDescription id='feedback-help'>Entre 10 y 2000 caracteres.</FieldDescription>
                <span id='feedback-count'>{description.length} / {MAX_DESCRIPTION_LENGTH}</span>
              </div>
              <FieldError>{validationError}</FieldError>
            </Field>
            {error && !validationError && <p aria-live='polite' role='alert'><Icons.warning aria-hidden='true' /> {error}</p>}
            <DialogFooter>
              {(phase === 'retryable-error' || phase === 'rate-limited') && <Button disabled={isSubmitting} type='button' variant='outline' onClick={reset}>Descartar</Button>}
              <Button aria-label={isSubmitting ? 'Enviando feedback' : phase === 'editing' ? 'Enviar feedback' : 'Reintentar envío'} disabled={isSubmitting} type='submit'>
                {isSubmitting ? <Icons.spinner aria-hidden='true' className='animate-spin' /> : <Icons.send aria-hidden='true' />}
                {isSubmitting ? 'Enviando feedback' : phase === 'editing' ? 'Enviar feedback' : 'Reintentar envío'}
              </Button>
            </DialogFooter>
          </form>
        )}
        {phase === 'success' && <DialogFooter><Button type='button' onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
