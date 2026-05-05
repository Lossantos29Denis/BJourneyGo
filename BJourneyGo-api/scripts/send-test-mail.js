#!/usr/bin/env node
/* eslint-disable no-console */
const nodemailer = require('nodemailer')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const smtpHost = process.env.SMTP_HOST
const smtpPort = Number(process.env.SMTP_PORT || 587)
const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS
const fromEmail = process.env.SMTP_FROM || 'no-reply@bjourneygo.com'
const fromName = process.env.SMTP_FROM_NAME || 'BJourneyGo'

const toArg = process.argv[2]
const to = toArg || process.env.TEST_TO || smtpUser

if (!smtpHost || !smtpUser || !smtpPass) {
	console.error('Missing SMTP config. Set SMTP_HOST, SMTP_USER, SMTP_PASS (and optional SMTP_PORT/SMTP_SECURE).')
	process.exit(1)
}

if (!to) {
	console.error('Missing recipient. Pass an email as the first argument or set TEST_TO.')
	process.exit(1)
}

async function main() {
	const transport = nodemailer.createTransport({
		host: smtpHost,
		port: smtpPort,
		secure: smtpSecure,
		auth: { user: smtpUser, pass: smtpPass },
	})

	const info = await transport.sendMail({
		from: `${fromName} <${fromEmail.replace(/^.*</, '').replace(/>$/, '')}>`,
		to,
		subject: 'BJourneyGo SMTP test',
		text: 'Test email from BJourneyGo API SMTP configuration.',
		html: '<p>Test email from <strong>BJourneyGo API</strong> SMTP configuration.</p>',
	})

	console.log('Message sent:', info.messageId || info)
}

main().catch(err => {
	console.error('Send failed:', err && (err.message || err))
	process.exit(1)
})
