const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const child = require('child_process')

const API_URL = process.env.API_URL || 'http://localhost:4000'

async function runSeed() {
  console.log('Running seed_sample_data.js...')
  return new Promise((resolve, reject) => {
    const p = child.exec('node scripts/seed_sample_data.js', { cwd: process.cwd(), env: process.env }, (err, stdout, stderr) => {
      if (err) return reject(err)
      console.log(stdout)
      if (stderr) console.error(stderr)
      resolve()
    })
  })
}

async function api(path, opts={}){
  const url = API_URL + path
  const res = await fetch(url, opts)
  const txt = await res.text()
  try { return JSON.parse(txt) } catch(e){ return { status: res.status, text: txt } }
}

async function main(){
  try {
    await runSeed()
  } catch (e) {
    console.warn('Seed failed (continuing):', e.message || e)
  }

  // register
  const email = `test+${Date.now()}@example.com`
  const password = 'TestPassword123!'
  console.log('Registering user', email)
  const reg = await api('/auth/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password, name: 'Integration Test' }) })
  console.log('Register response:', reg)

  // login
  const login = await api('/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
  console.log('Login response:', login)
  if (!login || !login.token) throw new Error('Login failed')
  const token = login.token

  // get trips
  const tripsRes = await api('/trips')
  const trips = tripsRes.trips || []
  if (trips.length === 0) throw new Error('No trips available (run seed or create trips)')
  const trip = trips[0]
  console.log('Using trip', trip.id)

  // purchase
  const purchase = await api('/orders/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ tripId: trip.id, quantity: 1, paymentProvider: 'test', providerRef: `testref-${Date.now()}` }) })
  console.log('Purchase response:', purchase)
  const orderId = purchase.orderId || purchase?.orderId || (purchase?.orderId)
  if (!orderId && purchase?.orderId === undefined) {
    // sometimes purchase returns { orderId } inside object
    if (purchase && purchase.orderId) orderId = purchase.orderId
  }

  // try reading order back
  const order = await api(`/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
  console.log('Order fetched:', order)

  // simulate payment capture
  const reconcile = await api('/payments/reconcile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ provider: 'test', providerRef: `cap-${Date.now()}`, status: 'CAPTURED', amount: order.order?.totalAmount || 0, currency: 'USD', orderId }) })
  console.log('Reconcile response:', reconcile)

  // fetch order again to see tickets
  const order2 = await api(`/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
  console.log('Order after capture:', order2)

  console.log('Integration test finished')
}

main().catch(e => { console.error('Integration test failed:', e); process.exit(1) })
