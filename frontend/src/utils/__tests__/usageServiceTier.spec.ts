import { describe, expect, it } from 'vitest'

import {
  formatUsageServiceTier,
  getUsageServiceTierLabel,
  getUsageServiceTierPresentation,
  isGptFastUsageChannel,
  normalizeUsageServiceTier,
} from '@/utils/usageServiceTier'

const translate = (key: string, params?: Record<string, string>) => {
  const messages: Record<string, string> = {
    'usage.serviceTierPriority': 'Fast',
    'usage.serviceTierUltrafast': 'Ultrafast',
    'usage.serviceTierFlex': 'Flex',
    'usage.serviceTierStandard': 'Standard',
    'usage.serviceTierFastChannelHint': 'Fast (channel label only, billing unchanged)',
  }
  const raw = messages[key] ?? key
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? `{${name}}`)
}

describe('usageServiceTier utils', () => {
  it('normalizes fast/default aliases', () => {
    expect(normalizeUsageServiceTier('fast')).toBe('priority')
    expect(normalizeUsageServiceTier(' default ')).toBe('standard')
    expect(normalizeUsageServiceTier('STANDARD')).toBe('standard')
  })

  it('preserves supported tiers', () => {
    expect(normalizeUsageServiceTier('priority')).toBe('priority')
    expect(normalizeUsageServiceTier('flex')).toBe('flex')
    expect(normalizeUsageServiceTier('ultrafast')).toBe('ultrafast')
  })

  it('formats empty values as standard', () => {
    expect(formatUsageServiceTier()).toBe('standard')
    expect(formatUsageServiceTier('')).toBe('standard')
  })

  it('passes through unknown non-empty tiers for display fallback', () => {
    expect(normalizeUsageServiceTier('custom-tier')).toBe('custom-tier')
    expect(formatUsageServiceTier('custom-tier')).toBe('custom-tier')
  })

  it('maps tiers to translated labels', () => {
    expect(getUsageServiceTierLabel('fast', translate)).toBe('Fast')
    expect(getUsageServiceTierLabel('ultrafast', translate)).toBe('Ultrafast')
    expect(getUsageServiceTierLabel('flex', translate)).toBe('Flex')
    expect(getUsageServiceTierLabel(undefined, translate)).toBe('Standard')
    expect(getUsageServiceTierLabel('custom-tier', translate)).toBe('custom-tier')
  })

  it('identifies only the exact GPT-Fast group 24 channel', () => {
    expect(isGptFastUsageChannel({ groupId: 24, groupName: 'GPT-Fast' })).toBe(true)
    expect(isGptFastUsageChannel({ groupId: 24 })).toBe(true)
    expect(isGptFastUsageChannel({ groupId: 24, groupName: ' GPT-Fast ' })).toBe(true)
    expect(isGptFastUsageChannel({ groupId: 24, groupName: 'GPT-Fast-Extra' })).toBe(false)
    expect(isGptFastUsageChannel({ groupId: 15, groupName: 'GPT-Fast' })).toBe(false)
    expect(isGptFastUsageChannel({ groupId: 99, groupName: 'Something-Fast' })).toBe(false)
    expect(isGptFastUsageChannel({ groupId: 24, groupName: 'GPT-Pro' })).toBe(false)
    expect(isGptFastUsageChannel()).toBe(false)
  })

  it('uses a Fast channel label only when the actual recorded tier is standard', () => {
    const standard = getUsageServiceTierPresentation(null, translate, { groupId: 24, groupName: 'GPT-Fast' })
    expect(standard.label).toBe('Fast')
    expect(standard.title).toBe('Fast (channel label only, billing unchanged)')

    const unnamed = getUsageServiceTierPresentation('standard', translate, { groupId: 24 })
    expect(unnamed.label).toBe('Fast')
    expect(unnamed.title).toBe(standard.title)
  })

  it('keeps actual priority and ultrafast labels honest on the Fast channel', () => {
    const priority = getUsageServiceTierPresentation('priority', translate, { groupId: 24, groupName: 'GPT-Fast' })
    expect(priority.label).toBe('Fast')
    expect(priority.title).toBeUndefined()

    const ultrafast = getUsageServiceTierPresentation('ultrafast', translate, { groupId: 24, groupName: 'GPT-Fast' })
    expect(ultrafast.label).toBe('Ultrafast')
    expect(ultrafast.title).toBeUndefined()
  })

  it('leaves ordinary groups on the recorded standard label', () => {
    const pro = getUsageServiceTierPresentation(null, translate, { groupId: 15, groupName: 'GPT-Pro' })
    expect(pro.label).toBe('Standard')
    expect(pro.title).toBeUndefined()

    const lookalike = getUsageServiceTierPresentation(null, translate, { groupId: 99, groupName: 'My-Fast-Group' })
    expect(lookalike.label).toBe('Standard')
    expect(lookalike.title).toBeUndefined()
  })
})
