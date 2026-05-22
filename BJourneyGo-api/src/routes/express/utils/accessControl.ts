export function isStaffRole(role?: string) {
  return role === 'AGENCY_WORKER' || role === 'AGENCY_ADMIN' || role === 'ADMIN'
}

function normalizeEmail(value: any): string {
  return String(value || '').trim().toLowerCase()
}

export function canAccessOrder(orderUserId: any, requesterId: any, role?: string, orderContactEmail?: any, requesterEmail?: any) {
  if (isStaffRole(role)) return true
  if (Number(orderUserId) === Number(requesterId)) return true
  const contactEmail = normalizeEmail(orderContactEmail)
  const userEmail = normalizeEmail(requesterEmail)
  return Boolean(contactEmail && userEmail && contactEmail === userEmail)
}
