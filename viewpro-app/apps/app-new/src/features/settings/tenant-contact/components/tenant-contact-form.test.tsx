import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { updateTenantWhatsappPhone } from '../api/service'
import { TenantContactForm } from './tenant-contact-form'

vi.mock('../api/service', () => ({
  getTenantWhatsappPhone: vi.fn(),
  updateTenantWhatsappPhone: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

const updateMock = vi.mocked(updateTenantWhatsappPhone)
const toastMock = vi.mocked(toast)

function renderForm(defaultPhone: string | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TenantContactForm defaultPhone={defaultPhone} />
    </QueryClientProvider>
  )
}

describe('TenantContactForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // CT-1 (S-10): prefills input when a phone value is provided
  it('prefills the input with the current whatsapp phone when provided', () => {
    renderForm('+5493510000000')

    expect(screen.getByRole('textbox', { name: /teléfono/i })).toHaveValue('+5493510000000')
  })

  // CT-2 (S-10): shows empty state helper text when phone is null
  it('shows empty state helper text when no phone is configured', () => {
    renderForm(null)

    expect(screen.getByRole('textbox', { name: /teléfono/i })).toHaveValue('')
    expect(screen.getByText('Aún no hay un número configurado')).toBeVisible()
  })

  // CT-3: typing a valid phone and submitting calls the mutation
  it('calls the mutation with the typed value when a valid phone is submitted', async () => {
    const user = userEvent.setup()
    updateMock.mockResolvedValueOnce(undefined)

    renderForm(null)

    const input = screen.getByRole('textbox', { name: /teléfono/i })
    await user.clear(input)
    await user.type(input, '+5493510000001')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ whatsappPhone: '+5493510000001' })
    })
  })

  // CT-4 (S-11, INVERTED): the field is now mandatory (#287 WU4, ADR-6) — an
  // empty submission is rejected client-side and never reaches the mutation.
  // The old too-short digit-count check is gone: only the server decides
  // validity/country now, via parseArContactPhone.
  it('shows a required-phone validation error and does not call the mutation when the field is empty', async () => {
    const user = userEvent.setup()

    renderForm(null)

    const input = screen.getByRole('textbox', { name: /teléfono/i })
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => {
      expect(screen.getByText('Ingresá el teléfono de contacto de la inmobiliaria.')).toBeVisible()
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  // CT-5 (INVERTED): clearing the field used to be a valid way to null out
  // the stored phone. It is mandatory now, so clearing and submitting must
  // be blocked the same way CT-4 blocks a never-filled field.
  it('shows a required-phone validation error and does not call the mutation when the field is cleared', async () => {
    const user = userEvent.setup()

    renderForm('+5493510000000')

    const input = screen.getByRole('textbox', { name: /teléfono/i })
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => {
      expect(screen.getByText('Ingresá el teléfono de contacto de la inmobiliaria.')).toBeVisible()
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  // A non-empty value that looks invalid is NOT rejected client-side — the
  // client only guards presence; validity and country are the server's job
  // (design.md ADR-2/ADR-6). The mutation is called and the server's code
  // surfaces through the error toast, covered below.
  it('calls the mutation with a non-empty value even when it looks invalid, deferring to the server', async () => {
    const user = userEvent.setup()
    updateMock.mockResolvedValueOnce(undefined)

    renderForm(null)

    const input = screen.getByRole('textbox', { name: /teléfono/i })
    await user.clear(input)
    await user.type(input, '123')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ whatsappPhone: '123' })
    })
  })

  // CT-6: success toast on 204, error toast on 400 with errorCode
  it('shows a success toast after a successful mutation', async () => {
    const user = userEvent.setup()
    updateMock.mockResolvedValueOnce(undefined)

    renderForm(null)

    const input = screen.getByRole('textbox', { name: /teléfono/i })
    await user.clear(input)
    await user.type(input, '+5493510000001')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith('Teléfono actualizado')
    })
  })

  // INVERTED: `phone.too_short` no longer exists on this path; the server
  // now answers with one of the three real codes shared with registration
  // (design.md ADR-6), and the client shows the matching real message
  // instead of the raw `Error: ${errorCode}` string.
  it('shows the real message for phone.invalid when the server rejects the mutation', async () => {
    const user = userEvent.setup()
    const error = Object.assign(new Error('Invalid request payload'), { errorCode: 'phone.invalid' })
    updateMock.mockRejectedValueOnce(error)

    renderForm(null)

    const input = screen.getByRole('textbox', { name: /teléfono/i })
    await user.clear(input)
    await user.type(input, '123')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        'Ese teléfono no es válido. Revisá el número e intentá de nuevo.'
      )
    })
  })

  it('shows the real message for phone.country_unsupported when the server rejects the mutation', async () => {
    const user = userEvent.setup()
    const error = Object.assign(new Error('Invalid request payload'), {
      errorCode: 'phone.country_unsupported'
    })
    updateMock.mockRejectedValueOnce(error)

    renderForm(null)

    const input = screen.getByRole('textbox', { name: /teléfono/i })
    await user.clear(input)
    await user.type(input, '+56912345678')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        'Por ahora solo aceptamos teléfonos de Argentina.'
      )
    })
  })
})
