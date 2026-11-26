import { describe, expect, it } from 'vitest'
import { modelHealthProviderHealth } from '../modelHealthProvider'
import type { ModelHealthProviderModel, ModelHealthProviders } from '@/api/admin/modelHealth'

const now = Date.parse('2026-11-16T04:00:00Z')
const source: ModelHealthProviders = { source: 'aihub', generated_at: new Date(now - 600000).toISOString(), fetched_at: new Date(now).toISOString(), stale: false, metrics_stale: true, error: '', catalog: [], accounts: {} }
const model = (): ModelHealthProviderModel => ({ model: 'gpt-6.1-sol', health: 'healthy', sample_count: 5, health_evaluated_at: new Date(now).toISOString(), health_expires_at: new Date(now + 60000).toISOString() })

describe('Independent provider model health freshness', () => {
  it('keeps fresh healthy and failed model observations usable during statistics refresh', () => {
    expect(modelHealthProviderHealth(model(), source, now)).toBe('healthy')
    expect(modelHealthProviderHealth({ ...model(), health: 'failed' }, source, now)).toBe('failed')
    expect(modelHealthProviderHealth({ ...model(), health: 'insufficient' }, source, now)).toBe('unknown')
  })

  it.each([
    { health_evaluated_at: undefined }, { health_evaluated_at: 'invalid' },
    { health_evaluated_at: new Date(now - 120001).toISOString() },
    { health_evaluated_at: new Date(now + 30001).toISOString() },
    { health_expires_at: undefined }, { health_expires_at: 'invalid' },
    { health_expires_at: new Date(now).toISOString() }, { probe_state: 'disabled' }
  ])('rejects invalid or expired observation %j', invalid => {
    expect(modelHealthProviderHealth({ ...model(), ...invalid }, source, now)).toBe('stale')
  })

  it('pauses on real feed or authentication failure even with unexpired cards', () => {
    expect(modelHealthProviderHealth(model(), { ...source, stale: true }, now)).toBe('stale')
    expect(modelHealthProviderHealth(model(), { ...source, error: 'provider_auth_failed' }, now)).toBe('stale')
    expect(modelHealthProviderHealth(model(), undefined, now)).toBe('stale')
  })
})
