import { describe, expect, it } from 'vitest'
import { renderOwnerInvitationEmail } from './invitation-emails'

describe('renderOwnerInvitationEmail', () => {
  const url = 'https://app.inmoview.app/owner-invitations/tok'

  it('names the agency that sent the invitation', () => {
    // Without this the owner receives "Te invitaron a seguir tu propiedad en
    // ViewPro" and cannot tell which agency sent it, or whether it is genuine.
    // The team invitation has said "el equipo de X" all along.
    const email = renderOwnerInvitationEmail({ invitationUrl: url, agencyName: 'Inmobiliaria Sur' })

    expect(email.subject).toContain('Inmobiliaria Sur')
    expect(email.html).toContain('Inmobiliaria Sur')
    expect(email.text).toContain('Inmobiliaria Sur')
  })

  it('falls back to the generic copy when the agency is not known', () => {
    // Invitations created before the engagement was recorded have no
    // authoritative agency. Saying nothing is correct; printing "undefined" or
    // guessing one is not.
    for (const agencyName of [undefined, null, '', '   ']) {
      const email = renderOwnerInvitationEmail({ invitationUrl: url, agencyName })

      expect(email.subject).toBe('Te invitaron a seguir tu propiedad en InmoView')
      expect(email.html).not.toContain('undefined')
      expect(email.text).not.toContain('undefined')
      expect(email.html).not.toContain('null')
    }
  })

  it('escapes the agency name in the HTML body', () => {
    // layout() interpolates paragraphs raw — it escapes only the heading, the
    // button label and the URL. An agency name reaches the paragraph, and it is
    // operator-supplied text.
    const email = renderOwnerInvitationEmail({
      invitationUrl: url,
      agencyName: '<script>alert(1)</script>'
    })

    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;')
  })

  it('keeps the plain-text body unescaped, because it is not HTML', () => {
    const email = renderOwnerInvitationEmail({ invitationUrl: url, agencyName: 'Pérez & Hijos' })

    expect(email.text).toContain('Pérez & Hijos')
    expect(email.html).toContain('P&#xE9;rez &amp; Hijos'.replace('&#xE9;', 'é'))
  })

  it('says the same thing in the subject, the HTML and the text', () => {
    const named = renderOwnerInvitationEmail({ invitationUrl: url, agencyName: 'Sur' })
    const anonymous = renderOwnerInvitationEmail({ invitationUrl: url, agencyName: null })

    // Criterion 6 of #303: the email and the acceptance UI must not disagree.
    // Within the email itself, a subject that names the agency over a body that
    // does not is the same inconsistency in miniature.
    expect(named.subject.includes('Sur')).toBe(named.text.includes('Sur'))
    expect(anonymous.subject.includes('Sur')).toBe(anonymous.text.includes('Sur'))
  })

  it('always carries the invitation link', () => {
    for (const agencyName of ['Sur', null]) {
      expect(renderOwnerInvitationEmail({ invitationUrl: url, agencyName }).html).toContain(url)
    }
  })
})
