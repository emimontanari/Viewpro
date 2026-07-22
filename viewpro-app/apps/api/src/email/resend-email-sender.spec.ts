import { describe, expect, it, vi } from 'vitest'
import { ResendEmailSender } from './resend-email-sender'

function buildClient() {
  const send = vi.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null })
  return { send, client: { emails: { send } } }
}

describe('ResendEmailSender', () => {
  it('sends the team invitation through the resend client with the configured from address', async () => {
    const { send, client } = buildClient()
    const sender = new ResendEmailSender('no-reply@inmoview.app', client as never)

    await sender.sendTeamInvitation({
      to: 'agent@example.com',
      role: 'AGENT',
      invitationUrl: 'https://app.inmoview.app/team-invitations/tok-1',
      expiresAt: new Date('2026-01-15T00:00:00.000Z'),
    })

    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0]?.[0]
    expect(payload.from).toBe('no-reply@inmoview.app')
    expect(payload.to).toBe('agent@example.com')
    expect(payload.subject).toBe('Te invitaron a InmoView')
    expect(payload.html).toContain('https://app.inmoview.app/team-invitations/tok-1')
    expect(payload.html).toContain('Vendedor')
    expect(payload.text).toContain('https://app.inmoview.app/team-invitations/tok-1')
  })

  it('sends the owner invitation through the resend client', async () => {
    const { send, client } = buildClient()
    const sender = new ResendEmailSender('no-reply@inmoview.app', client as never)

    await sender.sendOwnerInvitation({
      to: 'owner@example.com',
      invitationUrl: 'https://app.inmoview.app/owner-invitations/tok-2',
      expiresAt: new Date('2026-03-01T00:00:00.000Z'),
    })

    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0]?.[0]
    expect(payload.from).toBe('no-reply@inmoview.app')
    expect(payload.to).toBe('owner@example.com')
    expect(payload.subject).toBe('Te invitaron a seguir tu propiedad en InmoView')
    expect(payload.html).toContain('https://app.inmoview.app/owner-invitations/tok-2')
  })

  it('throws when the resend client returns an error (so callers can log best-effort)', async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: { message: 'invalid api key' } })
    const sender = new ResendEmailSender('no-reply@inmoview.app', { emails: { send } } as never)

    await expect(
      sender.sendOwnerInvitation({
        to: 'owner@example.com',
        invitationUrl: 'https://app.inmoview.app/owner-invitations/tok-2',
        expiresAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow('invalid api key')
  })
})
