import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { Line } from 'vue-chartjs'

import type { AccountUsageHistory } from '@/types'
import AccountUsageTrendChart from '../AccountUsageTrendChart.vue'

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

const history: AccountUsageHistory[] = [
  { date: '2026-10-29', label: '10-29', requests: 120, tokens: 1416000, cost: 1.2, actual_cost: 1, user_cost: 1.4 },
  { date: '2026-10-30', label: '10-30', requests: 80, tokens: 944000, cost: 0.9, actual_cost: 0.75, user_cost: 1.05 },
]

describe('AccountUsageTrendChart', () => {
  it('keeps both USD series on one scale and requests in their own plot', () => {
    const wrapper = mount(AccountUsageTrendChart, { props: { history } })

    const charts = wrapper.findAllComponents(Line)
    expect(charts).toHaveLength(2)
    const [cost, requests] = charts.map((chart) => chart.props('data'))
    expect(cost.labels).toEqual(['10-29', '10-30'])
    expect(cost.datasets.map((ds: any) => ds.data)).toEqual([[1, 0.75], [1.4, 1.05]])
    expect(requests.datasets).toHaveLength(1)
    expect(requests.datasets[0].data).toEqual([120, 80])
    charts.forEach((chart) => {
      expect(Object.keys(chart.props('options').scales)).toEqual(['x', 'y'])
      expect(chart.props('data').datasets.every((ds: any) => !ds.yAxisID)).toBe(true)
    })
  })

  it('labels the zero tick as $0 rather than $0.0000', () => {
    const wrapper = mount(AccountUsageTrendChart, { props: { history } })

    const costTicks = wrapper.findAllComponents(Line)[0].props('options').scales.y.ticks
    expect(costTicks.callback(0)).toBe('$0')
    expect(costTicks.callback(2)).toBe('$2.00')
  })

  it('shows the empty state when there is no history', () => {
    const wrapper = mount(AccountUsageTrendChart, { props: { history: [] } })

    expect(wrapper.findAllComponents(Line)).toHaveLength(0)
    expect(wrapper.text()).toContain('admin.dashboard.noDataAvailable')
  })
})
