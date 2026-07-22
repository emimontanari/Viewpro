import { NotificationType } from '@prisma/client'

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

const BRAND = 'InmoView'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type NotificationCopy = { subject: string; heading: string; intro: string }

// Spanish copy for the owner-facing notification types. Unlisted types fall back
// to a generic message, so a new type never breaks email delivery.
const COPY: Partial<Record<NotificationType, NotificationCopy>> = {
  [NotificationType.DOCUMENT_REQUESTED]: {
    subject: `Te pidieron un documento en ${BRAND}`,
    heading: 'Te pidieron un documento',
    intro: 'La inmobiliaria necesita que subas un documento para tu propiedad.',
  },
  [NotificationType.DOCUMENT_APPROVED]: {
    subject: `Aprobaron tu documento en ${BRAND}`,
    heading: 'Documento aprobado',
    intro: 'Se aprobó el documento que subiste.',
  },
  [NotificationType.DOCUMENT_REJECTED]: {
    subject: `Revisá tu documento en ${BRAND}`,
    heading: 'Tu documento necesita una corrección',
    intro: 'El documento que subiste fue rechazado y hay que volver a cargarlo.',
  },
  [NotificationType.PROPERTY_STATUS_CHANGED]: {
    subject: `Novedad en tu propiedad en ${BRAND}`,
    heading: 'Cambió el estado de tu propiedad',
    intro: 'Hay una actualización en el seguimiento de tu propiedad.',
  },
}

const FALLBACK: NotificationCopy = {
  subject: `Tenés una novedad en ${BRAND}`,
  heading: 'Tenés una novedad',
  intro: 'Hay una nueva actualización en tu propiedad.',
}

export function renderOwnerNotificationEmail(input: {
  notificationType: NotificationType
  body: string
  url: string
}): RenderedEmail {
  const copy = COPY[input.notificationType] ?? FALLBACK
  const safeUrl = escapeHtml(input.url)
  const detail = input.body.trim()

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;padding:32px;">
          <tr><td>
            <p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#0f172a;">${BRAND}</p>
            <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${escapeHtml(copy.heading)}</h1>
            <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">${escapeHtml(copy.intro)}</p>
            ${detail ? `<p style="margin:0 0 16px;color:#0f172a;font-size:15px;line-height:1.6;font-weight:600;">${escapeHtml(detail)}</p>` : ''}
            <p style="margin:24px 0;">
              <a href="${safeUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;">Ver en ${BRAND}</a>
            </p>
            <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.6;">Si el botón no funciona, copiá y pegá este enlace en tu navegador:</p>
            <p style="margin:0;color:#2563eb;font-size:13px;word-break:break-all;">${safeUrl}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`

  const text = [
    BRAND,
    '',
    copy.intro,
    ...(detail ? ['', detail] : []),
    '',
    `Ver en ${BRAND}: ${input.url}`,
  ].join('\n')

  return { subject: copy.subject, html, text }
}
