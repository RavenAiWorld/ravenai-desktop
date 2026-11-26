import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { OpsDashboardOverview } from '@/api/admin/ops'
import OpsDashboardHeader from '../OpsDashboardHeader.vue'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => params ? `${key}:${JSON.stringify(params)}` : key })
}))
vi.mock('@/api', () => ({ adminAPI: { groups: { getAll: vi.fn().mockResolvedValue([]) } } }))
vi.mock('@/api/admin/ops', () => ({
  opsAPI: {
    getRealtimeTrafficSummary: vi.fn().mockResolvedValue({
      summary: { qps: { current: 1 / 60, avg: 0.025, peak: 0.05 }, tps: { current: 0, avg: 0, peak: 0 } }
    })
  }
}))
vi.mock('@/stores', () => ({
  useAdminSettingsStore: () => ({ opsRealtimeMonitoringEnabled: true, setOpsRealtimeMonitoringEnabledLocal: vi.fn() })
}))

function overview(overrides: Partial<OpsDashboardOverview> = {}): OpsDashboardOverview {
  return {
    start_time: '2026-09-23T00:00:00Z', end_time: '2026-09-24T00:00:00Z', platform: '',
    health_score: 95, health_score_status: 'ok', latency_status: 'ok',
    request_count_basis: 'usage_records_plus_final_errors',
    success_count: 7, error_count_total: 0, business_limited_count: 0, error_count_sla: 0,
    request_count_total: 7, request_count_sla: 7, token_consumed: 0,
    sla: 1, error_rate: 0, upstream_error_rate: 0, upstream_error_count_excl_429_529: 0,
    upstream_429_count: 0, upstream_529_count: 0,
    qps: { current: 0, avg: 0.025, peak: 1 / 60 }, tps: { current: 0, avg: 0, peak: 0 },
    duration: { p99_ms: 1000 }, ttft: { p99_ms: 200 },
    metric_thresholds: { ttft_p99_ms_max: 60000, sla_percent_min: 99.5, request_error_rate_percent_max: 5, upstream_error_rate_percent_max: 5 },
    ...overrides
  }
}

function render(value: OpsDashboardOverview) {
  return shallowMount(OpsDashboardHeader, {
    props: {
      overview: value, platform: '', groupId: null, timeRange: '24h', queryMode: 'auto',
      loading: false, lastUpdated: null, thresholds: { ttft_p99_ms_max: 500 }
    },
    global: {
      stubs: { BaseDialog: { template: '<div><slot /></div>' } }
    }
  })
}

describe('OpsDashboardHeader measurement and health', () => {
  it('keeps low QPS visible and does not call an active window idle', async () => {
    const wrapper = render(overview())
    await flushPromises()
    expect(wrapper.get('[data-testid="ops-health-score"]').text()).toBe('95')
    expect(wrapper.get('[data-testid="ops-current-qps"]').text()).toBe('0.017')
    expect(wrapper.text()).toContain('0.025')
    expect(wrapper.text()).toContain('admin.ops.countBasisHint')
    expect(wrapper.text()).not.toContain('admin.ops.diagnosis.idle')
  })

  it('does not render a healthy score or healthy diagnosis on a latency timeout', () => {
    const wrapper = render(overview({ health_score_status: 'unknown', latency_status: 'timeout', ttft: {}, duration: {} }))
    expect(wrapper.get('[data-testid="ops-health-score"]').text()).toBe('--')
    expect(wrapper.get('[role="status"]').text()).toBe('admin.ops.latencyUnavailable')
    expect(wrapper.text()).toContain('admin.ops.healthUnknown')
    expect(wrapper.text()).not.toContain('admin.ops.healthyStatus')
    expect(wrapper.text()).not.toContain('admin.ops.diagnosis.healthy')
  })

  it('uses the same effective server threshold in card diagnosis instead of hardcoded 500ms', async () => {
    const wrapper = render(overview({ ttft: { p99_ms: 42000 } }))
    expect(wrapper.text()).not.toContain('admin.ops.diagnosis.ttftHigh')
    await wrapper.setProps({ overview: overview({ ttft: { p99_ms: 42000 }, metric_thresholds: { ttft_p99_ms_max: 30000 } }) })
    expect(wrapper.text()).toContain('admin.ops.diagnosis.ttftHigh')
  })

  it('keeps a known threshold when the overview cannot read settings', async () => {
    const wrapper = render(overview({ health_score_status: 'unknown', metric_thresholds: null, ttft: { p99_ms: 10000 } }))
    await wrapper.setProps({ thresholds: { ttft_p99_ms_max: 45000 } })
    expect(wrapper.get('[data-testid="ops-health-score"]').text()).toBe('--')
    expect(wrapper.text()).not.toContain('admin.ops.diagnosis.ttftHigh')
    expect(wrapper.text()).toContain('admin.ops.healthUnknown')
  })

  it('uses the same warning budget as health scoring for a custom SLA floor', () => {
    const wrapper = render(overview({ sla: 0.951, metric_thresholds: { sla_percent_min: 95 } }))
    expect(wrapper.text()).toContain('admin.ops.diagnosis.slaLow')
    expect(wrapper.text()).not.toContain('admin.ops.diagnosis.slaCritical')
  })

  it('shows schedule-derived job states and the next run without a 15-minute age guess', () => {
    const wrapper = render(overview({ job_heartbeats: [
      { job_name: 'daily', health_status: 'healthy', last_success_at: '2026-09-23T00:00:00Z', next_expected_at: '2026-09-24T18:00:00Z' },
      { job_name: 'paused', health_status: 'disabled', last_error_at: '2026-09-23T00:00:00Z' },
      { job_name: 'overdue', health_status: 'stale', last_success_at: '2026-09-23T00:00:00Z' }
    ] }))
    expect(wrapper.text()).toContain('admin.ops.jobHealth.healthy')
    expect(wrapper.text()).toContain('admin.ops.jobHealth.disabled')
    expect(wrapper.text()).toContain('admin.ops.jobHealth.stale')
    expect(wrapper.text()).toContain('admin.ops.nextExpected')
  })
})

const outputOverview = overview({ tps: { current: 0, peak: 0, avg: 242.7 } })
function mountHeader(value = outputOverview) {
  return mount(OpsDashboardHeader, {
    props: { overview: value, platform: '', groupId: null, timeRange: '1h', queryMode: 'auto', loading: false, lastUpdated: null },
    global: { stubs: { Select: true, HelpTooltip: true, BaseDialog: true, Icon: true } }
  })
}

describe('OpsDashboardHeader output TPS', () => {

  it('shows per-request P50, slower-tail percentiles and sample count separately from traffic TPS', async () => {
    const wrapper = mountHeader({ ...outputOverview, output_tps: { p5: 2.35, p10: 3.7, p50: 55, avg: 277.75, sample_count: 4 } })
    await flushPromises()
    const card = wrapper.get('[data-testid="output-tps-card"]')
    expect(card.get('[data-testid="output-tps-p50"]').text()).toBe('55.0')
    expect(card.get('[data-testid="output-tps-p5"]').text()).toBe('2.4')
    expect(card.get('[data-testid="output-tps-p10"]').text()).toBe('3.7')
    expect(card.get('[data-testid="output-tps-avg"]').text()).toBe('277.8')
    expect(card.get('[data-testid="output-tps-samples"]').text()).toContain('4')
    expect(card.text()).toContain('tok/s (P50)')
    expect(card.text()).not.toContain('242.7')
    await wrapper.setProps({ fullscreen: true, overview: { ...outputOverview, output_tps: { p5: 0.01, p10: 0.02, p50: 0.04, avg: 0.05, sample_count: 1 } } })
    expect(card.get('[data-testid="output-tps-p50"]').text()).toBe('0.0')
    expect(card.get('[data-testid="output-tps-samples"]').text()).toContain('1')
    wrapper.unmount()
  })

  it.each([undefined, null, { p5: null, p10: null, p50: null, avg: null, sample_count: 0 }])('shows missing output TPS as unavailable, not zero: %s', async (output_tps) => {
    const wrapper = mountHeader({ ...outputOverview, output_tps })
    await flushPromises()
    for (const metric of ['p5', 'p10', 'p50', 'avg']) {
      expect(wrapper.get(`[data-testid="output-tps-${metric}"]`).text()).toBe('—')
    }
    expect(wrapper.get('[data-testid="output-tps-samples"]').text()).toContain(output_tps == null ? '—' : '0')
    wrapper.unmount()
  })

})
