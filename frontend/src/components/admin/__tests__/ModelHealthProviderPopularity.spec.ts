import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ModelHealthProviderPopularity from '../ModelHealthProviderPopularity.vue'
import messages from '@/i18n/locales/zh/admin/modelHealth'
import type { ModelHealthProviderGroup } from '@/api/admin/modelHealth'

const now = Date.parse('2026-11-10T14:00:00Z')
const group = (): ModelHealthProviderGroup => ({
  group_id: 189, code: 'S009-Team', platform: 'openai', rate_multiplier: .08,
  models: [], warnings: [], warnings_at: '', warnings_expires_at: '', model_metrics: {},
  metrics: { duration_ms: null, sample_count: 0, tps: null, success_rate: null, cache_hit_rate: null,
    input_price_per_million: null, effective_multiplier: null },
  popularity: { status: 'measured', fires: 5, rank: 1, groups: 219, window: '24h', increment: 3,
    generated_at: new Date(now - 60000).toISOString(), expires_at: new Date(now + 60000).toISOString() }
})
const render = (value = group()) => mount(ModelHealthProviderPopularity, {
  props: { group: value, now }, attachTo: document.body,
  global: { plugins: [createI18n({ legacy: false, locale: 'zh', messages: { zh: { admin: messages } } })] }
})
const popup = () => document.querySelector<HTMLElement>('[data-testid="provider-popularity-popup"]')

describe('Published spending popularity', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers() })

  it('shows upstream flames, rank, window and percent band on hover', async () => {
    const wrapper = render()
    const button = wrapper.get('button')
    expect(button.text()).toBe('🔥🔥🔥🔥🔥')
    expect(button.attributes('aria-label')).toContain('排名 1 / 219 · 24h')
    button.element.parentElement!.dispatchEvent(new MouseEvent('mouseenter'))
    await flushPromises()
    expect(popup()!.textContent).toContain('消费排名人气 · openai')
    expect(popup()!.textContent).toContain('排名 1 / 219 · 24h')
    expect(popup()!.textContent).toContain('排名档位 0–3% · 5/5')
    expect(popup()!.textContent).toContain('消费排名，不代表质量；按整组取整。')
    expect(popup()!.querySelector('[data-testid="provider-popularity-partial"]')).toBeNull()
    expect(button.attributes('aria-describedby')).toBe(popup()!.id)
    wrapper.unmount()
  })

  it('uses the published increment for a lower band and preserves partial history', async () => {
    const value = group()
    Object.assign(value.popularity!, { fires: 3, rank: 20, window: '7d', increment: 2.5, history_partial: true })
    const wrapper = render(value)
    await wrapper.get('button').trigger('focus')
    await flushPromises()
    expect(popup()!.textContent).toContain('排名 20 / 219 · 7d')
    expect(popup()!.textContent).toContain('排名档位 5–7.5% · 3/5')
    expect(popup()!.textContent).toContain('使用完整桶；部分历史缺失。')
    wrapper.unmount()
  })

  it('does not invent a band when the upstream increment is unavailable', async () => {
    const value = group()
    delete value.popularity!.increment
    const wrapper = render(value)
    await wrapper.get('button').trigger('focus')
    await flushPromises()
    expect(popup()!.querySelector('[data-testid="provider-popularity-band"]')).toBeNull()
    expect(popup()!.textContent).toContain('排名 1 / 219 · 24h')
    wrapper.unmount()
  })

  it('pins for touch, dismisses outside or on Escape and closes when the data expires', async () => {
    vi.useFakeTimers()
    const wrapper = render()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    wrapper.get('button').element.parentElement!.dispatchEvent(new MouseEvent('mouseleave'))
    await vi.advanceTimersByTimeAsync(250)
    expect(popup()).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(popup()).toBeNull()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(popup()).toBeNull()
    await wrapper.get('button').trigger('focus')
    await flushPromises()
    await wrapper.setProps({ now: now + 60001 })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(popup()).toBeNull()
    wrapper.unmount()
  })

  it('keeps the hover card open while moving onto it and closes after leaving', async () => {
    vi.useFakeTimers()
    const wrapper = render()
    wrapper.get('button').element.parentElement!.dispatchEvent(new MouseEvent('mouseenter'))
    await flushPromises()
    wrapper.get('button').element.parentElement!.dispatchEvent(new MouseEvent('mouseleave'))
    popup()!.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.advanceTimersByTimeAsync(250)
    expect(popup()).not.toBeNull()
    popup()!.dispatchEvent(new MouseEvent('mouseleave'))
    await vi.advanceTimersByTimeAsync(250)
    expect(popup()).toBeNull()
    wrapper.unmount()
  })

  it.each([
    { fires: 0 }, { fires: 6 }, { fires: 1.5 }, { status: 'unknown' }, { expires_at: new Date(now - 1).toISOString() }
  ])('hides an unavailable published badge: %s', async invalid => {
    const value = group()
    Object.assign(value.popularity!, invalid)
    const wrapper = render(value)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(popup()).toBeNull()
    wrapper.unmount()
  })
})
