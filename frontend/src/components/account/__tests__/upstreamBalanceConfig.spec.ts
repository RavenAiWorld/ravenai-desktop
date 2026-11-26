import { describe, expect, it } from 'vitest'
import {
  applyUpstreamBalanceCredentials,
  readUpstreamBalanceConfig,
  upstreamBalanceConfigError
} from '../upstreamBalanceConfig'

describe('upstream balance credentials', () => {
  it('never fills an existing secret back into the editable form', () => {
    const config = readUpstreamBalanceConfig({
      upstream_balance_provider: 'newapi',
      upstream_balance_access_token: 'must-not-be-echoed',
      upstream_balance_user_id: 42
    })
    expect(config).toMatchObject({ provider: 'newapi', accessToken: '', userId: '42' })
  })

  it('omits an unchanged secret so the server preserves it', () => {
    const credentials: Record<string, unknown> = { base_url: 'https://relay.example', upstream_balance_provider: 'newapi' }
    const config = readUpstreamBalanceConfig(credentials)
    applyUpstreamBalanceCredentials(credentials, config, true)
    expect(credentials).not.toHaveProperty('upstream_balance_access_token')
    expect(credentials.upstream_balance_provider).toBe('newapi')
  })

  it('saves the separate account token and explicit unit without modifying rate settings', () => {
    const credentials: Record<string, unknown> = { api_key: 'sk-model', rate_multiplier: 0.6 }
    applyUpstreamBalanceCredentials(credentials, {
      ...readUpstreamBalanceConfig(), provider: 'newapi', accessToken: ' account-token ',
      userId: '42', quotaPerUnit: 500000, currency: 'CNY'
    })
    expect(credentials).toMatchObject({
      api_key: 'sk-model', rate_multiplier: 0.6, upstream_balance_provider: 'newapi',
      upstream_balance_access_token: 'account-token', upstream_balance_user_id: '42',
      upstream_balance_quota_per_unit: 500000, upstream_balance_currency: 'CNY'
    })
    expect(credentials).not.toHaveProperty('upstream_billing_rate_sync_enabled')
  })

  it('explicitly clears a stored account token when the provider is disabled', () => {
    const credentials: Record<string, unknown> = {
      upstream_balance_provider: 'newapi', upstream_balance_user_id: '42',
      upstream_balance_currency: 'USD', upstream_balance_quota_per_unit: 500000
    }
    applyUpstreamBalanceCredentials(credentials, readUpstreamBalanceConfig(), true)
    expect(credentials).toEqual({ upstream_balance_access_token: '' })
  })

  it.each(['0', '-1', '1.5', 'foo', '9007199254740992'])('rejects invalid optional user ID %s', (userId) => {
    expect(upstreamBalanceConfigError({ ...readUpstreamBalanceConfig(), provider: 'newapi', userId }))
      .toBe('invalid_user_id')
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid optional quota unit %s', (quotaPerUnit) => {
    expect(upstreamBalanceConfigError({ ...readUpstreamBalanceConfig(), provider: 'newapi', quotaPerUnit }))
      .toBe('invalid_quota_unit')
  })
})
