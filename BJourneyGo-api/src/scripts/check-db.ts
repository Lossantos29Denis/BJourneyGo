import dotenv from 'dotenv'
import { query } from '../lib/db'

dotenv.config()

async function main() {
  try {
    const rows = await query('SELECT 1 + 1 AS ok')
    console.log('DB OK:', rows)
    process.exit(0)
  } catch (err: any) {
    console.error('DB connection failed:', err.message || err)
    process.exit(1)
  }
}

main()
