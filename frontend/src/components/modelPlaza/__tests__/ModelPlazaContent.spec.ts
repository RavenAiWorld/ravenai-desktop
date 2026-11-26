import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ModelPlazaContent from '../ModelPlazaContent.vue'
import type { ModelPlazaGroup, ModelPlazaResponse, PlazaModel } from '@/api/modelPlaza'

const { copyMock } = vi.hoisted(() => ({ copyMock: vi.fn() }))

vi.mock('vue-i18n', async () => ({
  ...(await vi.importActual<typeof import('vue-i18n')>('vue-i18n')),
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}${JSON.stringify(params)}` : key),
    locale: { value: 'zh-CN' }
  })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isAuthenticated: true })
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ cachedPublicSettings: { api_base_url: 'https://api.example.com', server_utc_offset: '+08:00' } })
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyToClipboard: copyMock })
}))

const M = 1e-6

function model(name: string, platform: string, input: number, output: number, extra: Partial<PlazaModel> = {}): PlazaModel {
  return {
    name,
    platform,
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

function group(id: number, name: string, rate: number, models: PlazaModel[]): ModelPlazaGroup {
  return {
    id,
    name,
    description: '',
    platform: 'composite',
    subscription_type: 'standard',
    rate_multiplier: rate,
    peak_rate_enabled: false,
    peak_start: '',
    peak_end: '',
    peak_rate_multiplier: 1,
    is_exclusive: false,
    image_rate_independent: false,
    image_rate_multiplier: 1,
    video_rate_independent: false,
    video_rate_multiplier: 1,
    long_context_pricing_enabled: true,
    models
  }
}

const allGroup = group(8, 'All', 0.2, [
  model('gpt-6.1-sol', 'openai', 4, 20, { info: { display_name: 'GPT-6.1-Sol', context_window: 500_000 } }),
  model('gpt-6.1-sol-fast', 'openai', 8, 40, { service_tier: 'priority' }),
  model('oc-glm-5.3', 'opencode_go', 1.4, 4.4, { info: { display_name: 'GLM-5.3' } }),
  model('k3', 'kimi', 3, 15)
])

function mountContent(props: { response?: ModelPlazaResponse | null; loading?: boolean; error?: boolean } = {}) {
  return mount(ModelPlazaContent, {
    props: {
      response: props.response === undefined ? { description: '', groups: [allGroup] } : props.response,
      loading: props.loading ?? false,
      error: props.error ?? false,
      fetchedAt: new Date('2026-10-22T01:00:00Z')
    },
    attachTo: document.body,
    global: { stubs: { teleport: true, RouterLink: true } }
  })
}

function cardIds(wrapper: ReturnType<typeof mountContent>): string[] {
  return wrapper.findAll('article[data-model]').map((card) => card.attributes('data-model')!)
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('model-plaza:catalog-prefs:v2', JSON.stringify({ view: 'cards', sort: 'recommended' }))
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn()
  }))
  window.history.replaceState(null, '', '/model-plaza')
  copyMock.mockReset()
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('ModelPlazaContent', () => {
  it.each([1440, 390])('shows maintenance groups even when empty and prefers an active route at %ipx', async width => {
    const compact = width < 768
    vi.mocked(window.matchMedia).mockImplementation(query => ({
      matches: compact && query.includes('max-width'), media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn()
    }))
    const paused = { ...group(2, 'Paused', 0.01, allGroup.models), status: 'maintenance' as const }
    const empty = { ...paused, id: 3, name: 'UltraFast', models: [] }
    const wrapper = mountContent({ response: { description: '', groups: [paused, empty, allGroup] } })
    if (compact) await wrapper.get('[data-testid=plaza-filter-open]').trigger('click')
    expect(wrapper.get('[data-testid=plaza-group-2]').text()).toContain('common.groupMaintenance')
    expect(wrapper.get('article[data-model]').text()).not.toContain('common.groupMaintenance')
    await wrapper.get('[data-testid=plaza-group-2]').trigger('click')
    expect(wrapper.get('article[data-model]').text()).toContain('common.groupMaintenance')
    await wrapper.get('[data-testid=plaza-group-3]').trigger('click')
    if (compact) await wrapper.get('[data-testid=plaza-filter-apply]').trigger('click')
    expect(wrapper.get('.plaza-active-group').text()).toContain('common.groupMaintenance')
    expect(wrapper.get('[data-testid=plaza-empty]').text()).toContain('modelPlaza.maintenanceEmpty')
    wrapper.unmount()
  })

  it('defaults to model cards sorted by name on desktop', async () => {
    window.localStorage.removeItem('model-plaza:catalog-prefs:v2')
    const wrapper = mountContent()
    await flushPromises()
    expect(wrapper.find('[data-testid=plaza-price-table]').exists()).toBe(false)
    expect(cardIds(wrapper)).toEqual(['gpt-6.1-sol', 'gpt-6.1-sol-fast', 'k3', 'oc-glm-5.3'])
    wrapper.unmount()
  })

  it('hides admin-labelled groups and models from navigation, counts and deep links', async () => {
    const admin = group(2, 'All【admin专用】', 0.1, [model('secret-admin-model', 'openai', 1, 2)])
    window.history.replaceState(null, '', '/model-plaza?group=2&model=secret-admin-model')
    const wrapper = mountContent({ response: { description: '', groups: [admin, allGroup] } })
    await flushPromises()
    expect(wrapper.find('[data-testid=plaza-group-2]').exists()).toBe(false)
    expect(wrapper.get('[data-testid=plaza-group-all]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.text()).not.toContain('secret-admin-model')
    expect(wrapper.text()).toContain('modelPlaza.groupCount{"count":1}')
    expect(wrapper.find('[data-plaza-drawer]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders an empty state when all groups are hidden', () => {
    const wrapper = mountContent({ response: { description: '', groups: [group(2, 'ADMIN', 1, allGroup.models)] } })
    expect(wrapper.get('[data-testid=plaza-empty]').text()).toContain('modelPlaza.empty')
    expect(cardIds(wrapper)).toHaveLength(0)
    expect(wrapper.text()).toContain('modelPlaza.groupCount{"count":0}')
    wrapper.unmount()
  })

  it('uses the group in a shared model link and clears filters and details when switching', async () => {
    const pro = group(9, 'Pro', 0.5, [model('gpt-6.1-sol', 'openai', 2, 10)])
    window.history.replaceState(null, '', '/model-plaza?group=9&model=gpt-6.1-sol&q=sol')
    const wrapper = mountContent({ response: { description: '', groups: [allGroup, pro] } })
    await flushPromises()
    expect(wrapper.get('[data-testid=plaza-group-title]').text()).toBe('Pro')
    expect(wrapper.get('article [data-price=input]').text()).toBe('$1.00')
    expect(wrapper.find('[data-plaza-drawer]').exists()).toBe(true)
    await wrapper.get('[data-testid=plaza-group-8]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-plaza-drawer]').exists()).toBe(false)
    expect(cardIds(wrapper)).toHaveLength(4)
    expect(new URLSearchParams(window.location.search).get('group')).toBe('8')
    expect(new URLSearchParams(window.location.search).has('model')).toBe(false)
    expect(new URLSearchParams(window.location.search).has('q')).toBe(false)
    wrapper.unmount()
  })

  it('opens mobile filters and restores the catalog after applying a group', async () => {
    vi.mocked(window.matchMedia).mockImplementation(query => ({
      matches: query.includes('max-width'), media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn()
    }))
    window.localStorage.removeItem('model-plaza:catalog-prefs:v2')
    const wrapper = mountContent()
    await flushPromises()
    expect(wrapper.find('[data-testid=plaza-group-8]').exists()).toBe(true)
    expect(cardIds(wrapper)).toHaveLength(4)
    expect(wrapper.find('[data-testid=plaza-price-table]').exists()).toBe(false)
    await wrapper.get('[data-testid=plaza-filter-open]').trigger('click')
    expect(wrapper.get('[data-testid=plaza-filters]').attributes('aria-modal')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
    await wrapper.get('[data-testid=plaza-group-8]').trigger('click')
    await wrapper.get('[data-testid=plaza-filter-apply]').trigger('click')
    expect(document.body.style.overflow).toBe('')
    expect(wrapper.get('[data-testid=plaza-group-title]').text()).toBe('All')
    wrapper.unmount()
  })

  it('shows the single group and its rate, with an independent Fast card', () => {
    const wrapper = mountContent()
    expect(cardIds(wrapper)).toEqual(['gpt-6.1-sol-fast', 'gpt-6.1-sol', 'oc-glm-5.3', 'k3'])
    expect(wrapper.get('[data-testid=plaza-group-8]').text()).toContain('All')
    expect(wrapper.get('[data-testid=plaza-group-8]').text()).toContain('0.2×')
    expect(wrapper.get('[data-testid=plaza-vendor-zhipu]').text()).toContain('GLM')
    expect(wrapper.text()).toContain('modelPlaza.catalogTotal{"count":4}')
    expect(wrapper.text()).toContain('modelPlaza.vendorCount{"count":3}')
    wrapper.unmount()
  })

  it('filters by vendor and search, and clears filters from the empty state', async () => {
    const wrapper = mountContent()
    await wrapper.get('[data-testid=plaza-vendor-zhipu]').trigger('click')
    expect(cardIds(wrapper)).toEqual(['oc-glm-5.3'])
    await wrapper.get('[data-testid=plaza-vendor-all]').trigger('click')

    await wrapper.get('input[type=search]').setValue('sol-fast')
    expect(cardIds(wrapper)).toEqual(['gpt-6.1-sol-fast'])
    await wrapper.get('input[type=search]').setValue('absent-model')
    expect(wrapper.find('[data-testid=plaza-empty]').text()).toContain('modelPlaza.noResult')
    await wrapper.get('[data-testid=plaza-empty] button').trigger('click')
    expect(cardIds(wrapper)).toHaveLength(4)
    wrapper.unmount()
  })

  it('switches to the table view and remembers the choice', async () => {
    const wrapper = mountContent()
    await wrapper.get('[data-testid=plaza-view-table]').trigger('click')
    expect(wrapper.findAll('tr[data-model]').map((row) => row.attributes('data-model'))).toEqual([
      'gpt-6.1-sol-fast',
      'gpt-6.1-sol',
      'oc-glm-5.3',
      'k3'
    ])
    await flushPromises()
    expect(JSON.parse(window.localStorage.getItem('model-plaza:catalog-prefs:v2')!).view).toBe('table')
    wrapper.unmount()

    const again = mountContent()
    expect(again.findAll('tr[data-model]')).toHaveLength(4)
    again.unmount()
  })

  it('opens model details, puts the model in the address bar and closes on Escape', async () => {
    const wrapper = mountContent()
    await wrapper.get('article[data-model="gpt-6.1-sol"] .plaza-card-open').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-plaza-drawer]').exists()).toBe(true)
    expect(window.location.search).toBe('?group=8&model=gpt-6.1-sol')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('[data-plaza-drawer]').exists()).toBe(false)
    expect(window.location.search).toBe('')
    wrapper.unmount()
  })

  it('opens the details named in the link, also for a Fast alias, and applies q/vendor', async () => {
    window.history.replaceState(null, '', '/model-plaza?model=gpt-6.1-sol-fast&vendor=openai&q=sol')
    const wrapper = mountContent()
    await flushPromises()
    expect(wrapper.find('[data-plaza-drawer]').exists()).toBe(true)
    expect(wrapper.get('#plaza-drawer-title').text()).toBe('gpt-6.1-sol-fast')
    expect(cardIds(wrapper)).toEqual(['gpt-6.1-sol-fast', 'gpt-6.1-sol'])
    wrapper.unmount()
  })

  it('keeps shared-link details open when the initial group arrives asynchronously', async () => {
    window.history.replaceState(null, '', '/model-plaza?group=8&model=gpt-6.1-sol-fast')
    const wrapper = mountContent({ response: null, loading: true })
    await wrapper.setProps({ response: { description: '', groups: [allGroup] }, loading: false })
    await flushPromises()
    expect(wrapper.find('[data-plaza-drawer]').exists()).toBe(true)
    expect(wrapper.get('#plaza-drawer-title').text()).toBe('gpt-6.1-sol-fast')
    wrapper.unmount()
  })

  it('copies a model ID with a confirmation message', async () => {
    const wrapper = mountContent()
    await wrapper.get('article[data-model="k3"] [data-testid=plaza-copy]').trigger('click')
    expect(copyMock).toHaveBeenCalledWith('k3', 'modelPlaza.card.copied{"id":"k3"}')
    wrapper.unmount()
  })

  it('switches between groups when there is more than one', async () => {
    const pro = group(9, 'Pro', 0.5, [model('gpt-6-astra', 'openai', 10, 50)])
    const wrapper = mountContent({ response: { description: '', groups: [allGroup, pro] } })
    expect(wrapper.get('[data-testid=plaza-group-9]').text()).toContain('0.5×')
    await wrapper.get('[data-testid=plaza-group-9]').trigger('click')
    expect(cardIds(wrapper)).toEqual(['gpt-6-astra'])
    expect(wrapper.get('[data-testid=plaza-group-rate]').text()).toBe('0.5×')
    expect(wrapper.get('article[data-model="gpt-6-astra"] [data-price=input]').text()).toBe('$5.00')
    wrapper.unmount()
  })

  it('shows loading, a retryable error, and keeps stale prices after a failed refresh', async () => {
    const loading = mountContent({ response: null, loading: true })
    expect(loading.find('[data-testid=plaza-loading]').exists()).toBe(true)
    loading.unmount()

    const failed = mountContent({ response: null, error: true })
    const retry = failed.findAll('button').find((b) => b.text().includes('modelPlaza.retry'))!
    await retry.trigger('click')
    expect(failed.emitted('refresh')).toHaveLength(1)
    failed.unmount()

    const stale = mountContent({ error: true })
    expect(stale.text()).toContain('modelPlaza.staleData')
    expect(cardIds(stale)).toHaveLength(4)
    stale.unmount()
  })

  it('deduplicates all groups, displays the selected route and compares every group in details', async () => {
    const cheaper = group(9, 'Value', 0.1, [model('gpt-6.1-sol', 'openai', 2, 10)])
    const wrapper = mountContent({ response: { description: '', groups: [allGroup, cheaper] } })
    expect(cardIds(wrapper)).toHaveLength(4)
    const card = wrapper.get('article[data-model="gpt-6.1-sol"]')
    expect(card.get('[data-price=input]').text()).toBe('$0.20')
    expect(card.text()).toContain('Value')
    await card.get('.plaza-card-open').trigger('click')
    expect(wrapper.get('[data-testid=plaza-group-prices]').findAll('tbody tr')).toHaveLength(2)
    await wrapper.get('[data-testid=plaza-group-prices] tbody tr:first-child button').trigger('click')
    expect(wrapper.get('[data-testid=plaza-paid-table]').text()).toContain('$0.80')
    expect(new URLSearchParams(window.location.search).get('group')).toBe('8')
    wrapper.unmount()
  })

  it('keeps the displayed price and metrics on the same route in all groups and filtered views', async () => {
    const stats = {
      updated_at: '2026-11-20T04:00:00Z', stale: false, group_average: false,
      history: Array(24).fill('operational'), success_rate: 0.9987, latency_ms: 11990, tps: 33.7
    }
    const name = 'claude-opus-5'
    const kiro = group(31, 'Claude-Kiro', 0.18, [model(name, 'anthropic', 5, 25, { route_stats: stats })])
    const cursor = group(28, 'Claude-Cursor', 0.6, [
      model(name, 'anthropic', 5, 25, { route_stats: { ...stats, tps: 87.4 } })
    ])
    const wrapper = mountContent({ response: { description: '', groups: [cursor, kiro] } })
    const card = () => wrapper.get('article[data-model="claude-opus-5"]')
    expect(card().get('.card-group').text()).toBe('Claude-Kiro')
    expect(card().get('[data-metric=success]').text()).toBe('99.87%')
    expect(card().get('[data-metric=latency]').text()).toBe('11.99s')
    expect(card().get('[data-metric=tps]').text()).toBe('33.7t/s')
    expect(card().findAll('[data-state=operational]')).toHaveLength(24)
    await wrapper.get('[data-testid=plaza-group-28]').trigger('click')
    expect(card().get('.card-group').text()).toBe('Claude-Cursor')
    expect(card().get('[data-metric=tps]').text()).toBe('87.4t/s')
    await wrapper.get('[data-testid=plaza-group-all]').trigger('click')
    await wrapper.get('[data-testid=plaza-vendor-anthropic]').trigger('click')
    expect(card().get('[data-metric=tps]').text()).toBe('33.7t/s')
    expect(card().html()).not.toMatch(/aihub/i)
    wrapper.unmount()
  })

  it('paginates results and resets the page when filters change', async () => {
    const many = group(10, 'Large catalog', 1, Array.from({ length: 45 }, (_, i) => model(`gpt-sample-${i}`, 'openai', 1, 2)))
    const wrapper = mountContent({ response: { description: '', groups: [many] } })
    expect(cardIds(wrapper)).toHaveLength(20)
    await wrapper.get('[data-testid=plaza-next]').trigger('click')
    await wrapper.get('[data-testid=plaza-next]').trigger('click')
    expect(cardIds(wrapper)).toHaveLength(5)
    expect(wrapper.get('[data-testid=plaza-next]').attributes('disabled')).toBeDefined()
    await wrapper.get('input[type=search]').setValue('gpt-sample-0')
    expect(cardIds(wrapper)).toEqual(['gpt-sample-0'])
    expect(wrapper.get('[data-testid=plaza-previous]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('filters per-request billing without confusing it with token prices', async () => {
    const requestModel = model('gpt-task', 'openai', 1, 2)
    requestModel.pricing!.billing_mode = 'per_request'
    requestModel.pricing!.per_request_price = 0.5
    const wrapper = mountContent({ response: { description: '', groups: [group(10, 'Mixed', 0.2, [...allGroup.models, requestModel])] } })
    await wrapper.get('[data-testid=plaza-billing-per_request]').trigger('click')
    expect(cardIds(wrapper)).toEqual(['gpt-task'])
    expect(wrapper.get('article').text()).toContain('$0.10')
    await wrapper.get('[data-testid=plaza-reset]').trigger('click')
    expect(cardIds(wrapper)).toHaveLength(5)
    wrapper.unmount()
  })
})
