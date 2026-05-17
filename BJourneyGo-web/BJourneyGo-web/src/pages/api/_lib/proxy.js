const API_URL = process.env.API_URL || 'http://localhost:4000'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.PROXY_TIMEOUT_MS || '15000', 10)

export function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  })
}

export async function readJsonBody(request, fallback = {}) {
  return request.json().catch(() => fallback)
}

function getTimeoutMs(value) {
  if (value === 0) return 0
  if (Number.isFinite(value) && value > 0) return value
  return Number.isFinite(DEFAULT_TIMEOUT_MS) ? DEFAULT_TIMEOUT_MS : 15000
}

async function fetchWithTimeout(url, options = {}, timeoutMs) {
  const resolvedTimeout = getTimeoutMs(timeoutMs)
  if (!resolvedTimeout) return fetch(url, options)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), resolvedTimeout)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function forwardJson(request, path, options = {}) {
  const {
    method = 'GET',
    body,
    forwardAuth = false,
    headers: extraHeaders = {},
    timeoutMs,
    responseHeaders = {},
  } = options

  const { headers, requestId } = buildProxyHeaders(request, forwardAuth, extraHeaders)
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const resp = await fetchWithTimeout(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }, timeoutMs)

  const json = await resp.json().catch(() => ({}))
  return jsonResponse(
    json,
    resp.status,
    {
      ...responseHeaders,
      ...(requestId ? { 'x-request-id': requestId } : {})
    }
  )
}

function getRequestId(request) {
  const existing = request?.headers?.get?.('x-request-id')
  if (existing) return existing
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function buildProxyHeaders(request, forwardAuth, extraHeaders = {}) {
  const headers = { ...extraHeaders }
  const requestId = getRequestId(request)
  if (requestId) headers['x-request-id'] = requestId
  if (forwardAuth) {
    const auth = request.headers.get('authorization')
    if (auth) headers['Authorization'] = auth
  }
  return { headers, requestId }
}

export async function forwardStream(request, path, options = {}) {
  const {
    method = 'GET',
    forwardAuth = false,
    headers: extraHeaders = {},
    passthroughHeaders = [],
    timeoutMs,
  } = options

  const { headers, requestId } = buildProxyHeaders(request, forwardAuth, extraHeaders)
  const resp = await fetchWithTimeout(`${API_URL}${path}`, { method, headers }, timeoutMs)

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    return new Response(text || JSON.stringify({ error: 'file not found' }), {
      status: resp.status,
      headers: {
        'Content-Type': resp.headers.get('content-type') || 'application/json',
        ...(requestId ? { 'x-request-id': requestId } : {})
      }
    })
  }

  const outHeaders = new Headers()
  for (const name of passthroughHeaders) {
    const value = resp.headers.get(name)
    if (value) outHeaders.set(name, value)
  }
  if (requestId) outHeaders.set('x-request-id', requestId)

  return new Response(resp.body, { status: 200, headers: outHeaders })
}

export async function forwardBinary(request, path, options = {}) {
  const {
    method = 'GET',
    forwardAuth = false,
    headers: extraHeaders = {},
    contentType,
    contentDisposition,
    timeoutMs,
  } = options

  const { headers, requestId } = buildProxyHeaders(request, forwardAuth, extraHeaders)
  const resp = await fetchWithTimeout(`${API_URL}${path}`, { method, headers }, timeoutMs)

  if (!resp.ok) {
    const msg = await resp.text().catch(() => 'error')
    return new Response(msg, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        ...(requestId ? { 'x-request-id': requestId } : {})
      }
    })
  }

  const buffer = await resp.arrayBuffer()
  const outHeaders = new Headers()
  if (contentType) outHeaders.set('Content-Type', contentType)
  if (contentDisposition) outHeaders.set('Content-Disposition', contentDisposition)
  outHeaders.set('Content-Length', String(buffer.byteLength))
  if (requestId) outHeaders.set('x-request-id', requestId)

  return new Response(buffer, { status: 200, headers: outHeaders })
}

export async function forwardFormData(request, path, options = {}) {
  const {
    method = 'POST',
    forwardAuth = false,
    headers: extraHeaders = {},
    timeoutMs,
  } = options

  const formData = await request.formData()
  const { headers, requestId } = buildProxyHeaders(request, forwardAuth, extraHeaders)
  const resp = await fetchWithTimeout(`${API_URL}${path}`, { method, headers, body: formData }, timeoutMs)

  const contentType = resp.headers.get('content-type') || 'application/json'
  const bodyText = await resp.text()

  return new Response(bodyText, {
    status: resp.status,
    headers: {
      'Content-Type': contentType,
      ...(requestId ? { 'x-request-id': requestId } : {})
    }
  })
}
