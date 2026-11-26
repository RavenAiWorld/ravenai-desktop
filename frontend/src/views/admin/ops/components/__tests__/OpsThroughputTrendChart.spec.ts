import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { Line } from 'vue-chartjs'

import type { OpsThroughputTrendPoint } from '@/api/admin/ops'
import OpsThroughputTrendChart from '../OpsThroughputTrendChart.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('vue-chartjs', () => ({
  Line: {
    props: ['data', 'options'],
    template: '<div class="line-chart" />',
  },
}))

describe('OpsThroughputTrendChart', () => {
  it('allows the header controls to wrap on narrow screens', () => {
    const wrapper = mount(OpsThroughputTrendChart, {
      props: {
        points: [],
        loading: false,
        timeRange: '1h',
      },
      global: {
        stubs: {
          EmptyState: true,
          HelpTooltip: true,
        },
      },
    })

    const header = wrapper.get('[data-testid="throughput-chart-header"]')
    expect(header.classes()).toEqual(expect.arrayContaining(['flex-col', 'sm:flex-row']))

    const toolbar = wrapper.get('[data-testid="throughput-chart-toolbar"]')
    expect(toolbar.classes()).toEqual(expect.arrayContaining(['w-full', 'flex-wrap', 'sm:w-auto']))
    expect(toolbar.findAll('button')).toHaveLength(3)
    toolbar.findAll('button').forEach((button) => {
      expect(button.classes()).toContain('shrink-0')
      expect(button.classes()).not.toContain('ml-2')
    })
  })

  it('plots QPS and TPS as two single-scale charts instead of a dual axis', () => {
    const points: OpsThroughputTrendPoint[] = [
      { bucket_start: '2026-10-30T10:00:00Z', request_count: 120, token_consumed: 180000, qps: 2, tps: 3000 },
      { bucket_start: '2026-10-30T10:01:00Z', request_count: 90, token_consumed: 150000, qps: 1.5, tps: 2500 },
    ]
    const wrapper = mount(OpsThroughputTrendChart, {
      props: { points, loading: false, timeRange: '1h' },
      global: {
        stubs: {
          EmptyState: true,
          HelpTooltip: true,
        },
      },
    })

    const charts = wrapper.findAllComponents(Line)
    expect(charts).toHaveLength(2)
    const [qps, tps] = charts.map((chart) => chart.props('data'))
    expect(qps.datasets).toHaveLength(1)
    expect(qps.datasets[0].data).toEqual([2, 1.5])
    expect(tps.datasets).toHaveLength(1)
    expect(tps.datasets[0].data).toEqual([3, 2.5])
    charts.forEach((chart) => {
      expect(Object.keys(chart.props('options').scales)).toEqual(['x', 'y'])
      expect(chart.props('data').datasets.every((ds: any) => !ds.yAxisID)).toBe(true)
    })
  })
})
