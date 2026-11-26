import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PlazaModelDrawer from '../PlazaModelDrawer.vue'
import { buildEntries } from '../plazaCatalog'
import type { ModelPlazaGroup, PlazaModel } from '@/api/modelPlaza'
import type { UserPricingInterval } from '@/api/channels'

vi.mock('vue-i18n', async () => ({
  ...(await vi.importActual<typeof import('vue-i18n')>('vue-i18n')),
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}${JSON.stringify(params)}` : key)
  })
}))

const M = 1e-6

function interval(min: number, max: number | null, input: number, output: number, cacheWrite: number | null = null): UserPricingInterval {
  return {
    min_tokens: min,
    max_tokens: max,
    input_price: input * M,
    output_price: output * M,
    cache_write_price: cacheWrite == null ? null : cacheWrite * M,
    cache_write_1h_price: cacheWrite == null ? null : cacheWrite * 1.6 * M,
    cache_read_price: (input / 10) * M,
    per_request_price: null
  }
}

function model(name: string, input: number, output: number, extra: Partial<PlazaModel> = {}): PlazaModel {
  return {
    name,
    platform: 'openai',
    pricing: {
      billing_mode: 'token',
      input_price: input * M,
      output_price: output * M,
      cache_write_price: null,
      cache_read_price: (input / 10) * M,
      image_input_price: null,
      image_output_price: null,
      per_request_price: null,
      intervals: []
    },
    official_pricing: null,
    ...extra
  }
}

function group(models: PlazaModel[], extra: Partial<ModelPlazaGroup> = {}): ModelPlazaGroup {
  return {
    id: 8, name: 'All', description: '', platform: 'composite', subscription_type: 'standard', rate_multiplier: 0.2,
    peak_rate_enabled: false, peak_start: '', peak_end: '', peak_rate_multiplier: 1, is_exclusive: false,
    image_rate_independent: false, image_rate_multiplier: 1, video_rate_independent: false, video_rate_multiplier: 1,
    long_context_pricing_enabled: true, models, ...extra
  }
}

function mountDrawer(models: PlazaModel[], extra: { group?: Partial<ModelPlazaGroup>; peakWindow?: string } = {}) {
  const [entry] = buildEntries(group(models, extra.group))
  return mount(PlazaModelDrawer, {
    props: {
      entry,
      unit: 'M' as const,
      workload: { input: 80_000, cacheHit: 0.9, output: 2_000 },
      apiBaseUrl: 'https://api.example.com',
      isAuthenticated: true,
      peakWindow: extra.peakWindow ?? '',
      compare: false
    },
    attachTo: document.body,
    global: { stubs: { teleport: true, RouterLink: true } }
  })
}

function astraModels(): PlazaModel[] {
  const astra = model('gpt-6-astra', 10, 50, {
    long_context_basis: 'whole_request',
    info: {
      display_name: 'GPT-6-Astra',
      description: 'Frontier intelligence.',
      context_window: 272_000,
      max_context_window: 872_000,
      max_output_tokens: 128_000,
      reasoning: true,
      input_modalities: ['text', 'image']
    }
  })
  astra.pricing!.intervals = [interval(0, 272_000, 10, 50, 12.5), interval(272_000, null, 20, 75, 25)]
  return [astra, model('gpt-6-astra-fast', 20, 100, { service_tier: 'priority' })]
}

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('PlazaModelDrawer', () => {
  it.each(['gpt-6.1-terra', 'gpt-6.1-terra-fast'])('shows Terra cache retention and prices for %s', (name) => {
    const factor = name.endsWith('-fast') ? 2 : 1
    const terra = model(name, factor, 5 * factor)
    terra.pricing!.cache_write_price = 1.25 * factor * M
    terra.pricing!.cache_write_1h_price = 2.5 * factor * M
    const wrapper = mountDrawer([terra], { group: { rate_multiplier: .18 } })
    const table = wrapper.get('[data-testid=plaza-paid-table]')
    expect(table.text()).toContain('modelPlaza.detail.cacheWrite30m')
    expect(table.text()).toContain('modelPlaza.detail.cacheWrite12h')
    expect(table.text()).not.toContain('modelPlaza.detail.cacheWrite5m')
    expect(table.text()).not.toContain('modelPlaza.detail.cacheWrite1h')
    expect(table.get('[data-label="modelPlaza.detail.cacheWrite30m"]').text()).toBe(factor === 1 ? '$0.225' : '$0.45')
    expect(table.get('[data-label="modelPlaza.detail.cacheWrite12h"]').text()).toBe(factor === 1 ? '$0.45' : '$0.90')
    wrapper.unmount()
  })

  it('shows specs and a price row for every variant and context tier', () => {
    const wrapper = mountDrawer(astraModels())
    expect(wrapper.get('#plaza-drawer-title').text()).toBe('GPT-6-Astra')
    expect(wrapper.text()).toContain('Frontier intelligence.')
    expect(wrapper.text()).toContain('272K')
    expect(wrapper.text()).toContain('modelPlaza.detail.contextExtended{"size":"872K"}')
    expect(wrapper.text()).toContain('128K')

    const rows = wrapper.get('[data-testid=plaza-paid-table]').findAll('tbody tr')
    expect(rows.map((r) => r.attributes('data-tier-row'))).toEqual(['standard-0', 'standard-1', 'fast-0'])
    expect(rows[1].text()).toContain('>272K')
    expect(rows[1].text()).toContain('$4.00')
    expect(rows[1].text()).toContain('$15.00')
    // 5 分钟与 1 小时缓存写入价不同，单独成列
    expect(rows[0].text()).toContain('$2.50')
    expect(rows[0].text()).toContain('$4.00')
    expect(document.body.style.overflow).toBe('hidden')
    wrapper.unmount()
  })

  it('lists the billing rules that apply to the model', () => {
    const k3 = model('k3', 3, 15, {
      platform: 'kimi',
      time_pricing: { timezone: 'Asia/Shanghai', weekdays_only: true, periods: [{ start_time: '00:30:00', end_time: '08:30:00', multiplier: 0.5 }] }
    })
    k3.pricing!.reasoning_effort_multipliers = { xhigh: 1.5 }
    const wrapper = mountDrawer([k3], {
      group: { peak_rate_enabled: true, peak_start: '20:00', peak_end: '23:00', peak_rate_multiplier: 1.5 },
      peakWindow: '20:00–23:00 (UTC+08:00)'
    })
    const rules = wrapper.get('[data-testid=plaza-rules]').text()
    expect(rules).toContain('modelPlaza.detail.ruleRate{"rate":0.2}')
    expect(rules).toContain('modelPlaza.detail.rulePeak{"window":"20:00–23:00 (UTC+08:00)","multiplier":1.5}')
    expect(rules).toContain(
      'modelPlaza.detail.ruleTimePricingWeekdays{"timezone":"Asia/Shanghai","window":"00:30–08:30","multiplier":0.1}'
    )
    expect(rules).toContain('modelPlaza.detail.ruleReasoning{"effort":"xhigh","multiplier":1.5}')
    wrapper.unmount()

    const astra = mountDrawer(astraModels())
    const astraRules = astra.get('[data-testid=plaza-rules]').text()
    expect(astraRules).toContain('modelPlaza.detail.ruleWholeRequest{"threshold":"272K"}')
    expect(astraRules).toContain('modelPlaza.detail.ruleFast{"id":"gpt-6-astra-fast"}')
    astra.unmount()
  })

  it('recalculates the estimate for the chosen tier, variant and request count', async () => {
    const wrapper = mountDrawer(astraModels())
    expect(wrapper.get('#plaza-panel-calculator').isVisible()).toBe(false)
    await wrapper.get('[data-testid=plaza-tab-calculator]').trigger('click')
    expect(wrapper.get('#plaza-panel-calculator').isVisible()).toBe(true)
    // 默认场景：8K × $2 + 72K × $0.20 + 2K × $10（每百万）
    expect(wrapper.get('[data-testid=plaza-calc-total]').text()).toBe('$0.0504')

    await wrapper.get('[data-testid=plaza-calc-input]').setValue('300000')
    await wrapper.get('[data-testid=plaza-calc-cache]').setValue('0')
    await wrapper.get('[data-testid=plaza-calc-output]').setValue('2000')
    // 300K 超过 272K：整单按 $4 输入 + $15 输出
    expect(wrapper.get('[data-testid=plaza-calc-total]').text()).toBe('$1.23')
    expect(wrapper.text()).toContain('modelPlaza.detail.calcTier{"tier":">272K"}')

    await wrapper.get('[data-testid=plaza-calc-requests]').setValue('10')
    expect(wrapper.get('[data-testid=plaza-calc-total]').text()).toBe('$12.30')

    await wrapper.get('[data-testid=plaza-calc-fast]').trigger('click')
    // Fast 别名没有阶梯：300K × $4 + 2K × $20，再乘 10 次
    expect(wrapper.get('[data-testid=plaza-calc-total]').text()).toBe('$12.40')
    wrapper.unmount()
  })

  it('explains that per-image models have no token estimate', () => {
    const image: PlazaModel = {
      name: 'gpt-image-2',
      platform: 'openai',
      pricing: {
        billing_mode: 'image', input_price: null, output_price: null, cache_write_price: null, cache_read_price: null,
        image_input_price: null, image_output_price: null, per_request_price: 0.2, intervals: []
      },
      official_pricing: null
    }
    const wrapper = mountDrawer([image])
    expect(wrapper.get('[data-testid=plaza-calculator]').text()).toContain('modelPlaza.detail.calcUnavailable')
    expect(wrapper.text()).toContain('modelPlaza.price.perImage{"price":"$0.04"}')
    wrapper.unmount()
  })

  it('closes on Escape and the close button, and copies IDs and the API address', async () => {
    const wrapper = mountDrawer(astraModels())
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)

    await wrapper.get('[aria-label="modelPlaza.detail.close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)

    const copyButtons = wrapper.findAll('[aria-label="modelPlaza.detail.copy"]')
    await wrapper.get('[data-testid=plaza-tab-api]').trigger('click')
    await copyButtons[0].trigger('click')
    await wrapper.get('[data-testid=plaza-tab-overview]').trigger('click')
    await wrapper.findAll('button[aria-label^="modelPlaza.card.copyId"]')[1].trigger('click')
    expect(wrapper.emitted('copy')).toEqual([['https://api.example.com'], ['gpt-6-astra-fast']])
    wrapper.unmount()
  })

  it('supports arrow-key tab navigation and keeps group prices separate from base prices', async () => {
    const wrapper = mountDrawer(astraModels())
    expect(wrapper.get('.plaza-base-prices').text()).toContain('$10.00')
    expect(wrapper.get('[data-testid=plaza-group-prices]').text()).toContain('$2.00')
    await wrapper.get('[data-testid=plaza-tab-overview]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.get('[data-testid=plaza-tab-calculator]').attributes('aria-selected')).toBe('true')
    await wrapper.get('[data-testid=plaza-tab-calculator]').trigger('keydown', { key: 'End' })
    expect(wrapper.get('[data-testid=plaza-tab-api]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('#plaza-panel-api').isVisible()).toBe(true)
    wrapper.unmount()
  })
})
