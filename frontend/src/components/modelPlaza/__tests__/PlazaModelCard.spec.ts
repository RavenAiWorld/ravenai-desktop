import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlazaModelCard from '../PlazaModelCard.vue'
import { buildEntries } from '../plazaCatalog'
import type { ModelPlazaGroup, PlazaModel } from '@/api/modelPlaza'
import type { UserPricingInterval } from '@/api/channels'

vi.mock('vue-i18n', async () => ({
  ...(await vi.importActual<typeof import('vue-i18n')>('vue-i18n')),
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}${JSON.stringify(params)}` : key)
  })
}))

const M = 1e-6

function interval(min: number, max: number | null, input: number, output: number): UserPricingInterval {
  return { min_tokens: min, max_tokens: max, input_price: input * M, output_price: output * M, cache_write_price: null, cache_read_price: (input / 10) * M, per_request_price: null }
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
    official_pricing: { input_price: input * 2.5 * M, output_price: output * 2.5 * M, cache_write_price: null, cache_read_price: input * 0.25 * M },
    ...extra
  }
}

function group(models: PlazaModel[]): ModelPlazaGroup {
  return {
    id: 8, name: 'All', description: '', platform: 'composite', subscription_type: 'standard', rate_multiplier: 0.2,
    peak_rate_enabled: false, peak_start: '', peak_end: '', peak_rate_multiplier: 1, is_exclusive: false,
    image_rate_independent: false, image_rate_multiplier: 1, video_rate_independent: false, video_rate_multiplier: 1,
    long_context_pricing_enabled: true, models
  }
}

function mountCard(models: PlazaModel[], compare = false) {
  const [entry] = buildEntries(group(models))
  return mount(PlazaModelCard, {
    props: { entry, unit: 'M' as const, compare }
  })
}

describe('PlazaModelCard', () => {
  it('shows compact group prices with Fast and tier badges linking to details', () => {
    const astra = model('gpt-6-astra', 10, 50, { info: { display_name: 'GPT-6-Astra', context_window: 272_000, max_context_window: 872_000 } })
    astra.pricing!.intervals = [interval(0, 272_000, 10, 50), interval(272_000, null, 20, 75)]
    const wrapper = mountCard([astra, model('gpt-6-astra-fast', 20, 100, { service_tier: 'priority' })])

    expect(wrapper.get('h3').text()).toBe('gpt-6-astra')
    const rows = wrapper.findAll('[data-row]')
    expect(rows.map((r) => r.attributes('data-row'))).toEqual(['standard'])
    expect(rows[0].findAll('[data-price]').map((c) => c.text())).toEqual(['$2.00', '$10.00', '$0.20'])
    expect(wrapper.text()).toContain('modelPlaza.card.tiered')
    expect(wrapper.text()).toContain('872K')
    expect(wrapper.text()).toContain('Fast')
    expect(wrapper.get('.card-group').text()).toContain('All')
  })

  it('marks an always-Fast model without row labels', () => {
    const wrapper = mountCard([model('gpt-5.6-sol', 10, 60, { service_tier: 'priority' })])
    expect(wrapper.text()).toContain('modelPlaza.card.alwaysFast')
    expect(wrapper.findAll('[data-row]')).toHaveLength(1)
    expect(wrapper.find('tbody th').exists()).toBe(false)
  })

  it('shows struck-through official prices only when comparing', () => {
    expect(mountCard([model('gpt-6-sol', 2, 10)]).find('[data-official]').exists()).toBe(false)
    const compared = mountCard([model('gpt-6-sol', 2, 10)], true)
    expect(compared.findAll('s[data-official]').map((s) => s.text())).toEqual(['$5.00', '$25.00', '$0.50'])
  })

  it('marks a model that is flat although the provider surcharges long contexts', () => {
    const flat = model('gpt-6.1-sol', 4, 20)
    flat.official_pricing!.intervals = [interval(0, 272_000, 2, 10), interval(272_000, null, 4, 15)]
    expect(mountCard([flat]).text()).toContain('modelPlaza.features.flatContext')
  })

  it('shows per-image prices without a token estimate', () => {
    const image: PlazaModel = {
      name: 'gpt-image-2',
      platform: 'openai',
      pricing: {
        billing_mode: 'image', input_price: null, output_price: null, cache_write_price: null, cache_read_price: null,
        image_input_price: null, image_output_price: null, per_request_price: 0.2,
        intervals: [{ min_tokens: 0, max_tokens: null, tier_label: '2K', input_price: null, output_price: null, cache_write_price: null, cache_read_price: null, per_request_price: 0.4 }]
      },
      official_pricing: null
    }
    const wrapper = mountCard([image])
    expect(wrapper.text()).toContain('2K')
    expect(wrapper.text()).toContain('$0.08')
    expect(wrapper.text()).toContain('modelPlaza.price.unitImage')
    expect(wrapper.get('footer .card-stats-empty').text()).toBe('modelPlaza.metrics.unavailable')
    expect(wrapper.find('[data-testid=plaza-estimate]').exists()).toBe(false)
  })

  it('emits open from the title and copy from the copy button', async () => {
    const wrapper = mountCard([model('k3', 3, 15)])
    await wrapper.get('.plaza-card-open').trigger('click')
    await wrapper.get('[data-testid=plaza-copy]').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
    expect(wrapper.emitted('copy')).toEqual([['k3']])
  })

  it('renders observations on the card with its local group, measurement scope and cache age', () => {
    const wrapper = mountCard([model('gpt-6-astra', 10, 50, { route_stats: {
      updated_at: '2026-11-20T04:00:00Z', stale: true, success_rate: 0, latency_ms: 15740,
      group_average: true, history: [...Array(21).fill(''), 'operational', 'degraded', 'failed']
    } })])
    const row = wrapper.get('footer [data-testid=plaza-route-stats]')
    expect(wrapper.find('.card-stats-empty').exists()).toBe(false)
    expect(row.attributes('data-stale')).toBe('true')
    expect(wrapper.html()).not.toMatch(/aihub/i)
    expect(row.attributes('title')).toContain('modelPlaza.metrics.groupAverage')
    expect(row.findAll('[data-state]')).toHaveLength(24)
    expect(row.findAll('[data-state=failed]')).toHaveLength(1)
    expect(row.attributes('aria-label')).toContain('modelPlaza.metrics.cached')
    expect(row.get('[data-metric=success]').text()).toBe('0.00%')
    expect(row.get('[data-metric=latency]').text()).toBe('15.74s')
    expect(row.get('[data-metric=tps]').text()).toBe('\u2013')
  })

  it('omits AIHub stats when the displayed route has no matching data', () => {
    expect(mountCard([model('k3.1-pro', 2, 10)]).find('[data-testid=plaza-route-stats]').exists()).toBe(false)
  })
})
