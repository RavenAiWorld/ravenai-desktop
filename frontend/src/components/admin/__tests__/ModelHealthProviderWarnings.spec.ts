import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ModelHealthProviderWarnings from '../ModelHealthProviderWarnings.vue'
import messages from '@/i18n/locales/zh/admin/modelHealth'
import type { ModelHealthProviderGroup, ModelHealthProviderTrigger } from '@/api/admin/modelHealth'

const now = Date.parse('2026-11-10T01:00:00Z')
const trigger = (value = 2.11, window = '6h'): ModelHealthProviderTrigger => ({
  generated_at: new Date(now - 60000).toISOString(), expires_at: new Date(now + 60000).toISOString(),
  window, model: 'all recorded models', classification: 'slow_header_wait_gt120',
  numerator: 535, denominator: 25362, value, threshold: 2, operator: '>=',
  complete: false, available: true, observed_seconds: 21540
})
const group = (): ModelHealthProviderGroup => ({
  group_id: 189, code: 'S009-Team', platform: 'openai', rate_multiplier: .08,
  models: [], metrics: { duration_ms: null, sample_count: 0, tps: null, success_rate: null, cache_hit_rate: null,
    input_price_per_million: null, effective_multiplier: null }, model_metrics: {},
  warnings_at: new Date(now - 5000).toISOString(), warnings_expires_at: new Date(now + 120000).toISOString(),
  warnings: [{ id: 'slow_response', status: 'active', partial: true, triggers: [trigger(2.01, '1h'), trigger()] }]
})
const render = (value = group()) => mount(ModelHealthProviderWarnings, {
  props: { group: value, now }, attachTo: document.body,
  global: { plugins: [createI18n({ legacy: false, locale: 'zh', messages: { zh: { admin: messages, common: { close: '关闭' } } } })] }
})

describe('Public provider warning popup', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers() })

  it('shows the worst published window, causes, counters and partial history on hover', async () => {
    const wrapper = render()
    const badge = wrapper.get('button')
    expect(badge.attributes('aria-label')).toBe('1 项警告')
    await badge.element.parentElement!.dispatchEvent(new MouseEvent('mouseenter'))
    await flushPromises()
    const popup = document.querySelector('[data-testid="provider-warning-popup"]')!
    expect(popup.textContent).toContain('响应/连接缓慢')
    expect(popup.querySelector('summary')!.textContent).toContain('2.11% ≥ 2%')
    expect(popup.querySelector('summary')!.textContent).toContain('6h 部分')
    expect(popup.textContent).toContain('1h 部分 · 6h 部分')
    expect(popup.textContent).toContain('535 / 25,362')
    expect(popup.textContent).toContain('已观测: 5.98小时')
    expect(popup.textContent).toContain('响应头等待 >120秒')
    wrapper.unmount()
  })

  it('counts warning categories once and discards expired triggers before selecting the worst', async () => {
    const value = group()
    value.warnings[0]!.triggers.push({ ...trigger(50, '5m'), expires_at: new Date(now - 1).toISOString() })
    value.warnings.push({ id: 'high_error', status: 'active', partial: false,
      triggers: [{ ...trigger(10, '1h'), classification: 'non_success' }] })
    const wrapper = render(value)
    expect(wrapper.get('button').attributes('aria-label')).toBe('2 项警告')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    const popup = document.querySelector('[data-testid="provider-warning-popup"]')!
    expect(popup.querySelectorAll('details')).toHaveLength(2)
    expect(popup.textContent).not.toContain('50%')
    expect(popup.textContent).not.toContain('5m')
    wrapper.unmount()
  })

  it('pins on click, closes on Escape and automatically closes when the last trigger expires', async () => {
    vi.useFakeTimers()
    const wrapper = render()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    await wrapper.get('button').element.parentElement!.dispatchEvent(new MouseEvent('mouseleave'))
    await vi.advanceTimersByTimeAsync(250)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    await wrapper.setProps({ now: now + 61000 })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })

  it('shows unknown instead of a healthy badge when the publication expires', async () => {
    const wrapper = render()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    await wrapper.setProps({ now: now + 121000 })
    expect(wrapper.text()).toBe('-')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })
})
