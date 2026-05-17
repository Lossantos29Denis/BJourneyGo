export function normalizeReferenceCode(value: unknown) {
  return String(value || '').trim().toUpperCase()
}

export function normalizeIdentifier(value: unknown) {
  return String(value || '').trim()
}

export function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

export function normalizePhone(value: unknown) {
  return String(value || '').trim().replace(/[^\d+]/g, '')
}
