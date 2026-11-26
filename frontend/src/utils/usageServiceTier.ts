export const GPT_FAST_USAGE_GROUP_ID = 24
export const GPT_FAST_USAGE_GROUP_NAME = 'GPT-Fast'

export type UsageServiceTierGroupContext = {
  groupId?: number | null
  groupName?: string | null
}

export function normalizeUsageServiceTier(serviceTier?: string | null): string | null {
  const value = serviceTier?.trim().toLowerCase()
  if (!value) return null
  if (value === 'fast') return 'priority'
  if (value === 'default' || value === 'standard') return 'standard'
  if (value === 'priority' || value === 'flex' || value === 'ultrafast') return value
  return value
}

export function formatUsageServiceTier(serviceTier?: string | null): string {
  const normalized = normalizeUsageServiceTier(serviceTier)
  if (!normalized) return 'standard'
  return normalized
}

type Translate = (key: string, params?: Record<string, string>) => string

export function getUsageServiceTierLabel(
  serviceTier: string | null | undefined,
  translate: Translate,
): string {
  const tier = formatUsageServiceTier(serviceTier)
  if (tier === 'priority') return translate('usage.serviceTierPriority')
  if (tier === 'ultrafast') return translate('usage.serviceTierUltrafast')
  if (tier === 'flex') return translate('usage.serviceTierFlex')
  if (tier === 'standard') return translate('usage.serviceTierStandard')
  return tier
}

/** Exact GPT-Fast channel identity: group 24, and exact name when a name is present. */
export function isGptFastUsageChannel(ctx?: UsageServiceTierGroupContext | null): boolean {
  if (!ctx || ctx.groupId !== GPT_FAST_USAGE_GROUP_ID) return false
  const name = ctx.groupName?.trim()
  if (name) return name === GPT_FAST_USAGE_GROUP_NAME
  return true
}

export function getUsageServiceTierPresentation(
  serviceTier: string | null | undefined,
  translate: Translate,
  ctx?: UsageServiceTierGroupContext | null,
): { label: string; title?: string } {
  if (isGptFastUsageChannel(ctx) && formatUsageServiceTier(serviceTier) === 'standard') {
    return {
      label: translate('usage.serviceTierPriority'),
      title: translate('usage.serviceTierFastChannelHint'),
    }
  }
  return { label: getUsageServiceTierLabel(serviceTier, translate) }
}
