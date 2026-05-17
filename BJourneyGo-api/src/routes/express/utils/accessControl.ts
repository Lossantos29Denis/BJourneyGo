export function isStaffRole(role?: string) {
  return role === 'AGENCY_WORKER' || role === 'AGENCY_ADMIN' || role === 'ADMIN'
}

export function canAccessOrder(orderUserId: any, requesterId: any, role?: string) {
  return Number(orderUserId) === Number(requesterId) || isStaffRole(role)
}
