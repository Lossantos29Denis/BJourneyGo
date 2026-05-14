// Simple client helper to store tokens and auto-refresh on 401
const API_PROXY = '/api'

export function setToken(token) { localStorage.setItem('bjourney_token', token) }
export function getToken() { return localStorage.getItem('bjourney_token') }
export function setRefreshToken(token) { localStorage.setItem('bjourney_refresh', token) }
export function getRefreshToken() { return localStorage.getItem('bjourney_refresh') }
export function clearAuth() { localStorage.removeItem('bjourney_token'); localStorage.removeItem('bjourney_refresh'); localStorage.removeItem('auth'); localStorage.removeItem('user'); localStorage.removeItem('isAdmin'); }

async function refresh() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('no refresh token')
  const res = await fetch(`${API_PROXY}/refresh`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ refreshToken }) })
  if (!res.ok) throw new Error('refresh failed')
  const json = await res.json()
  if (json.token) setToken(json.token)
  return json.token
}

export async function fetchWithAuth(url, opts = {}) {
  const headers = opts.headers || {}
  let token = getToken()
  if (!token && getRefreshToken()) {
    try {
      await refresh()
      token = getToken()
    } catch (_error) {
      clearAuth()
    }
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  opts.headers = headers
  let res = await fetch(url, opts)
  if (res.status === 401) {
    try {
      await refresh()
      const newToken = getToken()
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`
      opts.headers = headers
      res = await fetch(url, opts)
    } catch (e) {
      clearAuth()
      throw e
    }
  }
  return res
}

window.BJourneyAuth = {
  setToken,
  getToken,
  setRefreshToken,
  getRefreshToken,
  clearAuth,
  fetchWithAuth
}
