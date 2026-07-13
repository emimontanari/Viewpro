import type { TeamInvitationRole } from '../../team/responses/team-invitation.response'

export const INVITATION_EXPIRY_DAYS = 14

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

const BRAND = 'InmoView'

const TEAM_ROLE_LABELS: Record<TeamInvitationRole, string> = {
  MANAGER: 'Encargado',
  AGENT: 'Vendedor',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function layout(params: { heading: string; paragraphs: string[]; buttonLabel: string; invitationUrl: string }): string {
  const safeUrl = escapeHtml(params.invitationUrl)
  const paragraphs = params.paragraphs.map((p) => `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">${p}</p>`).join('')

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;padding:32px;">
            <tr><td>
              <p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#0f172a;">${BRAND}</p>
              <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${escapeHtml(params.heading)}</h1>
              ${paragraphs}
              <p style="margin:24px 0;">
                <a href="${safeUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;">${escapeHtml(params.buttonLabel)}</a>
              </p>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.6;">Si el botón no funciona, copiá y pegá este enlace en tu navegador:</p>
              <p style="margin:0;color:#2563eb;font-size:13px;word-break:break-all;">${safeUrl}</p>
              <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">Esta invitación vence en ${INVITATION_EXPIRY_DAYS} días.</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function renderTeamInvitationEmail(input: {
  role: TeamInvitationRole
  invitationUrl: string
  tenantName?: string
}): RenderedEmail {
  const roleLabel = TEAM_ROLE_LABELS[input.role]
  const workspace = input.tenantName ? `el equipo de ${input.tenantName}` : `un equipo en ${BRAND}`

  const subject = `Te invitaron a ${BRAND}`
  const heading = `Te invitaron a ${BRAND}`

  const paragraphs = [
    `Fuiste invitado a ${escapeHtml(workspace)} como <strong>${escapeHtml(roleLabel)}</strong>.`,
    'Aceptá la invitación para empezar a trabajar en la plataforma.',
  ]

  const html = layout({
    heading,
    paragraphs,
    buttonLabel: 'Aceptar invitación',
    invitationUrl: input.invitationUrl,
  })

  const text = [
    `${BRAND}`,
    '',
    `Fuiste invitado a ${workspace} como ${roleLabel}.`,
    'Aceptá la invitación para empezar a trabajar en la plataforma.',
    '',
    `Aceptar invitación: ${input.invitationUrl}`,
    '',
    `Esta invitación vence en ${INVITATION_EXPIRY_DAYS} días.`,
  ].join('\n')

  return { subject, html, text }
}

export function renderOwnerInvitationEmail(input: { invitationUrl: string }): RenderedEmail {
  const subject = `Te invitaron a seguir tu propiedad en ${BRAND}`
  const heading = `Seguí tu propiedad en ${BRAND}`

  const paragraphs = [
    `Fuiste invitado a seguir el estado de tu propiedad en ${BRAND}.`,
    'Aceptá la invitación para ver las novedades de tu propiedad.',
  ]

  const html = layout({
    heading,
    paragraphs,
    buttonLabel: 'Ver mi propiedad',
    invitationUrl: input.invitationUrl,
  })

  const text = [
    `${BRAND}`,
    '',
    `Fuiste invitado a seguir el estado de tu propiedad en ${BRAND}.`,
    'Aceptá la invitación para ver las novedades de tu propiedad.',
    '',
    `Ver mi propiedad: ${input.invitationUrl}`,
    '',
    `Esta invitación vence en ${INVITATION_EXPIRY_DAYS} días.`,
  ].join('\n')

  return { subject, html, text }
}
