import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { SupplierHall, SupplierHallItem, SupplierSummaryRange, SupplierTrendRange } from '@/api/admin/supplierHall'
import { supplierCardHealth } from '@/utils/supplierHall'
import healthZh from '@/i18n/locales/zh/admin/modelHealth'
import hallZh from '@/i18n/locales/zh/admin/supplierHall'
import SupplierHallView from '../SupplierHallView.vue'

const { hallRequest, seriesRequest } = vi.hoisted(() => ({ hallRequest: vi.fn(), seriesRequest: vi.fn() }))
vi.mock('@/api/admin/supplierHall', async original => ({
  ...await original<typeof import('@/api/admin/supplierHall')>(), getSupplierHall: hallRequest, getSupplierSeries: seriesRequest
}))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showSuccess: vi.fn() }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 7 } }) }))
vi.mock('vue-chartjs', () => ({ Line: { props: ['data', 'options', 'plugins'], template: '<canvas />' } }))

const time = Date.parse('2026-11-10T07:00:30Z')
const iso = (delta: number) => new Date(time + delta).toISOString()
const metric = { duration_ms: 8225, sample_count: 18, tps: 747.1, cache_hit_rate: .8, success_rate: .549,
  input_price_per_million: .72, effective_multiplier: .46, input_warning: { multiplier: 1.577, excess_percent: 57.7, threshold: 1.3, window: '7d' } }
const card = (health: string, model = 'model-a') => ({ model, health, sample_count: 0, health_expires_at: iso(45_000) })
const row = (id: number, platform = 'openai', health = 'healthy'): SupplierHallItem => ({
  group_id: id, code: 'P' + id, platform, rate_multiplier: .46, visible_in_hall: true, catalog_known: true,
  available: false, probe_expires_at: iso(-1000), models: [card(health)],
  supported_models: [{ model: 'model-a', price: { input_per_million: 5, output_per_million: 10, cache_input_per_million: null, cache_write_per_million: null } }],
  warnings: [], warnings_at: iso(0), warnings_expires_at: iso(60000), metrics: metric, model_metrics: {}, stars: 3.5, review_count: 17,
})
const graph: Record<SupplierSummaryRange, SupplierTrendRange> = { '1h': '6h', '6h': '24h', '24h': '7d', '7d': '30d' }
const response = (items: SupplierHallItem[], range: SupplierSummaryRange = '1h'): SupplierHall => ({
  range, trend_range: graph[range], generated_at: iso(0), catalog_at: iso(0), catalog_stale: false, stale: false,
  total: items.length, items, connected: {}, pending: [],
})
const i18n = createI18n({ legacy: false, locale: 'zh', missingWarn: false, fallbackWarn: false, messages: { zh: { admin: { ...healthZh, ...hallZh } } } })
const render = () => mount(SupplierHallView, { global: { plugins: [i18n], stubs: {
  AppLayout: { template: '<div><slot /></div>' }, Select: true, BaseDialog: true, SupplierReviewsDialog: true,
  SupplierConnectDialog: true, ModelIcon: true, Pagination: true, RouterLink: true,
}} })
const platform = (w: ReturnType<typeof render>, id: string) => w.get('[data-testid="hall-platform-' + id + '"] .hall-platform-health')

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(time)
  hallRequest.mockReset()
  seriesRequest.mockReset().mockResolvedValue({})
})
afterEach(() => { vi.useRealTimers() })

describe('supplier hall platform counts', () => {
  it('counts visible, non-excluded groups with a healthy model once and uses the same badge in the row', async () => {
    const mixed = { ...row(1), models: [card('failed'), card('healthy', 'model-b'), card('healthy', 'model-c')] }
    const items = [mixed, row(2, 'deepseek', 'failed'), row(3, 'kimi', 'insufficient'),
      { ...row(4), visible_in_hall: false }, row(5), { ...row(6, 'grok'), visible_in_hall: undefined, available: true }]
    localStorage.setItem('supplier-hall-preferences:7', JSON.stringify({ blocked: [5] }))
    hallRequest.mockResolvedValue(response(items))
    const w = render()
    await flushPromises()
    expect(platform(w, 'openai').get('strong').text()).toBe('1')
    expect(w.get('[data-provider-id="1"] .supplier-state').attributes('data-state')).toBe('available')
    expect(platform(w, 'deepseek').attributes('data-state')).toBe('unavailable')
    expect(platform(w, 'deepseek').get('strong').text()).toBe('0')
    expect(platform(w, 'kimi').attributes('data-state')).toBe('pending')
    expect(platform(w, 'kimi').find('strong').exists()).toBe(false)
    expect(platform(w, 'gemini').attributes('data-state')).toBe('empty')
    expect(platform(w, 'grok').get('strong').text()).toBe('1')
    expect(w.find('[data-provider-id="4"]').exists()).toBe(false)
    expect(w.find('[data-provider-id="5"]').exists()).toBe(false)
    await w.get('[data-provider-id="1"] .supplier-block').trigger('click')
    expect(platform(w, 'openai').attributes('data-state')).toBe('empty')
    w.unmount()
  })

  it('distinguishes loading, an unavailable feed and an expired catalog from a measured zero', async () => {
    hallRequest.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...response([row(1)]), catalog_stale: true })
    const w = render()
    expect(platform(w, 'openai').attributes('data-state')).toBe('loading')
    await flushPromises()
    expect(platform(w, 'openai').attributes('data-state')).toBe('offline')
    await w.get('button[aria-label="刷新"]').trigger('click')
    await flushPromises()
    expect(platform(w, 'openai').attributes('data-state')).toBe('stale')
    expect(w.find('.hall-platform-health strong').exists()).toBe(false)
    expect(w.get('[data-provider-id="1"] .supplier-state').attributes('data-state')).toBe('unknown')
    w.unmount()
  })

  it('uses the published platform tabs in the default hall while keeping other catalog entries accessible to admins', async () => {
    hallRequest.mockResolvedValue({ ...response([row(1), row(2, 'anthropic')]), platform_tabs: ['openai'] })
    const w = render()
    await flushPromises()
    expect(w.findAll('.hall-platform-card')).toHaveLength(1)
    expect(w.find('[data-provider-id="2"]').exists()).toBe(false)
    await w.get('.hall-filters select:has(option[value="all"])').setValue('all')
    expect(w.find('[data-provider-id="2"]').exists()).toBe(true)
    expect(platform(w, 'anthropic').attributes('data-state')).toBe('empty')
    w.unmount()
  })

  it('keeps current availability with stale statistics and withdraws it at model expiry', async () => {
    const item = { ...row(1), models: [{ ...card('healthy'), health_expires_at: iso(1000) }] }
    hallRequest.mockImplementation(async (range: SupplierSummaryRange) => ({ ...response([item], range), stale: range !== '1h' }))
    const w = render()
    await flushPromises()
    const group = w.get('[data-provider-id="1"]')
    const rings = group.findAll('.metric-ring')
    expect(rings.map(r => r.text())).toEqual(['80%', '54.9%', '747.1'])
    expect(rings[1]?.attributes('data-tone')).toBe('low')
    expect(group.get('.latency-value strong').text()).toBe('8,225 ms')
    expect(group.get('.supplier-cost strong').text()).toBe('¥0.72')
    expect(group.get('.supplier-effective').text()).toBe('0.46×')
    expect(group.get('.input-warning').text()).toContain('+57.7%')
    expect(group.get('.provider-rating').text()).toContain('3.5 / 5')
    await vi.advanceTimersByTimeAsync(150)
    expect(seriesRequest).toHaveBeenCalledWith([1], '6h', expect.any(AbortSignal))
    await w.findAll('button').find(b => b.text() === '7d')!.trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(150)
    expect(seriesRequest).toHaveBeenCalledWith([1], '30d', expect.any(AbortSignal))
    expect(platform(w, 'openai').get('strong').text()).toBe('1')
    expect(group.get('.metric-ring').attributes('data-tone')).toBe('unknown')
    await vi.advanceTimersByTimeAsync(1000)
    expect(platform(w, 'openai').attributes('data-state')).toBe('pending')
    expect(group.get('.supplier-state').attributes('data-state')).toBe('unknown')
    w.unmount()
  })

  it('evaluates transitions up to the next boundary without mutating the catalog or inventing future health', () => {
    const model = { ...card('healthy'), health_expires_at: iso(1000),
      health_timeline: [{ at: iso(1000), health: 'failed' }, { at: iso(2000), health: 'insufficient' }] }
    expect(supplierCardHealth(model, time + 999)).toBe('healthy')
    expect(supplierCardHealth(model, time + 1000)).toBe('failed')
    expect(supplierCardHealth(model, time + 2000)).toBe('unknown')
    expect(supplierCardHealth({ ...model, probe_state: 'inactive' }, time)).toBe('unknown')
    expect(model.health_timeline).toHaveLength(2)
  })
})
