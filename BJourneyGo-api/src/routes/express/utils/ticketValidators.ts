export function normalizeText(value: any) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function identifierCandidates(value: any) {
  const base = normalizeText(value)
  if (!base) return [] as string[]
  const compact = base.replace(/\s+/g, ' ').trim()
  const alphaNum = compact.replace(/[^a-z0-9]/g, '')
  const digits = compact.replace(/\D/g, '')
  const out = new Set<string>()
  out.add(compact)
  if (alphaNum) out.add(alphaNum)
  if (digits) out.add(digits)
  return Array.from(out)
}

export function identifiersMatch(presentedId: any, values: any[]) {
  const presented = new Set(identifierCandidates(presentedId))
  if (presented.size === 0) return false
  for (const value of values) {
    for (const candidate of identifierCandidates(value)) {
      if (presented.has(candidate)) return true
    }
  }
  return false
}
