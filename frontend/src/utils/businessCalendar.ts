export const BUSINESS_TIME_ZONE = 'Asia/Shanghai'
const DAY_MS = 86_400_000
const DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

type BusinessRangePreset = 'today' | 'yesterday' | 'twoDays' | '7d' | '14d' | '30d' | 'thisMonth' | 'lastMonth'

export function businessDate(date = new Date()): string {
  const parts = DATE_FORMAT.formatToParts(date)
  return ['year', 'month', 'day'].map((name) => parts.find(({ type }) => type === name)?.value).join('-')
}

export function businessDateRange(preset: BusinessRangePreset, now = new Date()): { start: string; end: string } {
  const today = businessDate(now)
  // Use UTC only for arithmetic on a date label, not to select the calendar day.
  const date = new Date(`${today}T00:00:00Z`)
  const atOffset = (days: number) => new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10)
  switch (preset) {
    case 'today': return { start: today, end: today }
    case 'yesterday': {
      const yesterday = atOffset(-1)
      return { start: yesterday, end: yesterday }
    }
    case 'twoDays': return { start: atOffset(-1), end: today }
    case '7d': return { start: atOffset(-6), end: today }
    case '14d': return { start: atOffset(-13), end: today }
    case '30d': return { start: atOffset(-29), end: today }
    case 'thisMonth': return { start: `${today.slice(0, 7)}-01`, end: today }
    case 'lastMonth': {
      const year = date.getUTCFullYear()
      const month = date.getUTCMonth()
      const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10)
      const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
      return { start, end }
    }
  }
}

export function businessDayDifference(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS
}

// The error-log API takes explicit instants and an exclusive end timestamp.
export function businessDayBoundary(date: string, nextDay = false): string {
  return new Date(Date.parse(`${date}T00:00:00+08:00`) + (nextDay ? DAY_MS : 0)).toISOString()
}
