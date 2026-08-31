import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BffError, clearLatestApplicationRequestId } from '@/lib/bff-client';
import { submitFeedback } from '../api/service';
import { FeedbackWidget, feedbackFailureCopy } from './feedback-widget';

vi.mock('../api/service', () => ({ submitFeedback: vi.fn() }));
vi.mock('@/lib/bff-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bff-client')>()),
  clearLatestApplicationRequestId: vi.fn()
}));

const submitFeedbackMock = vi.mocked(submitFeedback);
const clearRequestIdMock = vi.mocked(clearLatestApplicationRequestId);
const description = 'No puedo guardar los cambios del inmueble.';

describe('FeedbackWidget', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('opens the accessible floating form with exactly the two bounded choices', async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);

    const trigger = screen.getByRole('button', { name: 'Enviar comentarios' });
    expect(trigger).toHaveAttribute('title', 'Enviar comentarios');
    await user.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Enviar comentarios' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'ERROR' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'SUGGESTION' })).toBeInTheDocument();
    expect(screen.getByLabelText('Contanos qué pasó')).toHaveAttribute('minlength', '10');
    expect(screen.getByText('0 / 2000')).toBeInTheDocument();
    expect(screen.queryByLabelText(/request.?id/i)).not.toBeInTheDocument();
  });

  it('locally rejects descriptions outside the safe boundary', async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole('button', { name: 'Enviar comentarios' }));
    await user.type(screen.getByLabelText('Contanos qué pasó'), 'corto');
    await user.click(screen.getByRole('button', { name: 'Enviar feedback' }));

    expect(screen.getByRole('alert')).toHaveTextContent('al menos 10 caracteres');
    expect(submitFeedbackMock).not.toHaveBeenCalled();
  });

  it('prevents duplicate submits while showing progress', async () => {
    const user = userEvent.setup();
    let resolveSubmission!: () => void;
    submitFeedbackMock.mockReturnValueOnce(new Promise((resolve) => (resolveSubmission = () => resolve({ accepted: true }))));
    render(<FeedbackWidget />);
    await user.click(screen.getByRole('button', { name: 'Enviar comentarios' }));
    await user.type(screen.getByLabelText('Contanos qué pasó'), description);
    const submit = screen.getByRole('button', { name: 'Enviar feedback' });
    await user.click(submit);
    await user.click(submit);

    expect(submitFeedbackMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Enviando feedback' })).toBeDisabled();
    resolveSubmission();
    expect(await screen.findByText('Tu comentario fue recibido.')).toBeInTheDocument();
  });

  it('shows durable success for accepted reports and resets only after completion', async () => {
    const user = userEvent.setup();
    submitFeedbackMock.mockResolvedValueOnce({ accepted: true });
    render(<FeedbackWidget />);
    await user.click(screen.getByRole('button', { name: 'Enviar comentarios' }));
    await user.type(screen.getByLabelText('Contanos qué pasó'), description);
    await user.click(screen.getByRole('button', { name: 'Enviar feedback' }));

    expect(await screen.findByText('Tu comentario fue recibido.')).toBeInTheDocument();
    expect(screen.getByText('La recepción quedó registrada.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    await user.click(screen.getByRole('button', { name: 'Enviar comentarios' }));
    expect(screen.getByLabelText('Contanos qué pasó')).toHaveValue('');
  });

  it('preserves a generic failure through close and retry without rendering backend prose', async () => {
    const user = userEvent.setup();
    const failure = new BffError(500);
    Object.defineProperty(failure, 'message', { value: 'hostile backend prose' });
    submitFeedbackMock.mockRejectedValueOnce(failure).mockResolvedValueOnce({ accepted: true });
    render(<FeedbackWidget />);
    await user.click(screen.getByRole('button', { name: 'Enviar comentarios' }));
    await user.type(screen.getByLabelText('Contanos qué pasó'), description);
    await user.click(screen.getByRole('button', { name: 'Enviar feedback' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos enviar tu comentario');
    expect(screen.queryByText('hostile backend prose')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Enviar comentarios' }));
    expect(screen.getByLabelText('Contanos qué pasó')).toHaveValue(description);
    await user.click(screen.getByRole('button', { name: 'Reintentar envío' }));
    await waitFor(() => expect(submitFeedbackMock).toHaveBeenLastCalledWith({ type: 'ERROR', description }));
  });

  it('resets preserved values only when the member explicitly discards them', async () => {
    const user = userEvent.setup();
    submitFeedbackMock.mockRejectedValueOnce(new BffError(500));
    render(<FeedbackWidget />);
    await user.click(screen.getByRole('button', { name: 'Enviar comentarios' }));
    await user.type(screen.getByLabelText('Contanos qué pasó'), description);
    await user.click(screen.getByRole('button', { name: 'Enviar feedback' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.getByLabelText('Contanos qué pasó')).toHaveValue('');
  });

  it('gives rolling-limit and session guidance using structured status only', async () => {
    const user = userEvent.setup();
    submitFeedbackMock.mockRejectedValueOnce(new BffError(429)).mockRejectedValueOnce(new BffError(401));
    render(<FeedbackWidget />);
    await user.click(screen.getByRole('button', { name: 'Enviar comentarios' }));
    await user.type(screen.getByLabelText('Contanos qué pasó'), description);
    await user.click(screen.getByRole('button', { name: 'Enviar feedback' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ventana de diez minutos');
    expect(screen.getByLabelText('Contanos qué pasó')).toHaveValue(description);
    await user.click(screen.getByRole('button', { name: 'Reintentar envío' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sesión');
  });

  it('clears request provenance for every mount and unmount', () => {
    clearRequestIdMock.mockClear();
    const first = render(<FeedbackWidget />);
    expect(clearRequestIdMock).toHaveBeenCalledTimes(1);
    first.unmount();
    expect(clearRequestIdMock).toHaveBeenCalledTimes(2);
    const second = render(<FeedbackWidget />);
    expect(clearRequestIdMock).toHaveBeenCalledTimes(3);
    second.unmount();
    expect(clearRequestIdMock).toHaveBeenCalledTimes(4);
  });

  it('maps equal structured failures identically regardless of message-shaped data', () => {
    expect(feedbackFailureCopy({ status: 500, message: 'one' } as never)).toBe(
      feedbackFailureCopy({ status: 500, message: 'another' } as never)
    );
    expect(feedbackFailureCopy({ status: 429 })).toContain('diez minutos');
  });
});
