import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ModelHealthHeaderSignal from '../ModelHealthHeaderSignal.vue'
import messages from '@/i18n/locales/zh/admin/modelHealth'
import type { ModelHealthHeaderSignal as Signal, ModelHealthRule } from '@/api/admin/modelHealth'

const rule: ModelHealthRule = {
  id: 'sol', name: 'Sol', model: 'gpt-6.1-sol', upstream_model: 'gpt-6.1-sol',
  primary_id: 140, backup_ids: [139], enabled: true, mode: 'auto',
  interval_seconds: 180, timeout_seconds: 25, failure_threshold: 2, recovery_threshold: 2, hold_seconds: 90,
  header_policy: { enabled: true, wait_seconds: 120, rate_percent: 2, min_samples: 50, window_minutes: [5, 60] }
}
const signal = (): Signal => ({
  checked_at: '2026-11-09T12:00:00Z', warning: true, enough_samples: true, slow_observed: true,
  windows: [{ minutes: 60, requests: 8404, slow: 208, rate: 208 / 8404,
    enough_samples: true, partial: true, observed_seconds: 3540, warning: true }]
})
const render = (value?: Signal, selectedRule = rule) => mount(ModelHealthHeaderSignal, {
  props: { rule: selectedRule, signal: value, accountId: 140 },
  global: { plugins: [createI18n({ legacy: false, locale: 'zh', messages: { zh: { admin: messages } } })] }
})

describe('Response-header wait indicator', () => {
  it('shows the requested threshold, ratio, counts and incomplete history', () => {
    const wrapper = render(signal())
    expect(wrapper.get('summary').text()).toContain('2.48% ≥ 2%')
    expect(wrapper.text()).toContain('响应头等待 >120秒')
    expect(wrapper.text()).toContain('208 / 8,404')
    expect(wrapper.text()).toContain('已观测：59分钟')
    expect(wrapper.text()).toContain('历史不完整')
    expect(wrapper.find('details').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not describe missing samples as a healthy zero percent', () => {
    const wrapper = render()
    expect(wrapper.get('summary').text()).toContain('样本不足')
    expect(wrapper.get('summary').text()).not.toContain('0.00%')
    wrapper.unmount()
  })

  it('selects the worst qualifying window and keeps low-volume warnings separate', () => {
    const value = signal()
    value.windows.unshift({ minutes: 5, requests: 2, slow: 1, rate: .5,
      enough_samples: false, partial: false, observed_seconds: 300, warning: false })
    const wrapper = render(value)
    expect(wrapper.get('summary').text()).toContain('2.48%')
    expect(wrapper.get('summary').text()).not.toContain('50.00%')
    expect(wrapper.text()).toContain('样本不足 50 次')
    wrapper.unmount()
  })

  it('reports history errors and leaves disabled policies hidden', () => {
    const value = signal()
    value.error = 'unavailable'
    const wrapper = render(value)
    expect(wrapper.text()).toContain('响应头统计历史不可用')
    wrapper.unmount()
    const disabled = render(value, { ...rule, header_policy: { ...rule.header_policy!, enabled: false } })
    expect(disabled.find('details').exists()).toBe(false)
    disabled.unmount()
  })
})
