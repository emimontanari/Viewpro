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

function layout(params: { heading: string; paragraphs: string[]; buttonLabel: string; resetUrl: string; footer: string }): string {
  const safeUrl = escapeHtml(params.resetUrl)
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

export function renderPasswordResetEmail(input: { resetUrl: string }): RenderedEmail {
  const subject = `Restablecé tu contraseña en ${BRAND}`
  const heading = 'Restablecé tu contraseña'
  const footer =
    'Este enlace vence en 1 hora. Si no pediste restablecer tu contraseña, podés ignorar este correo.'

  const paragraphs = [
    `Recibimos un pedido para restablecer la contraseña de tu cuenta en ${BRAND}.`,
    'Hacé clic en el botón para elegir una nueva contraseña.',
  ]

  const html = layout({
    heading,
    paragraphs,
    buttonLabel: 'Restablecer contraseña',
    resetUrl: input.resetUrl,
    footer,
  })

  const text = [
    `${BRAND}`,
    '',
    `Recibimos un pedido para restablecer la contraseña de tu cuenta en ${BRAND}.`,
    'Hacé clic en el enlace para elegir una nueva contraseña.',
    '',
    `Restablecer contraseña: ${input.resetUrl}`,
    '',
    footer,
  ].join('\n')

  return { subject, html, text }
}
