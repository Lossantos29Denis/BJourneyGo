const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1'
  const port = Number(process.env.DB_PORT || 3306)
  const user = process.env.DB_USER
  const password = process.env.DB_PASS
  const database = process.env.DB_NAME

  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  const adminName = process.env.ADMIN_NAME || 'Admin'

  if (!user || !password || !database) {
    console.error('Set DB_USER, DB_PASS and DB_NAME before running this script')
    process.exit(1)
  }
  if (!adminEmail || !adminPassword) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script')
    process.exit(1)
  }

  const conn = await mysql.createConnection({ host, port, user, password, database })
  try {
    const [rows] = await conn.query('SELECT id FROM `User` WHERE email = ? LIMIT 1', [adminEmail])
    const hash = await bcrypt.hash(adminPassword, 10)
    if (rows && rows.length > 0) {
      const id = rows[0].id
      await conn.query('UPDATE `User` SET password_hash = ?, name = ?, role = ?, updated_at = NOW() WHERE id = ?', [hash, adminName, 'ADMIN', id])
      console.log('Updated existing user to ADMIN:', adminEmail)
    } else {
      const uuid = crypto.randomUUID()
      await conn.query('INSERT INTO `User` (uuid, email, password_hash, name, role, is_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())', [uuid, adminEmail, hash, adminName, 'ADMIN', 1])
      console.log('Created new ADMIN user:', adminEmail)
    }
  } catch (e) {
    console.error('Error creating admin:', e && e.message ? e.message : e)
    process.exitCode = 1
  } finally {
    await conn.end()
  }
}

main()
