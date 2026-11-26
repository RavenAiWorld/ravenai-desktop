import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlazaModelTable from '../PlazaModelTable.vue'
import { buildEntries } from '../plazaCatalog'
import type { ModelPlazaGroup, PlazaModel } from '@/api/modelPlaza'

vi.mock('vue-i18n', async () => ({
  ...(await vi.importActual<typeof import('vue-i18n')>('vue-i18n')),
  useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => params ? `${key}${JSON.stringify(params)}` : key })
}))

function model(name: string, input: number, output: number, read: number, write: number): PlazaModel {
  const pricing = {
    input_price: input * 1e-6, output_price: output * 1e-6,
    cache_read_price: read * 1e-6, cache_write_price: write * 1e-6,
    image_input_price: null, image_output_price: null, per_request_price: null
  }
  return {
    name, platform: 'openai', service_tier: name.endsWith('-fast') ? 'priority' : undefined,
    pricing: { ...pricing, billing_mode: 'token', intervals: [
      { ...pricing, min_tokens: 0, max_tokens: 272_000 },
      { ...pricing, min_tokens: 272_000, max_tokens: null, input_price: input * 2e-6, output_price: output * 1.5e-6, cache_read_price: read * 2e-6, cache_write_price: write * 2e-6 }
    ] },
    official_pricing: { ...pricing }
  }
}

function group(models: PlazaModel[], overrides: Partial<ModelPlazaGroup> = {}): ModelPlazaGroup {
  return {
    id: 15, name: 'GPT-Pro', description: '', platform: 'openai', subscription_type: 'standard', rate_multiplier: 0.2,
    peak_rate_enabled: false, peak_start: '', peak_end: '', peak_rate_multiplier: 1, is_exclusive: false,
    image_rate_independent: false, image_rate_multiplier: 1, video_rate_independent: false, video_rate_multiplier: 1,
    long_context_pricing_enabled: true, models, ...overrides
  }
}

function table(g: ModelPlazaGroup, compare = false) {
  return mount(PlazaModelTable, { props: { entries: buildEntries(g), unit: 'M', compare, workload: { input: 1000, cacheHit: 0, output: 100 } } })
}

describe('PlazaModelTable', () => {
  it('shows Terra and Terra Fast separately with cache, long context, and the GPT group rate', () => {
    const wrapper = table(group([
      model('gpt-6.1-terra', 1, 5, 0.05, 1.25),
      model('gpt-6.1-terra-fast', 2, 10, 0.1, 2.5)
    ], { rate_multiplier: 0.18 }))
    expect(wrapper.findAll('[data-price-row]')).toHaveLength(4)
    const expected = {
      'gpt-6.1-terra:standard-0': ['$0.18', '$0.90', '$0.009', '$0.225'],
      'gpt-6.1-terra:standard-1': ['$0.36', '$1.35', '$0.018', '$0.45'],
      'gpt-6.1-terra-fast:fast-0': ['$0.36', '$1.80', '$0.018', '$0.45'],
      'gpt-6.1-terra-fast:fast-1': ['$0.72', '$2.70', '$0.036', '$0.90']
    }
    for (const [key, prices] of Object.entries(expected)) {
      expect(wrapper.get(`[data-price-row="${key}"]`).findAll('[data-price]').map(cell => cell.text())).toEqual(prices)
    }
  })

  it('shows all eight current Sol and Astra tiers with the group multiplier applied once', () => {
    const wrapper = table(group([
      model('gpt-6.1-sol', 2, 10, 0.1, 2.5), model('gpt-6.1-sol-fast', 4, 20, 0.2, 5),
      model('gpt-6-astra', 10, 50, 1, 12.5), model('gpt-6-astra-fast', 20, 100, 2, 25)
    ]))
    const expected = {
      'gpt-6.1-sol:standard-0': ['$0.40', '$2.00', '$0.02', '$0.50'],
      'gpt-6.1-sol:standard-1': ['$0.80', '$3.00', '$0.04', '$1.00'],
      'gpt-6.1-sol-fast:fast-0': ['$0.80', '$4.00', '$0.04', '$1.00'],
      'gpt-6.1-sol-fast:fast-1': ['$1.60', '$6.00', '$0.08', '$2.00'],
      'gpt-6-astra:standard-0': ['$2.00', '$10.00', '$0.20', '$2.50'],
      'gpt-6-astra:standard-1': ['$4.00', '$15.00', '$0.40', '$5.00'],
      'gpt-6-astra-fast:fast-0': ['$4.00', '$20.00', '$0.40', '$5.00'],
      'gpt-6-astra-fast:fast-1': ['$8.00', '$30.00', '$0.80', '$10.00']
    }
    expect(wrapper.findAll('[data-price-row]')).toHaveLength(8)
    for (const [key, prices] of Object.entries(expected)) {
      expect(wrapper.get(`[data-price-row="${key}"]`).findAll('[data-price]').map(cell => cell.text())).toEqual(prices)
    }
  })

  it('keeps missing and zero prices distinct', () => {
    const zero = model('gpt-zero', 0, 0, 0, 0)
    zero.pricing!.intervals = []
    zero.pricing!.cache_read_price = null
    const wrapper = table(group([zero]))
    expect(wrapper.findAll('[data-price]').map(cell => cell.text())).toEqual(['$0', '$0', '—', '$0'])
  })

  it('uses independent image and video rates without multiplying the group rate again', () => {
    const image = model('gpt-image-2', 0, 0, 0, 0)
    image.pricing = { ...image.pricing!, billing_mode: 'image', intervals: [], per_request_price: 0.4 }
    const video = model('sora-2', 0, 0, 0, 0)
    video.pricing = { ...video.pricing!, billing_mode: 'video', intervals: [], per_request_price: 2 }
    const wrapper = table(group([image, video], { image_rate_independent: true, image_rate_multiplier: 0.5, video_rate_independent: true, video_rate_multiplier: 0.3 }))
    expect(wrapper.text()).toContain('modelPlaza.price.perImage{"price":"$0.20"}')
    expect(wrapper.text()).toContain('modelPlaza.price.perVideo{"price":"$0.60"}')
    expect(wrapper.findAll('[data-price]')).toHaveLength(0)
  })

  it('shows official comparison for every context tier, without changing group prices', () => {
    const wrapper = table(group([model('gpt-6.1-sol', 2, 10, 0.1, 2.5)]), true)
    expect(wrapper.findAll('[data-official]')).toHaveLength(8)
    expect(wrapper.get('[data-price-row="gpt-6.1-sol:standard-1"] [data-price=input] s').text()).toBe('$2.00')
    expect(wrapper.get('[data-price-row="gpt-6.1-sol:standard-1"] [data-price=input]').text()).toContain('$0.80')
  })
})
