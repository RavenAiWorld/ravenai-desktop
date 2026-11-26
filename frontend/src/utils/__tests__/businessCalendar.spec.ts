import { describe, expect, it } from 'vitest'
import { businessDate, businessDateRange, businessDayBoundary, businessDayDifference } from '../businessCalendar'

describe('Beijing business dates', () => {
  const beforeMidnight = new Date('2026-10-31T15:59:59.999Z')
  const midnight = new Date('2026-10-31T16:00:00Z')

  it('changes date and month at 16:00 UTC', () => {
    expect(businessDate(beforeMidnight)).toBe('2026-10-31')
    expect(businessDate(midnight)).toBe('2026-11-01')
    expect(businessDateRange('thisMonth', beforeMidnight)).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(businessDateRange('thisMonth', midnight)).toEqual({ start: '2026-11-01', end: '2026-11-01' })
    expect(businessDateRange('lastMonth', midnight)).toEqual({ start: '2026-10-01', end: '2026-10-31' })
  })

  it('builds inclusive calendar-day ranges with exclusive API timestamp ends', () => {
    expect(businessDateRange('today', midnight)).toEqual({ start: '2026-11-01', end: '2026-11-01' })
    expect(businessDateRange('yesterday', midnight)).toEqual({ start: '2026-10-31', end: '2026-10-31' })
    expect(businessDateRange('twoDays', midnight)).toEqual({ start: '2026-10-31', end: '2026-11-01' })
    expect(businessDateRange('7d', midnight)).toEqual({ start: '2026-10-26', end: '2026-11-01' })
    expect(businessDayBoundary('2026-11-01')).toBe(midnight.toISOString())
    expect(businessDayBoundary('2026-11-01', true)).toBe('2026-11-01T16:00:00.000Z')
    expect(businessDayDifference('2026-10-31', '2026-11-02')).toBe(2)
  })
})
