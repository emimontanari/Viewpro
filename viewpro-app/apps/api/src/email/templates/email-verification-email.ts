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

function layout(params: { heading: string; paragraphs: string[]; buttonLabel: string; verificationUrl: string; footer: string }): string {
  const safeUrl = escapeHtml(params.verificationUrl)
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
              <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">${escapeHtml(params.footer)}</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function renderEmailVerificationEmail(input: { verificationUrl: string }): RenderedEmail {
  const subject = `Verificá tu correo en ${BRAND}`
  const heading = 'Verificá tu correo'
  const footer =
    'Este enlace vence en 24 horas. Si no creaste una cuenta en InmoView, podés ignorar este correo.'

  const paragraphs = [
    `Gracias por registrarte en ${BRAND}.`,
    'Hacé clic en el botón para verificar tu dirección de correo electrónico.',
  ]

  const html = layout({
    heading,
    paragraphs,
    buttonLabel: 'Verificar correo',
    verificationUrl: input.verificationUrl,
    footer,
  })

  const text = [
    `${BRAND}`,
    '',
    `Gracias por registrarte en ${BRAND}.`,
    'Hacé clic en el enlace para verificar tu dirección de correo electrónico.',
    '',
    `Verificar correo: ${input.verificationUrl}`,
    '',
    footer,
  ].join('\n')

  return { subject, html, text }
}
