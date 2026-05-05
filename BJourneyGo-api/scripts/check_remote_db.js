#!/usr/bin/env node
const mysql = require('mysql2/promise')

async function main() {
  const host = process.env.DB_HOST || process.argv[2]
  const port = process.env.DB_PORT || process.argv[3] || 3306
  const user = process.env.DB_USER || process.argv[4]
  const password = process.env.DB_PASS || process.argv[5]
  const database = process.env.DB_NAME || process.argv[6] || 'BJourneyGo'

  if (!host || !user || !password) {
    console.error('Usage: set DB_HOST DB_USER DB_PASS (or pass as args)')
    process.exit(2)
  }

  const conn = await mysql.createConnection({ host, port: Number(port), user, password, database, multipleStatements: true })
  try {
    console.log('Connected to', host + ':' + port, 'db=', database)
    const [createRows] = await conn.query("SHOW CREATE TABLE `Ticket`")
    if (createRows && createRows[0]) {
      console.log('--- SHOW CREATE TABLE `Ticket` ---')
      console.log(createRows[0]['Create Table'] || createRows[0]['Create Table'])
    } else {
      console.log('No Ticket table found')
    }

    const [triggers] = await conn.query("SHOW TRIGGERS LIKE 'trg_ticket_before_insert'")
    console.log('--- TRIGGER trg_ticket_before_insert ---')
    if (triggers && triggers.length) console.log(triggers)
    else console.log('Trigger not found')

    const [countRows] = await conn.query('SELECT COUNT(*) AS ticket_count FROM `Ticket`')
    console.log('Ticket count:', countRows && countRows[0] && countRows[0].ticket_count)

    const [tables] = await conn.query("SHOW TABLES")
    console.log('Tables in DB:', tables.map(r => Object.values(r)[0]).join(', '))
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err)
    process.exitCode = 1
  } finally {
    await conn.end()
  }
}

main()
