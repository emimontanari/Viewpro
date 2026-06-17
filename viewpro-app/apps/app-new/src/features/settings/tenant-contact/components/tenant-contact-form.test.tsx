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

  // CT-4 (S-11): submitting a too-short value blocks the mutation
  it('shows a validation error and does not call the mutation when the phone is too short', async () => {
    const user = userEvent.setup()

    renderForm(null)

    const input = screen.getByRole('textbox', { name: /teléfono/i })
    await user.clear(input)
    await user.type(input, '123')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => {
      expect(screen.getByText(/phone\.too_short/i)).toBeVisible()
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  // CT-5: clearing the field and submitting calls the mutation with null
  it('calls the mutation with null when the input is cleared and submitted', async () => {
    const user = userEvent.setup()
    updateMock.mockResolvedValueOnce(undefined)

    renderForm('+5493510000000')

    const input = screen.getByRole('textbox', { name: /teléfono/i })
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ whatsappPhone: null })
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

  it('shows an error toast with the errorCode when the mutation fails', async () => {
    const user = userEvent.setup()
    const error = Object.assign(new Error('Demasiado corto'), { errorCode: 'phone.too_short' })
    updateMock.mockRejectedValueOnce(error)

    renderForm(null)

    const input = screen.getByRole('textbox', { name: /teléfono/i })
    await user.clear(input)
    await user.type(input, '+5493510000001')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        expect.stringContaining('phone.too_short')
      )
    })
  })
})
