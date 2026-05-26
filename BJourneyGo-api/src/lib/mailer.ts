/*
 Mailer implementation.
 - Uses Resend when `RESEND_API_KEY` is present.
 - Falls back to SMTP via nodemailer.
 - If neither is configured, uses a safe stub (no emails sent).
 - Keeps the same `sendMail(opts)` API used by the rest of the codebase.
*/

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Resend } = require('resend')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require('nodemailer')

const resendApiKey = process.env.RESEND_API_KEY

const smtpHost = process.env.SMTP_HOST
const smtpPort = Number(process.env.SMTP_PORT || 587)
const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'
const smtpService = String(process.env.SMTP_SERVICE || '').trim().toLowerCase()
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS
const mailDisabled = String(process.env.MAIL_DISABLED || 'false').toLowerCase() === 'true'

const fromEmail = process.env.RESEND_FROM || process.env.SMTP_FROM || 'no-reply@bjourneygo.me'
const fromName = process.env.RESEND_FROM_NAME || process.env.SMTP_FROM_NAME || 'BJourneyGo'

let resendClient: any = null
function getResendClient() {
  if (!resendClient) resendClient = new Resend(resendApiKey)
  return resendClient
}

let smtpTransport: any = null
function getSmtpTransport() {
  if (smtpTransport) return smtpTransport

  const baseTransport = smtpService === 'gmail'
    ? {
        service: 'gmail',
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      }
    : {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      }

  smtpTransport = nodemailer.createTransport({
    ...baseTransport,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
    tls: smtpService === 'gmail' ? { rejectUnauthorized: true } : undefined,
  })
  return smtpTransport
}

function toResendRecipients(to: string | { Email: string; Name?: string } | Array<any>) {
  return Array.isArray(to)
    ? to
    : (typeof to === 'string'
      ? [to]
      : [String((to as any).Email || to)])
}

function toSmtpRecipients(to: string | { Email: string; Name?: string } | Array<any>) {
  const list = Array.isArray(to) ? to : [to as any]
  return list.map((item: any) => (typeof item === 'string' ? item : item.Email)).join(',')
}

export async function sendMail(opts: { to: string | { Email: string; Name?: string } | Array<any>; subject?: string; text?: string; html?: string; from?: { Email: string; Name?: string }; attachments?: Array<{Filename: string; ContentType: string; Content: string}> }) {
  if (mailDisabled) {
    // eslint-disable-next-line no-console
    console.warn('[mailer] MAIL_DISABLED=true; email suppressed for:', opts && (opts.to || opts))
    return Promise.resolve({ Status: 'disabled', accepted: [], rejected: [], messageId: null })
  }

  const from = opts.from || { Email: fromEmail, Name: fromName }

  if (resendApiKey) {
    try {
      const resend = getResendClient()
      const { data, error } = await resend.emails.send({
        from: `${from.Name || fromName} <${from.Email}>`,
        to: toResendRecipients(opts.to),
        subject: opts.subject || '',
        text: opts.text || '',
        html: opts.html || '',
        attachments: (opts.attachments || []).map(a => ({
          filename: a.Filename,
          content: a.Content,
        })),
      })
      if (error) throw error
      return data
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[mailer] Resend send error:', err && (err.message || err))
      throw err
    }
  }

  if ((smtpService === 'gmail' || smtpHost) && smtpUser && smtpPass) {
    try {
      const transport = getSmtpTransport()
      const info = await transport.sendMail({
        from: `${from.Name || fromName} <${from.Email}>`,
        to: toSmtpRecipients(opts.to),
        subject: opts.subject || '',
        text: opts.text || '',
        html: opts.html || '',
        attachments: (opts.attachments || []).map(a => ({
          filename: a.Filename,
          content: Buffer.from(a.Content, 'base64'),
          contentType: a.ContentType,
        })),
      })
      return { accepted: info.accepted || [], messageId: info.messageId, info }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[mailer] SMTP send error:', err && (err.message || err))
      smtpTransport = null // reset so next attempt creates a fresh connection
      throw err
    }
  }

  // eslint-disable-next-line no-console
  console.warn('[mailer] No mail provider configured; email suppressed for:', opts && (opts.to || opts))
  return Promise.resolve({ Status: 'disabled', accepted: [], rejected: [], messageId: null })
}

export default { sendMail }
