import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import Constants from 'expo-constants'

// Resolve API URL from multiple config sources (Expo extras, env, fallback).
let API_URL = (Constants.expoConfig as any)?.extra?.API_URL || process.env.API_URL || 'http://localhost:4000'

// If running inside Expo, try to replace localhost with the dev machine host so
// the app (on device or emulator) can reach the API automatically.
try {
  // debuggerHost includes host:port when running in Expo (e.g. "192.168.1.10:19000")
  const dbg = (Constants.manifest && (Constants.manifest as any).debuggerHost) || (Constants.manifest2 && (Constants.manifest2 as any).packagerOpts && (Constants.manifest2 as any).debuggerHost)
  if (dbg && typeof dbg === 'string') {
    const host = dbg.split(':')[0]
    if (API_URL.includes('localhost')) API_URL = API_URL.replace('localhost', host)
  }
} catch (e) {
  // ignore
}

// Android emulator (classic AVD) cannot reach host 'localhost' — use 10.0.2.2
if (Platform.OS === 'android' && API_URL.includes('localhost')) {
  API_URL = API_URL.replace('localhost', '10.0.2.2')
}

// Log the resolved API URL for easier debugging in Metro/Expo logs
// eslint-disable-next-line no-console
console.log('[lib/api] using API_URL =', API_URL)

export async function setToken(token: string) {
  await AsyncStorage.setItem('bjourney_token', token)
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('bjourney_token')
}

export async function setRefreshToken(token: string) {
  await AsyncStorage.setItem('bjourney_refresh', token)
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem('bjourney_refresh')
}

export async function clearTokens() {
  await AsyncStorage.multiRemove(['bjourney_token', 'bjourney_refresh'])
}

export async function me() {
  const token = await getToken()
  if (!token) throw new Error('no token')
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err: any = new Error(json.error || 'me failed')
    err.status = res.status
    err.code = json.error || 'ME_FAILED'
    throw err
  }
  return json
}

async function refreshAccessToken() {
  const refresh = await getRefreshToken()
  if (!refresh) throw new Error('no refresh token')
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh })
  })
  if (!res.ok) throw new Error('refresh failed')
  const json = await res.json()
  if (!json.token) throw new Error('no token in refresh response')
  await setToken(json.token)
  return json.token
}

export async function fetchWithAuth(path: string, opts: any = {}) {
  const token = await getToken()
  const headers = opts.headers || {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  opts.headers = headers
  let res = await fetch(`${API_URL}${path}`, opts)
  if (res.status === 401) {
    try {
      const newToken = await refreshAccessToken()
      headers['Authorization'] = `Bearer ${newToken}`
      opts.headers = headers
      res = await fetch(`${API_URL}${path}`, opts)
    } catch (e) {
      throw e
    }
  }
  return res
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'login failed')
  // store tokens if present
  if (json.token) await setToken(json.token)
  if (json.refreshToken) await setRefreshToken(json.refreshToken)
  return json
}

export async function register(email: string, password: string, name?: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'register failed')
  return json
}

export async function verifyStatus(jti: string) {
  const res = await fetch(`${API_URL}/auth/verify-status?jti=${encodeURIComponent(jti)}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'verify status failed')
  return json
}

export async function resendVerificationEmailPublic(email: string, verificationId: string) {
  const res = await fetch(`${API_URL}/auth/resend-verify-public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, verificationId })
  })
  const json = await res.json()
  if (!res.ok) throw Object.assign(new Error(json.error || 'resend failed'), { code: json.code })
  return json
}

export async function getTrips(params: { q?: string; origin?: string; destination?: string; date?: string; startDate?: string; endDate?: string } = {}) {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.origin) qs.set('origin', params.origin)
  if (params.destination) qs.set('destination', params.destination)
  if (params.date) qs.set('date', params.date)
  if (params.startDate) qs.set('startDate', params.startDate)
  if (params.endDate) qs.set('endDate', params.endDate)
  const res = await fetch(`${API_URL}/trips${qs.toString() ? `?${qs.toString()}` : ''}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'trips failed')
  return json
}

export async function getMyOrders() {
  const res = await fetchWithAuth('/orders/my')
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'my orders failed')
  return json
}

export async function getTicketAlternatives(ticketUuid: string, days = 7) {
  const safeUuid = encodeURIComponent(String(ticketUuid || '').trim())
  const safeDays = Math.max(1, Math.min(30, Math.floor(Number(days) || 7)))
  const res = await fetchWithAuth(`/orders/tickets/${safeUuid}/alternatives?days=${safeDays}`)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'ticket alternatives failed')
  return json
}

export async function changeTicketTrip(ticketUuid: string, newTripId: number) {
  const safeUuid = encodeURIComponent(String(ticketUuid || '').trim())
  const res = await fetchWithAuth(`/orders/tickets/${safeUuid}/change-trip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newTripId: Number(newTripId) })
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'change ticket trip failed')
  return json
}

export async function cancelTicket(ticketUuid: string) {
  const safeUuid = encodeURIComponent(String(ticketUuid || '').trim())
  const res = await fetchWithAuth(`/orders/tickets/${safeUuid}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'cancel ticket failed')
  return json
}

type CheckoutPassenger = {
  fullName: string
  identification: string
  phone?: string | null
  email?: string | null
  isContact?: boolean
}

type CheckoutPayload = {
  tripId?: number
  outboundTripId?: number
  returnTripId?: number
  quantity?: number
  passengers?: CheckoutPassenger[]
  contactEmail?: string
  contactPhone?: string
}

export async function createStripeCheckoutSession(
  tripOrPayload: number | CheckoutPayload,
  quantity = 1
) {
  const payload = typeof tripOrPayload === 'number'
    ? { tripId: tripOrPayload, quantity }
    : {
        tripId: tripOrPayload.tripId,
        outboundTripId: tripOrPayload.outboundTripId,
        returnTripId: tripOrPayload.returnTripId,
        quantity: Number(tripOrPayload.quantity || 1),
        passengers: Array.isArray(tripOrPayload.passengers) ? tripOrPayload.passengers : [],
        contactEmail: String(tripOrPayload.contactEmail || '').trim().toLowerCase(),
        contactPhone: tripOrPayload.contactPhone || undefined,
      }

  const res = await fetchWithAuth('/payments/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'checkout failed')
  return json
}

export async function verifyQrTicket(qrPayload: string, presentedId?: string) {
  return verifyQrTicketInSession({ qrPayload, presentedId })
}

export async function getScannerTrips(params: { date?: string } = {}) {
  const qs = new URLSearchParams()
  if (params.date) qs.set('date', params.date)
  const res = await fetchWithAuth(`/tickets/scanner/trips${qs.toString() ? `?${qs.toString()}` : ''}`)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'scanner trips failed')
  return json
}

export async function startScannerSession(params: { tripId: number; accessCode?: string }) {
  const res = await fetchWithAuth('/tickets/scanner/start-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'start scanner session failed')
  return json
}

export async function getActiveScannerSession() {
  const res = await fetchWithAuth('/tickets/scanner/active-session')
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'active scanner session failed')
  return json
}

export async function getTripPassengers(tripId: number) {
  const res = await fetchWithAuth(`/tickets/scanner/trips/${tripId}/passengers`)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'trip passengers failed')
  return json
}

export async function verifyQrTicketInSession(params: {
  qrPayload: string;
  presentedId?: string;
  tripId?: number;
  scannerSessionId?: number;
  accessCode?: string;
}) {
  const res = await fetchWithAuth('/tickets/verify-qr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'verify qr failed')
  return json
}

export async function previewQrTicketInSession(params: {
  qrPayload: string;
  tripId?: number;
  scannerSessionId?: number;
  accessCode?: string;
}) {
  const res = await fetchWithAuth('/tickets/preview-qr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'preview qr failed')
  return json
}

export async function createScannerOperator(params: { email: string; name: string; password: string; agencyName: string; agencyPhone?: string; agencyAddress?: string }) {
  const res = await fetchWithAuth('/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      name: params.name,
      password: params.password,
      role: 'SCANNER',
      agencyName: params.agencyName,
      agencyPhone: params.agencyPhone,
      agencyAddress: params.agencyAddress,
    })
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'create scanner user failed')
  return json
}
