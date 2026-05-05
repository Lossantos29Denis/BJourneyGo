const mysql = require('mysql2/promise')

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1'
  const port = Number(process.env.DB_PORT || 3306)
  const user = process.env.DB_USER
  const password = process.env.DB_PASS
  const database = process.env.DB_NAME

  if (!user || !password || !database) {
    console.error('Set DB_USER, DB_PASS and DB_NAME before running this script')
    process.exit(1)
  }

  const pool = mysql.createPool({ host, port, user, password, database, connectionLimit: 5 })

  try {
    const [agencies] = await pool.query('SELECT id FROM `Agency` LIMIT 1')
    let agencyId
    if (!agencies || agencies.length === 0) {
      const [ins] = await pool.query('INSERT INTO `Agency` (name, contact_email, created_at, updated_at) VALUES (?, ?, NOW(), NOW())', ['Sample Transit', 'info@example.com'])
      agencyId = ins.insertId
      console.log('Created sample Agency id=', agencyId)
    } else {
      agencyId = agencies[0].id
      console.log('Found existing Agency id=', agencyId)
    }

    const [buses] = await pool.query('SELECT id FROM `Bus` WHERE agency_id = ? LIMIT 1', [agencyId])
    let busId
    if (!buses || buses.length === 0) {
      const [ins] = await pool.query('INSERT INTO `Bus` (agency_id, plate, capacity, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [agencyId, 'SAMPLE-001', 40])
      busId = ins.insertId
      console.log('Created sample Bus id=', busId)
    } else {
      busId = buses[0].id
      console.log('Found existing Bus id=', busId)
    }

    const [routes] = await pool.query('SELECT id FROM `Route` WHERE agency_id = ? LIMIT 1', [agencyId])
    let routeId
    if (!routes || routes.length === 0) {
      const [ins] = await pool.query('INSERT INTO `Route` (code, agency_id, origin, destination, distance_km, duration_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())', ['SAMP-01', agencyId, 'City A', 'City B', 120, 90])
      routeId = ins.insertId
      console.log('Created sample Route id=', routeId)
    } else {
      routeId = routes[0].id
      console.log('Found existing Route id=', routeId)
    }

    const [trips] = await pool.query('SELECT id FROM `Trip` WHERE route_id = ? AND bus_id = ? LIMIT 1', [routeId, busId])
    if (!trips || trips.length === 0) {
      const departure = new Date(Date.now() + 24 * 3600 * 1000)
      const arrival = new Date(departure.getTime() + 90 * 60 * 1000)
      const [ins] = await pool.query('INSERT INTO `Trip` (route_id, bus_id, departure_at, arrival_at, capacity, base_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())', [routeId, busId, departure, arrival, 40, 25.00])
      console.log('Created sample Trip id=', ins.insertId)
    } else {
      console.log('Found existing Trip id=', trips[0].id)
    }

    console.log('Seeding complete.')
    process.exit(0)
  } catch (e) {
    console.error('Error seeding sample data:', e)
    process.exit(1)
  }
}

main()
