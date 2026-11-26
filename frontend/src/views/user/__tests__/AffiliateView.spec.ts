import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AffiliateView from '../AffiliateView.vue'

const { copyToClipboard, getAffiliateDetail } = vi.hoisted(() => ({
  copyToClipboard: vi.fn(),
  getAffiliateDetail: vi.fn(),
}))

vi.mock('@/api/user', () => ({
  default: {
    getAffiliateDetail,
    transferAffiliateQuota: vi.fn(),
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    refreshUser: vi.fn(),
  }),
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyToClipboard }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, string | number>) =>
        ['affiliate.inviteRewardRule', 'affiliate.rewardExample'].includes(key)
          ? `${key} ${JSON.stringify(params)}`
          : key,
    }),
  }
})

describe('AffiliateView', () => {
  const affiliateCode = 'affiliate-code-that-is-long-enough-to-overflow-a-mobile-viewport'

  beforeEach(() => {
    vi.clearAllMocks()
    copyToClipboard.mockResolvedValue(true)
    getAffiliateDetail.mockResolvedValue({
      user_id: 1,
      aff_code: affiliateCode,
      inviter_id: null,
      aff_count: 0,
      aff_quota: 0,
      aff_frozen_quota: 0,
      aff_history_quota: 0,
      redeem_balance_total: 1.6,
      effective_rebate_rate_percent: 8,
      invitees: [],
    })
  })

  it('shows automatic balance credits without a manual transfer control', async () => {
    const wrapper = mount(AffiliateView, {
      global: { stubs: { AppLayout: { template: '<main><slot /></main>' }, Icon: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('affiliate.stats.balanceCredited')
    expect(wrapper.text()).toContain('$1.60')
    expect(wrapper.text()).toContain('affiliate.cashbackRule')
    expect(wrapper.text()).not.toContain('affiliate.transfer.button')
    wrapper.unmount()
  })

  it.each([
    { rate: 8, reward: 1.6 },
    { rate: 12.5, reward: 2.5 },
    { rate: 0, reward: 0 },
  ])('shows the personal invite rule and example for $rate percent', async ({ rate, reward }) => {
    getAffiliateDetail.mockResolvedValue({
      aff_code: affiliateCode, aff_count: 0, aff_quota: 0, aff_frozen_quota: 0,
      aff_history_quota: 0, effective_rebate_rate_percent: rate, invitees: [],
    })
    const wrapper = mount(AffiliateView, {
      global: { stubs: { AppLayout: { template: '<main><slot /></main>' }, Icon: true } },
    })
    await flushPromises()
    expect(wrapper.get('#personal-invite-heading').text()).toBe('affiliate.title')
    expect(wrapper.text()).not.toContain('affiliate.signupBonusRule')
    expect(wrapper.get('[data-test="invite-reward-rule"]').text()).toContain(`"rate":"${rate}%"`)
    expect(wrapper.get('[data-test="invite-reward-example"]').text()).toContain(`"reward":${reward}`)
    expect(wrapper.get('[data-test="invite-reward-example"]').text()).toContain('"amount":20')
    wrapper.unmount()
  })

  it('lets users retry a failed invitation lookup', async () => {
    getAffiliateDetail.mockRejectedValueOnce(new Error('Unavailable'))
    const wrapper = mount(AffiliateView, {
      global: { stubs: { AppLayout: { template: '<main><slot /></main>' }, Icon: true } },
    })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain(affiliateCode)
    expect(getAffiliateDetail).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('keeps the transfer control for legacy available quota', async () => {
    getAffiliateDetail.mockResolvedValue({
      aff_code: affiliateCode, aff_count: 1, aff_quota: 3, aff_frozen_quota: 0,
      aff_history_quota: 5, redeem_balance_total: 2, effective_rebate_rate_percent: 10, invitees: [],
    })
    const wrapper = mount(AffiliateView, {
      global: { stubs: { AppLayout: { template: '<main><slot /></main>' }, Icon: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('affiliate.transfer.button')
    wrapper.unmount()
  })

  it('stacks long values and copy controls on mobile while retaining desktop rows', async () => {
    const wrapper = mount(AffiliateView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
        },
      },
    })

    await flushPromises()

    const values = wrapper.findAll('code')
    expect(values).toHaveLength(2)
    for (const value of values) {
      expect(value.classes()).toEqual(expect.arrayContaining([
        'min-w-0',
        'break-all',
        'sm:flex-1',
        'sm:truncate',
      ]))
      expect(Array.from(value.element.parentElement?.classList ?? [])).toEqual(expect.arrayContaining([
        'flex-col',
        'items-stretch',
        'sm:flex-row',
        'sm:items-center',
      ]))
    }

    const copyButtons = wrapper.findAll('button').filter((button) =>
      ['affiliate.copyCode', 'affiliate.copyLink'].includes(button.text()),
    )
    expect(copyButtons).toHaveLength(2)
    for (const button of copyButtons) {
      expect(button.classes()).toEqual(expect.arrayContaining([
        'w-full',
        'sm:w-auto',
        'sm:shrink-0',
      ]))
    }

    await copyButtons[0].trigger('click')
    await copyButtons[1].trigger('click')
    await flushPromises()

    expect(copyToClipboard).toHaveBeenNthCalledWith(1, affiliateCode, 'affiliate.codeCopied')
    expect(copyToClipboard).toHaveBeenNthCalledWith(
      2,
      `${window.location.origin}/register?aff=${encodeURIComponent(affiliateCode)}`,
      'affiliate.linkCopied',
    )
  })
})
