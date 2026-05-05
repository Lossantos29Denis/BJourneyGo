import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

function createPoolIfNeeded() {
  if (pool) return pool

  const url = process.env.DATABASE_URL
  if (url) {
    pool = mysql.createPool(url as any)
    return pool
  }

  const host = process.env.DB_HOST || '127.0.0.1'
  const port = Number(process.env.DB_PORT || 3306)
  const user = process.env.DB_USER
  const password = process.env.DB_PASS
  const database = process.env.DB_NAME

  if (!user || !password || !database) {
    throw new Error('Database configuration missing. Set DATABASE_URL or DB_HOST/DB_USER/DB_PASS/DB_NAME.')
  }

  pool = mysql.createPool({ host, port, user, password, database, connectionLimit: 10 })
  return pool
}

export async function query(sql: string, params: any[] = []) {
  const p = createPoolIfNeeded()
  const [rows] = await p.query(sql, params)
  return rows
}

export async function transaction(fn: (conn: any) => Promise<any>) {
  const p = createPoolIfNeeded()
  const conn = await p.getConnection()
  try {
    await conn.beginTransaction()
    const wrapper = {
      query: (sql: string, params: any[] = []) => conn.query(sql, params),
      execute: (sql: string, params: any[] = []) => conn.execute(sql, params),
    }
    const res = await fn(wrapper)
    await conn.commit()
    return res
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export default {
  query,
  transaction,
}
