import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toApiError, type ApiError } from '@/lib/api-client';
import { registerTenant } from '@/lib/session';
import SignUpViewPage from './sign-up-view';

vi.mock('@/lib/session', () => ({
  registerTenant: vi.fn()
}));

vi.mock('@/lib/tenant-selection', () => ({
  setSelectedTenantId: vi.fn()
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock
  })
}));

const registerTenantMock = vi.mocked(registerTenant);

const GENERIC_API_ERROR_MESSAGE = 'La solicitud falló.';

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nombre *'), 'Ana');
  await user.type(screen.getByLabelText('Email *'), 'ana@example.com');
  await user.type(screen.getByLabelText('Contraseña *'), 'test-credential-123');
  await user.type(screen.getByLabelText('Inmobiliaria *'), 'Inmobiliaria Test');
  await user.type(screen.getByLabelText('Teléfono de contacto *'), '3510000000');
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Crear cuenta/ }));
}

describe('SignUpViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits registration with exactly the known keys plus whatsappPhone, never a country key', async () => {
    const user = userEvent.setup();
    registerTenantMock.mockResolvedValueOnce({
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        firstName: 'Ana',
        lastName: undefined,
        status: 'ACTIVE',
        globalRole: 'USER',
        emailVerifiedAt: null
      },
      memberships: [],
      hasOwnerAccess: false
    });

    render(<SignUpViewPage />);
    await fillRequiredFields(user);
    await submit(user);

    await waitFor(() => {
      expect(registerTenantMock).toHaveBeenCalledTimes(1);
    });

    const submittedBody = registerTenantMock.mock.calls[0]![0];
    expect(Object.keys(submittedBody).toSorted()).toEqual(
      ['email', 'firstName', 'lastName', 'password', 'tenantName', 'whatsappPhone'].toSorted()
    );
    expect(submittedBody).not.toHaveProperty('country');
    expect(submittedBody.whatsappPhone).toBe('3510000000');
  });

  it('rejects an empty phone submission locally without a network call', async () => {
    const user = userEvent.setup();

    render(<SignUpViewPage />);
    await user.type(screen.getByLabelText('Nombre *'), 'Ana');
    await user.type(screen.getByLabelText('Email *'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña *'), 'test-credential-123');
    await user.type(screen.getByLabelText('Inmobiliaria *'), 'Inmobiliaria Test');
    await submit(user);

    expect(
      await screen.findByText('Ingresá el teléfono de contacto de la inmobiliaria.')
    ).toBeInTheDocument();
    expect(registerTenantMock).not.toHaveBeenCalled();
  });

  it('shows a distinct message for phone.required', async () => {
    const user = userEvent.setup();
    registerTenantMock.mockRejectedValueOnce(apiErrorFrom(400, { errorCode: 'phone.required' }));

    render(<SignUpViewPage />);
    await fillRequiredFields(user);
    await submit(user);

    const message = await screen.findByText(
      'Ingresá el teléfono de contacto de la inmobiliaria.'
    );
    expect(message).toBeInTheDocument();
    expect(screen.queryByText(GENERIC_API_ERROR_MESSAGE)).not.toBeInTheDocument();
  });

  it('shows a distinct message for phone.invalid', async () => {
    const user = userEvent.setup();
    registerTenantMock.mockRejectedValueOnce(apiErrorFrom(400, { errorCode: 'phone.invalid' }));

    render(<SignUpViewPage />);
    await fillRequiredFields(user);
    await submit(user);

    const message = await screen.findByText(
      'Ese teléfono no es válido. Revisá el número e intentá de nuevo.'
    );
    expect(message).toBeInTheDocument();
    expect(screen.queryByText(GENERIC_API_ERROR_MESSAGE)).not.toBeInTheDocument();
  });

  it('shows a distinct message for phone.country_unsupported', async () => {
    const user = userEvent.setup();
    registerTenantMock.mockRejectedValueOnce(
      apiErrorFrom(400, { errorCode: 'phone.country_unsupported' })
    );

    render(<SignUpViewPage />);
    await fillRequiredFields(user);
    await submit(user);

    const message = await screen.findByText('Por ahora solo aceptamos teléfonos de Argentina.');
    expect(message).toBeInTheDocument();
    expect(screen.queryByText(GENERIC_API_ERROR_MESSAGE)).not.toBeInTheDocument();
  });

  it('falls back to the generic message for a 400 with no errorCode', async () => {
    const user = userEvent.setup();
    registerTenantMock.mockRejectedValueOnce(apiErrorFrom(400, {}));

    render(<SignUpViewPage />);
    await fillRequiredFields(user);
    await submit(user);

    expect(await screen.findByText(GENERIC_API_ERROR_MESSAGE)).toBeInTheDocument();
  });
});

function apiErrorFrom(status: number, body: unknown): ApiError {
  return toApiError({ status } as Response, body);
}
