import jwt from 'jsonwebtoken'
import PDFDocument from 'pdfkit'
import streamBuffers from 'stream-buffers'
import { query } from '../../../lib/db'
import { extractOptionalUserId } from '../utils/paymentUtils'

const JWT_SECRET_PAYMENTS = process.env.JWT_SECRET_PAYMENTS || process.env.JWT_SECRET || ''

export function registerTicketPdfHandlers(router: any) {
  router.get('/tickets/:uuid/pdf', async (req: any, res: any) => {
    const { uuid } = req.params || {}
    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).json({ error: 'uuid required' })
    }

    try {
      const requestUserId = extractOptionalUserId(req)

      const normalizedUuid = String(uuid).trim()
      const [rows]: any = await query(
        `SELECT t.id, t.uuid, t.order_id AS orderId, t.trip_id AS tripId, t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification, t.passenger_phone AS passengerPhone, t.price, COALESCE(o.currency, 'EUR') AS currency, t.qr_token AS qrToken, t.issued_at AS issuedAt, o.user_id AS ownerUserId, r.origin, r.destination, tr.route_id AS routeId, tr.departure_at AS departureAt, tr.arrival_at AS arrivalAt, r.code AS routeCode
         FROM \`Ticket\` t
         LEFT JOIN \`Order\` o ON o.id = t.order_id
         LEFT JOIN \`Trip\` tr ON tr.id = t.trip_id
         LEFT JOIN \`Route\` r ON r.id = tr.route_id
         WHERE LOWER(TRIM(t.uuid)) = LOWER(TRIM(?))
            OR LOWER(COALESCE(t.qr_token, '')) LIKE CONCAT('%', LOWER(TRIM(?)), '%')
         LIMIT 1`,
        [normalizedUuid, normalizedUuid]
      )

      const ticket = rows && rows[0]
      if (!ticket) {
        return res.status(404).json({ error: 'ticket not found' })
      }

      // Access control: owner or staff
      if (requestUserId !== ticket.ownerUserId) {
        const role = (req.user || (() => {
          try { return jwt.verify(String(req.headers?.authorization || '').replace('Bearer ', ''), JWT_SECRET_PAYMENTS) as any } catch { return null }
        })())?.role
        const isStaff = role === 'ADMIN' || role === 'AGENCY_ADMIN' || role === 'AGENCY_WORKER'
        if (!isStaff) return res.status(403).json({ error: 'forbidden' })
      }

      const parseLocalDateTime = (value: any) => {
        const raw = String(value || '').trim()
        if (!raw) return new Date(NaN)
        const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/)
        if (m) {
          const [, y, mo, d, h, mi, s] = m
          return new Date(
            Number(y),
            Number(mo) - 1,
            Number(d),
            Number(h),
            Number(mi),
            Number(s || '0')
          )
        }
        const parsed = new Date(raw)
        return parsed
      }

      const fmtDate = (v: any) => {
        if (!v) return '—'
        try {
          const d = parseLocalDateTime(v)
          if (Number.isNaN(d.getTime())) return String(v)
          return d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
        } catch {
          return String(v)
        }
      }

      const doc = new PDFDocument({ size: 'A5', margins: { top: 40, bottom: 40, left: 40, right: 40 } })
      const buf = new streamBuffers.WritableStreamBuffer({ initialSize: 200 * 1024, incrementAmount: 50 * 1024 })
      doc.pipe(buf)

      const BRAND = process.env.EMAIL_BRAND_NAME || 'BJourneyGo'
      doc.fontSize(18).font('Helvetica-Bold').text(BRAND, { align: 'center' })
      doc.fontSize(11).font('Helvetica').text('Billete de viaje', { align: 'center' })
      doc.moveDown(0.5)
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke()
      doc.moveDown(0.5)

      doc.fontSize(14).font('Helvetica-Bold').text(`${ticket.origin || '-'}  -  ${ticket.destination || '-'}`, { align: 'center' })
      doc.moveDown(0.3)
      if (ticket.routeCode) doc.fontSize(10).font('Helvetica').text(`Código de ruta: ${ticket.routeCode}`, { align: 'center' })
      if (ticket.departureAt) doc.fontSize(10).text(`Salida: ${fmtDate(ticket.departureAt)}`, { align: 'center' })
      if (ticket.arrivalAt) doc.fontSize(10).text(`Llegada: ${fmtDate(ticket.arrivalAt)}`, { align: 'center' })
      doc.moveDown(0.5)

      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke()
      doc.moveDown(0.5)

      doc.fontSize(11).font('Helvetica-Bold').text('Datos del pasajero')
      doc.font('Helvetica').fontSize(10)
      doc.text(`Nombre: ${ticket.passengerName || '—'}`)
      doc.text(`DNI / Identificación: ${ticket.passengerIdentification || '—'}`)
      if (ticket.passengerPhone) doc.text(`Teléfono: ${ticket.passengerPhone}`)
      doc.moveDown(0.5)

      doc.font('Helvetica-Bold').fontSize(11).text('Reserva')
      doc.font('Helvetica').fontSize(10)
      if (ticket.orderId) doc.text(`Pedido: ${ticket.orderId}`)
      doc.text(`Precio: ${ticket.price} ${ticket.currency || 'EUR'}`)
      if (ticket.issuedAt) doc.text(`Emitido: ${fmtDate(ticket.issuedAt)}`)
      doc.moveDown(0.5)

      // Embed QR via quickchart.io
      try {
        const qrText = ticket.qrToken || ticket.uuid
        const qrUrl = `https://quickchart.io/qr?size=200&margin=1&text=${encodeURIComponent(qrText)}`
        const qrRes = await fetch(qrUrl, { signal: AbortSignal.timeout(8000) })
        if (qrRes.ok) {
          const qrBuf = Buffer.from(await qrRes.arrayBuffer())
          doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke()
          doc.moveDown(0.5)
          const imgX = (doc.page.width - 150) / 2
          doc.image(qrBuf, imgX, doc.y, { width: 150 })
          doc.moveDown(8)
          doc.fontSize(9).text('Presenta este QR al embarcar', { align: 'center' })
        }
      } catch (_e) {
        doc.text('[QR no disponible]', { align: 'center' })
      }

      doc.end()
      await new Promise<void>((resolve, reject) => {
        doc.once('end', resolve)
        doc.once('error', reject)
        buf.once('error', reject)
        buf.once('finish', resolve)
      })
      const pdfBuffer = buf.getContents()
      if (!pdfBuffer) return res.status(500).json({ error: 'pdf generation failed' })

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="ticket-${uuid.slice(0, 8)}.pdf"`)
      res.setHeader('Content-Length', String(pdfBuffer.length))
      res.send(pdfBuffer)
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
