import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import BalanceBillingView from '../BalanceBillingView.vue'

const { getBalanceBillingReport } = vi.hoisted(() => ({
  getBalanceBillingReport: vi.fn()
}))

vi.mock('@/api/admin/usage', () => ({
  getBalanceBillingReport,
  default: { getBalanceBillingReport }
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
      locale: { value: 'en' }
    })
  }
})

vi.mock('@vueuse/core', () => ({
  onClickOutside: vi.fn()
}))

const isoDate = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(date)
const dateOffset = (days: number) => isoDate(new Date(Date.now() + days * 86_400_000))

const reportFor = (start: string, end: string) => ({
  timezone: 'Asia/Shanghai',
  start_date: start,
  end_date: end,
  billing_start_date: '2026-10-09',
  today_date: dateOffset(0),
  today_total: 0,
  yesterday_total: 0,
  period_total: 1.25,
  today_users: 0,
  today_requests: 0,
  today_tokens: 0,
  period_users: 1,
  period_requests: 2,
  period_input_tokens: 100,
  period_output_tokens: 20,
  period_cache_tokens: 30,
  period_tokens: 150,
  daily: [],
  hourly: [],
  users: [],
  today_ranking: [],
  models: [],
  model_users: [],
  generated_at: '2026-10-20T05:00:00Z'
})

describe('admin BalanceBillingView', () => {
  beforeEach(() => {
    getBalanceBillingReport.mockReset()
  })

  it('defaults to today and uses period-only cards after selecting a multi-day range', async () => {
    const today = dateOffset(0)
    getBalanceBillingReport
      .mockResolvedValueOnce(reportFor(today, today))
      .mockResolvedValueOnce(reportFor(dateOffset(-6), today))

    const wrapper = mount(BalanceBillingView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          DataTable: { template: '<div />' },
          Icon: { template: '<i />' }
        }
      }
    })
    await flushPromises()

    expect(getBalanceBillingReport).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ start_date: today, end_date: today }),
      expect.anything()
    )
    expect(wrapper.text()).toContain('admin.balanceBilling.todayDeduction')
    expect(wrapper.text()).toContain('admin.balanceBilling.todayTokens')
    expect(wrapper.text()).toContain('admin.balanceBilling.todayReport')

    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    const sevenDayPreset = wrapper.findAll('button')
      .find((button) => button.text() === 'admin.balanceBilling.range7d')
    expect(sevenDayPreset).toBeDefined()
    await sevenDayPreset!.trigger('click')

    const applyButton = wrapper.findAll('button')
      .find((button) => button.text() === 'admin.balanceBilling.apply')
    expect(applyButton).toBeDefined()
    await applyButton!.trigger('click')
    await flushPromises()

    expect(getBalanceBillingReport).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ start_date: dateOffset(-6), end_date: today }),
      expect.anything()
    )
    expect(wrapper.text()).toContain('admin.balanceBilling.periodDeduction')
    expect(wrapper.text()).toContain('admin.balanceBilling.totalTokens')
    expect(wrapper.text()).not.toContain('admin.balanceBilling.todayDeduction')
    expect(wrapper.text()).not.toContain('admin.balanceBilling.yesterdayDeduction')
    expect(wrapper.text()).not.toContain('admin.balanceBilling.todayTokens')
  })

  it('labels a single-day yesterday query with yesterday totals', async () => {
    const today = dateOffset(0)
    const yesterday = dateOffset(-1)
    getBalanceBillingReport
      .mockResolvedValueOnce(reportFor(today, today))
      .mockResolvedValueOnce(reportFor(yesterday, yesterday))

    const wrapper = mount(BalanceBillingView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          DataTable: { template: '<div />' },
          Icon: { template: '<i />' }
        }
      }
    })
    await flushPromises()

    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    const yesterdayPreset = wrapper.findAll('button')
      .find((button) => button.text() === 'admin.balanceBilling.rangeYesterday')
    expect(yesterdayPreset).toBeDefined()
    await yesterdayPreset!.trigger('click')

    const applyButton = wrapper.findAll('button')
      .find((button) => button.text() === 'admin.balanceBilling.apply')
    expect(applyButton).toBeDefined()
    await applyButton!.trigger('click')
    await flushPromises()

    expect(getBalanceBillingReport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        start_date: yesterday,
        end_date: yesterday,
        nocache: undefined
      }),
      expect.anything()
    )
    expect(wrapper.text()).toContain('admin.balanceBilling.yesterdayDeduction')
    expect(wrapper.text()).toContain('admin.balanceBilling.yesterdayTokens')
    expect(wrapper.text()).toContain('admin.balanceBilling.yesterdayReport')
    expect(wrapper.text()).not.toContain('admin.balanceBilling.todayTokens')
  })
})
