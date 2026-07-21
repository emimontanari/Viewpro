import { NotificationType } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { renderOwnerNotificationEmail } from './owner-notification-email'

describe('renderOwnerNotificationEmail', () => {
  it('uses a type-specific Spanish subject for document requests', () => {
    const email = renderOwnerNotificationEmail({
      notificationType: NotificationType.DOCUMENT_REQUESTED,
      body: 'DNI frente',
      url: 'https://app.inmoview.app/owner/properties/asset-1',
    })

    expect(email.subject).toContain('documento')
    expect(email.html).toContain('DNI frente')
    expect(email.html).toContain('https://app.inmoview.app/owner/properties/asset-1')
    expect(email.text).toContain('DNI frente')
  })

  it('falls back to a generic subject for an unmapped type', () => {
    const email = renderOwnerNotificationEmail({
      notificationType: NotificationType.STATUS_CHANGE_APPROVED,
      body: '',
      url: 'https://app.inmoview.app/x',
    })

    expect(email.subject).toContain('novedad')
    expect(email.html).toContain('https://app.inmoview.app/x')
  })

  it('escapes HTML in the body and url', () => {
    const email = renderOwnerNotificationEmail({
      notificationType: NotificationType.DOCUMENT_REQUESTED,
      body: '<script>alert(1)</script>',
      url: 'https://app.inmoview.app/owner?q="x"',
    })

    expect(email.html).not.toContain('<script>alert(1)</script>')
    expect(email.html).toContain('&lt;script&gt;')
  })
})
