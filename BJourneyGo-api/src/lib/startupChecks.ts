import db from './db'

export async function runStartupChecks() {
  // Validate essential environment variables
  const jwt = process.env.JWT_SECRET
  if (!jwt || jwt === 'change-this-secret-to-a-strong-value') {
    throw new Error('Critical: JWT_SECRET is not set or uses the default. Set a strong JWT_SECRET in the environment.')
  }

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)
  const hasDbParts = Boolean(process.env.DB_USER && process.env.DB_PASS && process.env.DB_NAME)
  if (!hasDatabaseUrl && !hasDbParts) {
    throw new Error('Critical: Database configuration missing. Set DATABASE_URL or DB_HOST/DB_USER/DB_PASS/DB_NAME.')
  }

  // Try connecting to the database
  try {
    await db.query('SELECT 1')
  } catch (e) {
    throw new Error('Critical: Cannot connect to the database: ' + String(e))
  }

  // Check Ticket table columns
  try {
    const cols: any = await db.query("SHOW COLUMNS FROM `Ticket`")
    const names = (cols || []).map((c: any) => String(c.Field))
    const missing: string[] = []
    for (const col of ['uuid', 'issued_at']) {
      if (!names.includes(col)) missing.push(col)
    }
    if (missing.length > 0) {
      console.warn('Startup check: `Ticket` table missing columns:', missing.join(', '))
    }
  } catch (e) {
    console.warn('Startup check: Could not inspect `Ticket` table:', String(e))
  }

  // Check for trigger (best-effort — may fail under restricted privileges)
  try {
    const triggers: any = await db.query("SHOW TRIGGERS WHERE `Table` = 'Ticket'")
    if (!triggers || triggers.length === 0) {
      console.warn('Startup check: trigger `trg_ticket_before_insert` not found on `Ticket` table (ok if app sets uuid/issued_at).')
    } else {
      const found = triggers.some((t: any) => String(t.Trigger).toLowerCase() === 'trg_ticket_before_insert')
      if (!found) console.warn('Startup check: `trg_ticket_before_insert` trigger not present on `Ticket` table.')
    }
  } catch (e) {
    console.warn('Startup check: Could not list triggers (may lack privileges):', String(e))
  }

  // Mailjet creds are optional — warn if mail usage expected
  if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_API_SECRET) {
    console.warn('Startup check: Mailjet credentials not set. Email sending will be disabled or fail.')
  }

  console.log('Startup checks passed (with possible warnings).')
}

export default {
  runStartupChecks,
}
