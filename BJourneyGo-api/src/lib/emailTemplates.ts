type EmailTemplateConfig = {
  title: string
  preheader: string
  bodyHtml: string
  bodyText: string
  actionUrl?: string
  actionLabel?: string
}

const BRAND_NAME = process.env.EMAIL_BRAND_NAME || 'BJourneyGo'
const BRAND_COLOR = process.env.EMAIL_BRAND_COLOR || '#F5C542'
const WEB_URL = process.env.WEB_URL || ''
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@bjourneygo.me'
const LOGO_URL = process.env.EMAIL_LOGO_URL || (WEB_URL ? `${WEB_URL.replace(/\/$/, '')}/logo.svg` : '')

function renderBase(template: EmailTemplateConfig) {
  const logoImg = LOGO_URL
    ? `<img src="${LOGO_URL}" alt="${BRAND_NAME}" width="120" style="display:block;border:0;outline:none;text-decoration:none;" />`
    : `<div style="font-weight:700;font-size:20px;color:#111">${BRAND_NAME}</div>`

  const button = template.actionUrl && template.actionLabel
    ? `<a href="${template.actionUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#111;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">${template.actionLabel}</a>`
    : ''

  const preheader = template.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">${template.preheader}</div>`
    : ''

  const html = `
  <!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${template.title}</title>
    </head>
    <body style="margin:0;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif;color:#111;">
      ${preheader}
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f7f7f7;padding:24px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
              <tr>
                <td style="padding:24px 32px;border-bottom:1px solid #eee;">
                  ${logoImg}
                </td>
              </tr>
              <tr>
                <td style="padding:28px 32px;">
                  <h1 style="margin:0 0 12px 0;font-size:22px;">${template.title}</h1>
                  <div style="font-size:15px;line-height:1.6;color:#333;">${template.bodyHtml}</div>
                  ${button ? `<div style="margin:20px 0 0;">${button}</div>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#666;line-height:1.6;">
                  <div>Si no solicitaste esta accion, puedes ignorar este mensaje.</div>
                  <div>Soporte: <a href="mailto:${SUPPORT_EMAIL}" style="color:#111;">${SUPPORT_EMAIL}</a></div>
                  <div style="margin-top:8px;color:#999;">${BRAND_NAME} · Mensaje automatico, no respondas a este correo.</div>
                </td>
              </tr>
            </table>
            <div style="font-size:11px;color:#999;margin-top:12px;">© ${new Date().getFullYear()} ${BRAND_NAME}. Todos los derechos reservados.</div>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `.trim()

  const text = `${BRAND_NAME}\n\n${template.title}\n\n${template.bodyText}\n\nSoporte: ${SUPPORT_EMAIL}\n`

  return { html, text }
}

export function buildVerifyEmail(verifyLink: string) {
  const title = 'Verifica tu cuenta'
  const preheader = 'Confirma tu correo para activar la cuenta.'
  const bodyHtml = `
    <p>Gracias por registrarte en ${BRAND_NAME}. Para activar tu cuenta, confirma tu correo:</p>
    <p style="margin-top:12px;"><strong>Enlace de verificacion</strong></p>
    <p style="word-break:break-all;color:#555;">${verifyLink}</p>
  `.trim()
  const bodyText = `Gracias por registrarte en ${BRAND_NAME}.\n\nConfirma tu correo: ${verifyLink}`
  return {
    subject: `Verifica tu cuenta - ${BRAND_NAME}`,
    ...renderBase({
      title,
      preheader,
      bodyHtml,
      bodyText,
      actionUrl: verifyLink,
      actionLabel: 'Verificar cuenta'
    })
  }
}

export function buildResetEmail(resetLink: string) {
  const title = 'Restablece tu contraseña'
  const preheader = 'Usa el enlace para cambiar tu contraseña.'
  const bodyHtml = `
    <p>Recibimos una solicitud para restablecer tu contraseña.</p>
    <p>Si fuiste tu, usa el siguiente enlace:</p>
    <p style="word-break:break-all;color:#555;">${resetLink}</p>
  `.trim()
  const bodyText = `Restablece tu contraseña usando este enlace: ${resetLink}`
  return {
    subject: `Restablece tu contraseña - ${BRAND_NAME}`,
    ...renderBase({
      title,
      preheader,
      bodyHtml,
      bodyText,
      actionUrl: resetLink,
      actionLabel: 'Restablecer contraseña'
    })
  }
}

export function buildReceiptEmail(orderId: number, totalAmount: number, currency: string, tickets: Array<{ uuid: string }>, referenceCode?: string | null) {
  const title = `Recibo de compra #${orderId}`
  const preheader = `Recibo de compra ${BRAND_NAME}`
  const ticketsHtml = tickets.length
    ? `<ul style="padding-left:18px;margin:8px 0;">${tickets.map(t => `<li>${t.uuid}</li>`).join('')}</ul>`
    : '<p>No hay billetes asociados.</p>'
  const referenceHtml = referenceCode
    ? `<p><strong>Referencia de reserva:</strong> ${referenceCode}</p><p>Guarda este código para gestionar tu reserva en la sección de Check-in.</p>`
    : ''
  const bodyHtml = `
    <p>Gracias por tu compra.</p>
    <p><strong>Pedido:</strong> #${orderId}</p>
    ${referenceHtml}
    <p><strong>Total:</strong> ${totalAmount} ${currency}</p>
    <p><strong>Billetes:</strong></p>
    ${ticketsHtml}
  `.trim()
  const bodyText = `Gracias por tu compra.\nPedido #${orderId}${referenceCode ? `\nReferencia de reserva: ${referenceCode}\nUsa esta referencia en la sección Check-in para gestionar tu reserva.` : ''}\nTotal: ${totalAmount} ${currency}\nBilletes: ${tickets.map(t => t.uuid).join(', ')}`
  return {
    subject: `Recibo de compra #${orderId} - ${BRAND_NAME}`,
    ...renderBase({
      title,
      preheader,
      bodyHtml,
      bodyText
    })
  }
}