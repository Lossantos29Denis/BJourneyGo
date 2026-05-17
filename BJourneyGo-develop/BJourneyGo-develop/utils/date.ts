export function parseLocalDateTime(value?: string) {
    console.log('parseLocalDateTime ejecutada con:', value)
    const raw = String(value || '').trim()
    if (!raw) return new Date(NaN)

    const m = raw.match(
        /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/
    )

    if (m) {
        const [, y, mo, d, h, mi, s] = m
        return new Date(
            Number(y),
            Number(mo) - 1,
            Number(d),
            Number(h),
            Number(mi),
            Number(s || '0')
        )
    }

    return new Date(raw)
}

export function formatDateTime(value?: string) {
  console.log('formatDateTime ejecutada con:', value)

  const d = parseLocalDateTime(value)
  if (Number.isNaN(d.getTime())) return 'Fecha pendiente'

  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function durationLabel(start?: string, end?: string) {
  const a = parseLocalDateTime(start)
  const b = parseLocalDateTime(end)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 'Duracion pendiente'

  const mins = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}
