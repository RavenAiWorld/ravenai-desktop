import type { Group } from '@/types'

export function getGroupPreviousRate(group?: Group | null, userRateMultiplier?: number | null, enabled = true): number | null {
  // November 10, 2026: only these groups and prices belong to this announcement.
  if (
    !enabled || !group || ![15, 24].includes(group.id) || group.platform !== 'openai' ||
    group.subscription_type !== 'standard' || group.rate_multiplier !== 0.18
  ) return null

  const current = userRateMultiplier ?? group.rate_multiplier
  return current === 0.18 ? 0.2 : current === 0.15 ? 0.16 : null
}
