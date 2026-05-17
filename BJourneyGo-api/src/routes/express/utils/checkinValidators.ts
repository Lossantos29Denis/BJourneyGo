import {
    normalizeEmail,
    normalizeIdentifier,
    normalizePhone,
    normalizeReferenceCode,
} from './inputParsers.js'

export type CheckinLookupInput = {
  referenceCode: string
  identifierRaw: string
}

export type CheckinContactInput = CheckinLookupInput & {
  nextEmail: string
  nextPhone: string
}

export function parseCheckinLookupInput(body: any): CheckinLookupInput | null {
  const referenceCode = normalizeReferenceCode(body?.referenceCode)
  const identifierRaw = normalizeIdentifier(body?.identifier)
  if (!referenceCode || !identifierRaw) return null
  return { referenceCode, identifierRaw }
}

export function parseCheckinContactInput(body: any): CheckinContactInput | null {
  const base = parseCheckinLookupInput(body)
  if (!base) return null

  const nextEmail = normalizeEmail(body?.contactEmail)
  const nextPhone = normalizePhone(body?.contactPhone)
  return { ...base, nextEmail, nextPhone }
}
