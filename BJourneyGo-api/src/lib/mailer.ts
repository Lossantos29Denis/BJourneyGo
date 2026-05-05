/*
 Mailer implementation.
 - Uses Mailjet when `MAILJET_API_KEY` + `MAILJET_API_SECRET` are present.
 - Falls back to SMTP (MailerSend or any SMTP) via nodemailer.
 - If neither is configured, uses a safe stub (no emails sent).
 - Keeps the same `sendMail(opts)` API used by the rest of the codebase.
*/

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Mailjet = require('node-mailjet')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require('nodemailer')

const mjKey = process.env.MAILJET_API_KEY
const mjSecret = process.env.MAILJET_API_SECRET

const smtpHost = process.env.SMTP_HOST
const smtpPort = Number(process.env.SMTP_PORT || 587)
const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS
const mailDisabled = String(process.env.MAIL_DISABLED || 'false').toLowerCase() === 'true'

const fromEmail = process.env.MAILJET_FROM_EMAIL || process.env.SMTP_FROM || 'no-reply@bjourneygo.com'
const fromName = process.env.MAILJET_FROM_NAME || process.env.SMTP_FROM_NAME || 'BJourneyGo'

let mjClient: any = null
function getMailjetClient() {
  if (!mjClient) mjClient = Mailjet.connect(mjKey, mjSecret)
  return mjClient
}

let smtpTransport: any = null
function getSmtpTransport() {
  if (smtpTransport) return smtpTransport
  smtpTransport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })
  return smtpTransport
}

function toMailjetRecipients(to: string | { Email: string; Name?: string } | Array<any>) {
  return Array.isArray(to)
    ? to
    : (typeof to === 'string'
      ? [{ Email: to }]
      : [to as any])
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

  if (mjKey && mjSecret) {
    try {
      const mj = getMailjetClient()
      const message = {
        From: { Email: from.Email, Name: from.Name || fromName },
        To: toMailjetRecipients(opts.to),
        Subject: opts.subject || '',
        TextPart: opts.text || '',
        HTMLPart: opts.html || '',
        Attachments: (opts.attachments || []).map(a => ({
          ContentType: a.ContentType,
          Filename: a.Filename,
          Base64: a.Content,
        })),
      }

      const body = { Messages: [message] }
      const res = await mj.post('send', { version: 'v3.1' }).request(body)
      return res.body
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[mailer] Mailjet send error:', err && (err.message || err))
      throw err
    }
  }

  if (smtpHost && smtpUser && smtpPass) {
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
