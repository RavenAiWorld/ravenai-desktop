import { describe, expect, it } from 'vitest'
import {
  isModelHealthExcludedAccount,
  modelHealthGroupProbePresentation,
} from '../modelHealthProvider'
import type { ModelHealthProviders } from '@/api/admin/modelHealth'
import zh from '@/i18n/locales/zh/admin/modelHealth'
import en from '@/i18n/locales/en/admin/modelHealth'

const now = Date.parse('2026-11-17T10:40:34Z')
const fresh: ModelHealthProviders = {
  source: 'aihub',
  generated_at: new Date(now - 16000).toISOString(),
  fetched_at: new Date(now).toISOString(),
  stale: false,
  metrics_stale: false,
  error: '',
  catalog: [],
  accounts: {},
}
const group = (available: boolean | null | undefined, expiresAt: string | undefined, includeAvailable = true) => {
  const value: { available?: boolean | null; probe_expires_at?: string } = {}
  if (includeAvailable) value.available = available
  if (expiresAt) value.probe_expires_at = expiresAt
  return value
}
const unexpired = new Date(now + 120000).toISOString()
const expired = new Date(now - 120000).toISOString()

describe('model health group probe vs excluded accounts', () => {
  it('excludes only exact account 147 and not other ids or Fast-named ids', () => {
    expect(isModelHealthExcludedAccount(147)).toBe(true)
    expect(isModelHealthExcludedAccount(145)).toBe(false)
    expect(isModelHealthExcludedAccount(140)).toBe(false)
    expect(isModelHealthExcludedAccount(146)).toBe(false)
    expect(isModelHealthExcludedAccount(undefined)).toBe(false)
  })

  it('labels a false group probe as abnormal without treating models as unavailable', () => {
    const view = modelHealthGroupProbePresentation(470, group(false, unexpired), fresh, now)
    expect(view.status).toBe('abnormal')
    expect(view.labelKey).toBe('admin.modelHealth.groupProbeAbnormal')
    expect(view.availableRaw).toBe('false')
    expect(view.probeExpiresRaw).toBe(new Date(unexpired).toISOString())
    expect(view.feedRaw).toBe('fresh')
    expect(view.titleKey).toBe('admin.modelHealth.groupProbeAbnormalHint')
    expect(zh.modelHealth.groupProbeAbnormalHint).toContain('不代表模型不可用')
    expect(zh.modelHealth.groupProbeAbnormalHint).toContain('{available}')
    expect(en.modelHealth.groupProbeAbnormalHint).toContain('does not mean models are unavailable')
  })

  it('keeps expired or null group flags as unknown, distinct from abnormal', () => {
    const expiredView = modelHealthGroupProbePresentation(470, group(false, expired), fresh, now)
    expect(expiredView.status).toBe('unknown')
    expect(expiredView.labelKey).toBe('admin.modelHealth.groupProbeUnknown')
    expect(expiredView.availableRaw).toBe('false')
    expect(expiredView.probeExpiresRaw).toBe(new Date(expired).toISOString())
    const nullView = modelHealthGroupProbePresentation(470, group(null, unexpired), fresh, now)
    expect(nullView.status).toBe('unknown')
    expect(nullView.labelKey).toBe('admin.modelHealth.groupProbeUnknown')
    expect(nullView.availableRaw).toBe('null')
    expect(zh.modelHealth.groupProbeUnknownHint).toContain('过期/缺失不代表模型不可用')
    expect(en.modelHealth.groupProbeUnknownHint).toContain('stale or missing data does not mean models are unavailable')
  })

  it('uses a distinct source-failure label when the provider feed is stale or failed', () => {
    const stale = modelHealthGroupProbePresentation(470, group(false, unexpired), { ...fresh, stale: true }, now)
    expect(stale.status).toBe('source_failed')
    expect(stale.labelKey).toBe('admin.modelHealth.groupProbeSourceFailed')
    expect(stale.feedRaw).toBe('stale')
    expect(stale.availableRaw).toBe('false')
    const failed = modelHealthGroupProbePresentation(470, group(true, unexpired), { ...fresh, error: 'provider_query_failed' }, now)
    expect(failed.status).toBe('source_failed')
    expect(failed.labelKey).toBe('admin.modelHealth.groupProbeSourceFailed')
    expect(failed.feedRaw).toBe('error')
    expect(failed.labelKey).not.toBe(stale.status === 'unknown' ? 'x' : 'admin.modelHealth.groupProbeUnknown')
    expect(failed.labelKey).not.toBe('admin.modelHealth.groupProbeAbnormal')
    expect(zh.modelHealth.groupProbeSourceFailed).not.toBe(zh.modelHealth.groupProbeUnknown)
    expect(en.modelHealth.groupProbeSourceFailed).not.toBe(en.modelHealth.groupProbeUnknown)
    expect(zh.modelHealth.groupProbeSourceFailedHint).toContain('不是模型不可用判定')
  })

  it('keeps a true unexpired group probe as normal', () => {
    const view = modelHealthGroupProbePresentation(470, group(true, unexpired), fresh, now)
    expect(view.status).toBe('ok')
    expect(view.labelKey).toBe('admin.modelHealth.groupProbeOk')
    expect(view.availableRaw).toBe('true')
  })
})
