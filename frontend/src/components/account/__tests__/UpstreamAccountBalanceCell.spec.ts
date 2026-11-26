import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Account, UpstreamAccountBalanceSnapshot } from '@/types'
import UpstreamAccountBalanceCell from '../UpstreamAccountBalanceCell.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => params ? `${key}:${Object.values(params).join(',')}` : key
  })
}))

const now = Date.parse('2026-10-23T04:00:00Z')
const balance: UpstreamAccountBalanceSnapshot = {
  provider: 'newapi', scope: 'account', status: 'ok', balance: 2.5, currency: 'USD',
  received_at: '2026-10-23T03:30:00Z', fresh_until: '2026-10-23T04:30:00Z',
  last_attempt_at: '2026-10-23T03:30:00Z'
}
const account = (snapshot?: UpstreamAccountBalanceSnapshot) => ({
  id: 1, type: 'apikey', platform: 'openai',
  credentials: { upstream_balance_provider: 'newapi' },
  credentials_status: { has_upstream_balance_access_token: true },
  extra: {
    upstream_billing_probe: {
      status: 'unsupported', last_attempt_at: '2026-10-23T03:30:00Z',
      next_probe_at: '2026-10-23T04:30:00Z', account_balance: snapshot
    }
  }
}) as Account
const mountCell = (value = account(balance)) => mount(UpstreamAccountBalanceCell, {
  props: { account: value, now },
  global: { stubs: { HelpTooltip: { template: '<div><slot name="trigger" /><slot /></div>' }, Icon: true } }
})

describe('upstream account balance cell', () => {
  it('shows independently sourced account balance even when declared rate is unsupported', async () => {
    const wrapper = mountCell()
    expect(wrapper.get('[data-testid="upstream-account-balance"]').text()).toBe('USD 2.50')
    expect(wrapper.text()).toContain('admin.accounts.upstreamBalance.scope')
    expect(wrapper.text()).toContain('admin.accounts.upstreamBalance.updatedAt:')
    expect(wrapper.text()).not.toContain('unsupported')
    await wrapper.get('[data-testid="upstream-account-balance-action"]').trigger('click')
    expect(wrapper.emitted('probe')).toHaveLength(1)
  })

  it('shows requires configuration instead of token unlimited/sentinel values', async () => {
    const value = account()
    value.credentials_status = { has_api_key: true }
    value.extra!.upstream_billing_probe!.data = {
      object: 'token_usage', unlimited_quota: true, total_available: -999, hard_limit_usd: 100000000
    } as never
    const wrapper = mountCell(value)
    expect(wrapper.get('[data-testid="upstream-account-balance"]').text()).toBe('admin.accounts.upstreamBalance.requiresConfiguration')
    expect(wrapper.text()).not.toContain('100000000')
    expect(wrapper.text()).not.toContain('-999')
    await wrapper.get('[data-testid="upstream-account-balance-action"]').trigger('click')
    expect(wrapper.emitted('configure')).toHaveLength(1)
    expect(wrapper.emitted('probe')).toBeUndefined()
  })

  it('keeps the last account value visibly marked failed and never renders raw upstream errors', () => {
    const wrapper = mountCell(account({ ...balance, status: 'failed', last_error: 'token-secret in raw upstream body' }))
    expect(wrapper.text()).toContain('USD 2.50')
    expect(wrapper.text()).toContain('admin.accounts.upstreamBalance.failed')
    expect(wrapper.text()).toContain('admin.accounts.upstreamBalance.errors.request_failed')
    expect(wrapper.text()).not.toContain('token-secret')
  })

  it('shows account access rejection as a credential configuration error', () => {
    const wrapper = mountCell(account({
      ...balance, status: 'requires_configuration', last_error: 'account_access_denied', http_status: 200
    }))
    expect(wrapper.get('[data-testid="upstream-account-balance"]').text()).toBe('admin.accounts.upstreamBalance.requiresConfiguration')
    expect(wrapper.text()).toContain('admin.accounts.upstreamBalance.errors.unauthorized')
    expect(wrapper.text()).not.toContain('USD 2.50')
  })

  it('distinguishes CNY, raw account quota and stale balances', async () => {
    const wrapper = mountCell(account({ ...balance, currency: 'CNY' }))
    expect(wrapper.get('[data-testid="upstream-account-balance"]').text()).toBe('CNY 2.50')
    await wrapper.setProps({ account: account({ ...balance, currency: 'quota', balance: 1000 }) })
    expect(wrapper.get('[data-testid="upstream-account-balance"]').text()).not.toContain('USD')
    expect(wrapper.text()).toContain('admin.accounts.upstreamBalance.quota')
    await wrapper.setProps({ now: now + 2 * 60 * 60_000 })
    expect(wrapper.text()).toContain('admin.accounts.upstreamBalance.stale')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('never displays an invalid balance %s', (amount) => {
    const wrapper = mountCell(account({ ...balance, balance: amount }))
    expect(wrapper.get('[data-testid="upstream-account-balance"]').text()).toBe('admin.accounts.upstreamBalance.failed')
  })
})
