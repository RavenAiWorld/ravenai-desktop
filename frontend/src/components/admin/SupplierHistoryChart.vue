<template>
  <div class="supplier-chart" :class="{ 'supplier-chart-compact': compact }">
    <Line
      v-if="hasData"
      :data="data"
      :options="options"
      :plugins="plugins"
      role="img"
      :aria-label="label"
      data-testid="supplier-history-canvas"
    />
    <span v-else class="supplier-chart-empty">{{ emptyLabel || t('admin.supplierHall.noHistory') }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart as ChartJS, LinearScale, PointElement, LineElement, Tooltip, type ChartData, type ChartOptions, type Plugin } from 'chart.js'
import { Line } from 'vue-chartjs'
import type { SupplierRateHistory, SupplierTrend } from '@/api/admin/supplierHall'
import { chartTooltip } from '@/utils/chartTheme'
import { useDarkMode } from '@/composables/useDarkMode'

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip)

const props = defineProps<{
  trend?: SupplierTrend
  rates?: SupplierRateHistory
  rateChart?: boolean
  compact?: boolean
  label: string
  emptyLabel?: string
  averageLabel?: string
  probeLabel?: string
  period?: { from: string; to: string }
}>()
const { t, locale } = useI18n()
const dark = useDarkMode()
type SeriesPoint = { x: number; y: number | null }

const failures = computed(() => (props.trend?.probe ?? []).flatMap(point => {
  if (!point.failed_from) return []
  const start = Date.parse(point.failed_from), end = Date.parse(point.at)
  return start < end ? [{ start, end }] : []
}))
// Use the actual bucket edges. Gaps and unknown results never become outages.
const plugins: Plugin<'line'>[] = [{ id: 'provider-failure-bands', beforeDatasetsDraw(chart) {
  const { ctx, scales: { x }, chartArea: area } = chart
  if (!x || !area || !failures.value.length) return
  ctx.save()
  ctx.fillStyle = dark.value ? 'rgba(231, 111, 120, .29)' : 'rgba(205, 83, 96, .24)'
  for (const { start, end } of failures.value) {
    const left = Math.max(area.left, x.getPixelForValue(start)), right = Math.min(area.right, x.getPixelForValue(end))
    if (right > left) ctx.fillRect(left, area.top, right - left, area.height)
  }
  ctx.restore()
} }]

const rates = computed<SeriesPoint[]>(() => {
  if (!props.rates?.points.length) return []
  const start = Date.parse(props.rates.start)
  const end = Date.parse(props.rates.end)
  const points: SeriesPoint[] = []
  let previous: number | undefined
  for (const point of props.rates.points) {
    const x = Math.max(start, Date.parse(point.at))
    if (previous !== undefined) points.push({ x, y: previous })
    points.push({ x, y: point.rate })
    previous = point.rate
  }
  if (previous !== undefined) points.push({ x: end, y: previous })
  return points
})
const data = computed<ChartData<'line', SeriesPoint[]>>(() => {
  const series = (points: SupplierTrend['probe']) => (points ?? []).map(point => ({
    x: Date.parse(point.at), y: point.has_data ? point.latency_ms : null
  }))
  const common = { pointRadius: 0, pointHitRadius: 9, spanGaps: false }
  if (props.rateChart) return { datasets: [
    { ...common, data: rates.value, label: t('admin.supplierHall.rate'), borderColor: '#0b83ae', borderWidth: 2 }
  ] }
  return { datasets: [
    { ...common, pointRadius: 1.3, data: series(props.trend?.user_latency ?? null), label: props.averageLabel ?? t('admin.modelHealth.hallAverage'), borderColor: '#21ae84', borderWidth: 2 },
    { ...common, pointRadius: 1, data: series(props.trend?.probe ?? null), label: props.probeLabel ?? t('admin.supplierHall.textProbe'), borderColor: '#36a5ce', borderWidth: 1.5, borderDash: [4, 3] }
  ] }
})
const hasData = computed(() => failures.value.length > 0 || data.value.datasets.some(set => set.data.some(point => Number.isFinite(point.x) && point.y != null)))
const options = computed<ChartOptions<'line'>>(() => {
  const axis = dark.value ? '#b0b9c7' : '#626f81'
  const grid = dark.value ? '#283140' : '#e9edf1'
  return {
    responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
    interaction: { intersect: false, mode: 'nearest', axis: 'x' },
    plugins: {
      legend: { display: false },
      tooltip: { ...chartTooltip(dark.value), callbacks: {
        title: items => items[0]?.parsed.x == null ? '' : new Date(items[0].parsed.x).toLocaleString(locale.value),
        label: item => item.parsed.y == null ? '' : `${item.dataset.label}: ${item.parsed.y.toLocaleString(locale.value, { maximumFractionDigits: props.rateChart ? 3 : 0 })}${props.rateChart ? 'x' : ' ms'}`
      } }
    },
    scales: {
      x: {
        type: 'linear', display: !props.compact,
        min: props.rates ? Date.parse(props.rates.start) : props.period ? Date.parse(props.period.from) : undefined,
        max: props.rates ? Date.parse(props.rates.end) : props.period ? Date.parse(props.period.to) : undefined,
        ticks: {
          color: axis, maxTicksLimit: 5,
          callback: value => new Date(Number(value)).toLocaleString(locale.value, props.rateChart
            ? { month: 'short', day: 'numeric' }
            : { hour: '2-digit', minute: '2-digit' })
        },
        grid: { color: grid, drawTicks: false }
      },
      y: {
        display: !props.compact, beginAtZero: !props.rateChart, grace: '8%',
        ticks: {
          color: axis, maxTicksLimit: 4,
          callback: value => props.rateChart ? `${Number(value).toLocaleString(locale.value, { maximumFractionDigits: 3 })}x` : `${Number(value) / 1000}s`
        },
        grid: { color: grid, drawTicks: false }
      }
    },
    layout: { padding: 4 }
  }
})
</script>

<style scoped>
.supplier-chart { position: relative; height: 148px; min-width: 0; }
.supplier-chart-compact { height: 68px; }
.supplier-chart-empty { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; font-size: 11px; @apply text-gray-500 dark:text-gray-400; }
</style>
