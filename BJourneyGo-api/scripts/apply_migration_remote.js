#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

async function main() {
  const host = process.env.DB_HOST || process.argv[2]
  const port = process.env.DB_PORT || process.argv[3] || 3306
  const user = process.env.DB_USER || process.argv[4]
  const password = process.env.DB_PASS || process.argv[5]
  const database = process.env.DB_NAME || process.argv[6] || 'BJourneyGo'

  if (!host || !user || !password) {
    console.error('Usage: set DB_HOST DB_PORT DB_USER DB_PASS DB_NAME env vars or pass as args')
    process.exit(2)
  }

  const file = path.resolve(__dirname, '..', '..', 'db', 'migrations', 'alter_ticket_add_timestamps.sql')
  if (!fs.existsSync(file)) {
    console.error('Migration file not found at', file)
    process.exit(1)
  }

  let sql = fs.readFileSync(file, 'utf8')

  // We'll run safe, compatible steps: check information_schema for columns,
  // perform ALTER TABLE only when needed (no IF NOT EXISTS), update rows,
  // and create the trigger using a single statement.
  const conn = await mysql.createConnection({ host, port: Number(port), user, password, database, multipleStatements: true })
  try {
    console.log('Connected to', host + ':' + port, 'db=', database)

    // 1) Optional backup
    try {
      console.log('Creating backup table Ticket_backup if not exists')
      await conn.query('CREATE TABLE IF NOT EXISTS `Ticket_backup` AS SELECT * FROM `Ticket`')
    } catch (e) {
      console.warn('Backup step skipped or failed:', e && e.message ? e.message : e)
    }

    // Helper to check column existence
    async function columnExists(column) {
      const [rows] = await conn.query("SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Ticket' AND COLUMN_NAME = ?", [database, column])
      return (rows && rows[0] && rows[0].c > 0) || false
    }

    // Add columns if missing (MySQL 5.7 compatible)
    if (!(await columnExists('created_at'))) {
      console.log('Adding created_at column')
      await conn.query("ALTER TABLE `Ticket` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
    } else console.log('created_at exists')

    if (!(await columnExists('updated_at'))) {
      console.log('Adding updated_at column')
      await conn.query("ALTER TABLE `Ticket` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    } else console.log('updated_at exists')

    if (!(await columnExists('issued_at'))) {
      console.log('Adding issued_at column')
      await conn.query("ALTER TABLE `Ticket` ADD COLUMN `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
    } else console.log('issued_at exists')

    // Update existing rows (uuid, issued_at)
    console.log('Filling missing uuid and issued_at for existing rows')
    await conn.query("UPDATE `Ticket` SET `uuid` = UUID() WHERE `uuid` IS NULL OR `uuid` = ''")
    await conn.query("UPDATE `Ticket` SET `issued_at` = NOW() WHERE `issued_at` IS NULL")

    // Create trigger (single multi-statement)
    const triggerSql = `DROP TRIGGER IF EXISTS \`trg_ticket_before_insert\`; CREATE TRIGGER \`trg_ticket_before_insert\` BEFORE INSERT ON \`Ticket\` FOR EACH ROW BEGIN IF NEW.uuid IS NULL OR NEW.uuid = '' THEN SET NEW.uuid = UUID(); END IF; IF NEW.issued_at IS NULL THEN SET NEW.issued_at = NOW(); END IF; IF NEW.created_at IS NULL THEN SET NEW.created_at = NOW(); END IF; SET NEW.updated_at = NOW(); END;`;
    console.log('Creating trigger trg_ticket_before_insert')
    await conn.query(triggerSql)

    console.log('Migration applied successfully')
  } finally {
    await conn.end()
  }
}

main().catch(err => {
  console.error('Migration failed:', err && err.message ? err.message : err)
  process.exit(1)
})
