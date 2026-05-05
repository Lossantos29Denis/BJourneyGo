#!/usr/bin/env node
/**
 * recreate_db_remote.js
 *
 * Usage (env):
 *   DB_HOST=host DB_PORT=3306 DB_USER=user DB_PASS=pass node scripts/recreate_db_remote.js
 *
 * Or args:
 *   node scripts/recreate_db_remote.js host port user pass
 *
 * The script will:
 *  - prompt for confirmation
 *  - DROP DATABASE IF EXISTS `BJourneyGo`
 *  - execute the SQL statements in db/schema_init.sql
 *
 * WARNING: this will permanently remove the existing BJourneyGo database.
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const mysql = require('mysql2/promise')

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans) }))
}

async function main() {
  const host = process.env.DB_HOST || process.argv[2]
  const port = process.env.DB_PORT || process.argv[3] || 3306
  const user = process.env.DB_USER || process.argv[4]
  const password = process.env.DB_PASS || process.argv[5]
  const dbName = process.env.DB_NAME || process.argv[6] || 'BJourneyGo'

  if (!host || !user || !password) {
    console.error('Usage: set DB_HOST, DB_PORT, DB_USER, DB_PASS (or pass as args)')
    process.exit(2)
  }

  console.log(`About to DROP and RECREATE database ${dbName} on ${host}:${port}`)
  const ans = (await prompt('Type the database name to confirm and proceed: ')).trim()
  if (ans !== dbName) {
    console.log('Confirmation did not match. Aborting.')
    process.exit(0)
  }

  const schemaFile = path.resolve(__dirname, '..', '..', 'db', 'schema_init.sql')
  if (!fs.existsSync(schemaFile)) {
    console.error('schema_init.sql not found at', schemaFile)
    process.exit(1)
  }

  let sql = fs.readFileSync(schemaFile, 'utf8')

  // Convert DELIMITER blocks so the driver can execute the CREATE TRIGGER statement.
  // Replace "DELIMITER $$ ... END$$ DELIMITER ;" with a single statement ending in 'END;'
  // This is a best-effort conversion that works for the trigger block used in schema_init.sql
  sql = sql.replace(/DELIMITER\s*\$\$\s*/gi, '')
  sql = sql.replace(/\$\$/g, ';')
  sql = sql.replace(/DELIMITER\s*;\s*/gi, '')

  // Connect to server (not selecting a DB yet)
  const conn = await mysql.createConnection({ host, port: Number(port), user, password, multipleStatements: true })
  try {
    console.log('Connected to MySQL server')

    console.log(`Dropping database if exists: ${dbName}`)
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``)

    console.log('Applying schema_init.sql ... this may take a few seconds')
    // The schema file includes CREATE DATABASE and USE, so we can execute it as-is
    await conn.query(sql)

    console.log('Database recreated successfully')
  } catch (err) {
    console.error('Failed:', err && err.message ? err.message : err)
    process.exit(1)
  } finally {
    await conn.end()
  }
}

main().catch(err => {
  console.error('Error:', err && err.message ? err.message : err)
  process.exit(1)
})
