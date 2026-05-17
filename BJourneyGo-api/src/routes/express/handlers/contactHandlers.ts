import { Router } from 'express'
import { sendMail } from '../../../lib/mailer'

export function registerContactHandlers(router: Router) {
  router.post('/contact', async (req, res) => {
    try {
      const { name, email, subject, message } = req.body || {}
      if (!name || !email || !message) {
        return res.status(400).json({ error: 'name, email and message are required' })
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        return res.status(400).json({ error: 'invalid email' })
      }
      const CONTACT_TO = process.env.CONTACT_EMAIL || 'bjourneygo@gmail.com'
      const safeSubject = String(subject || 'Consulta desde la web').slice(0, 200)
      const safeName = String(name).slice(0, 100)
      const safeMessage = String(message).slice(0, 5000)
      const safeEmail = String(email).slice(0, 200)
      await sendMail({
        to: CONTACT_TO,
        subject: `[Web] ${safeSubject}`,
        text: `Nombre: ${safeName}\nEmail: ${safeEmail}\nAsunto: ${safeSubject}\n\n${safeMessage}`,
        html: `<p><strong>Nombre:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Asunto:</strong> ${safeSubject}</p><hr/><p>${safeMessage.replace(/\n/g, '<br/>')}</p>`
      })
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
