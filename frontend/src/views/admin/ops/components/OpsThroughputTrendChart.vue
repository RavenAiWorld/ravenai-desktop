<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart as ChartJS, CategoryScale, Filler, Legend, LineElement, LinearScale, PointElement, Title, Tooltip } from 'chart.js'
import { Line } from 'vue-chartjs'
import type { ChartComponentRef } from 'vue-chartjs'
import type { OpsThroughputGroupBreakdownItem, OpsThroughputPlatformBreakdownItem, OpsThroughputTrendPoint } from '@/api/admin/ops'
import type { ChartState } from '../types'
import { formatHistoryLabel, sumNumbers } from '../utils/opsFormatters'
import HelpTooltip from '@/components/common/HelpTooltip.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { formatNumber } from '@/utils/format'
import { useDarkMode } from '@/composables/useDarkMode'
import {
  CHART_FONT_FAMILY,
  applyChartDefaults,
  chartAxis,
  chartChrome,
  chartTooltip,
  seriesColor,
  withAlpha
} from '@/utils/chartTheme'

ChartJS.register(Title, Tooltip, Legend, LineElement, LinearScale, PointElement, CategoryScale, Filler)
applyChartDefaults()

interface Props {
  points: OpsThroughputTrendPoint[]
  loading: boolean
  timeRange: string
  byPlatform?: OpsThroughputPlatformBreakdownItem[]
  topGroups?: OpsThroughputGroupBreakdownItem[]
  fullscreen?: boolean
}

const props = defineProps<Props>()
const { t } = useI18n()
const emit = defineEmits<{
  (e: 'selectPlatform', platform: string): void
  (e: 'selectGroup', groupId: number): void
  (e: 'openDetails'): void
}>()

const qpsChartRef = ref<ChartComponentRef | null>(null)
const tpsChartRef = ref<ChartComponentRef | null>(null)

function trendCharts(): any[] {
  return [qpsChartRef.value?.chart, tpsChartRef.value?.chart].filter(Boolean)
}

watch(
  () => props.timeRange,
  () => {
    setTimeout(() => {
      trendCharts().forEach((chart) => {
        if (typeof chart.resetZoom === 'function') chart.resetZoom()
      })
    }, 100)
  }
)

const isDark = useDarkMode()

const totalRequests = computed(() => sumNumbers(props.points.map((p) => p.request_count)))

const chartLabels = computed(() => props.points.map((p) => formatHistoryLabel(p.bucket_start, props.timeRange)))

const qpsChartData = computed(() => {
  if (!props.points.length || totalRequests.value <= 0) return null
  const color = seriesColor(0, isDark.value)
  return {
    labels: chartLabels.value,
    datasets: [{
      label: 'QPS',
      data: props.points.map((p) => p.qps ?? 0),
      borderColor: color,
      backgroundColor: withAlpha(color, 0.12),
      fill: true,
      tension: 0.3
    }]
  }
})

const tpsChartData = computed(() => {
  if (!props.points.length || totalRequests.value <= 0) return null
  const color = seriesColor(1, isDark.value)
  return {
    labels: chartLabels.value,
    datasets: [{
      label: t('admin.ops.tpsK'),
      data: props.points.map((p) => (p.tps ?? 0) / 1000),
      borderColor: color,
      backgroundColor: withAlpha(color, 0.1),
      fill: true,
      tension: 0.3
    }]
  }
})

const state = computed<ChartState>(() => {
  if (qpsChartData.value && tpsChartData.value) return 'ready'
  if (props.loading) return 'loading'
  return 'empty'
})

// QPS and tokens/s use different units. Small multiples keep one scale per plot
// instead of implying comparability with a second y-axis.
const options = computed(() => {
  const dark = isDark.value
  const chrome = chartChrome(dark)
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...chartTooltip(dark),
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || ''
            if (label) label += ': '
            if (context.raw !== null) label += context.parsed.y.toFixed(1)
            return label
          }
        }
      },
      zoom: {
        pan: { enabled: true, mode: 'x' as const, modifierKey: 'ctrl' as const },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' as const }
      }
    },
    scales: {
      x: chartAxis(dark, {
        grid: { display: false },
        ticks: {
          color: chrome.muted,
          padding: 8,
          font: { family: CHART_FONT_FAMILY, size: 11 },
          maxTicksLimit: 6,
          maxRotation: 0,
          autoSkip: true,
          autoSkipPadding: 18
        }
      }),
      y: chartAxis(dark, {
        beginAtZero: true,
        ticks: {
          color: chrome.muted,
          padding: 8,
          font: { family: CHART_FONT_FAMILY, size: 11 }
        }
      })
    }
  }
})

function resetZoom() {
  trendCharts().forEach((chart) => {
    if (typeof chart.resetZoom === 'function') chart.resetZoom()
  })
}

function downloadChart() {
  const charts = trendCharts()
  if (!charts.length || !charts.every((chart) => chart.canvas)) return
  // Export both small multiples as one image, with their units printed above each plot.
  const width = Math.max(...charts.map((chart) => chart.canvas.width))
  const titleHeight = 28
  const height = charts.reduce((sum, chart) => sum + chart.canvas.height + titleHeight, 0)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return
  const chrome = chartChrome(isDark.value)
  context.fillStyle = chrome.surface
  context.fillRect(0, 0, width, height)
  context.font = `12px ${CHART_FONT_FAMILY}`
  context.textBaseline = 'middle'
  let y = 0
  charts.forEach((chart, index) => {
    context.fillStyle = chrome.text
    context.fillText(index === 0 ? 'QPS' : t('admin.ops.tpsK'), 12, y + titleHeight / 2)
    context.drawImage(chart.canvas, 0, y + titleHeight)
    y += chart.canvas.height + titleHeight
  })
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png', 1)
  a.download = `ops-throughput-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`
  a.click()
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 dark:bg-dark-800 dark:ring-dark-700">
    <div
      data-testid="throughput-chart-header"
      class="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <h3 class="flex min-w-0 items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
        <svg class="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        {{ t('admin.ops.throughputTrend') }}
        <HelpTooltip v-if="!props.fullscreen" :content="t('admin.ops.tooltips.throughputTrend')" />
      </h3>
      <div
        data-testid="throughput-chart-toolbar"
        class="flex w-full min-w-0 flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 sm:w-auto sm:justify-end"
      >
        <span class="flex shrink-0 items-center gap-1"><span class="h-2 w-2 rounded-full" :style="{ backgroundColor: seriesColor(0, isDark) }"></span>QPS</span>
        <span class="flex shrink-0 items-center gap-1"><span class="h-2 w-2 rounded-full" :style="{ backgroundColor: seriesColor(1, isDark) }"></span>{{ t('admin.ops.tpsK') }}</span>
        <template v-if="!props.fullscreen">
          <button
            type="button"
            class="inline-flex shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-dark-700 dark:bg-dark-900 dark:text-gray-300 dark:hover:bg-dark-800"
            :disabled="state !== 'ready'"
            :title="t('admin.ops.requestDetails.title')"
            @click="emit('openDetails')"
          >
            {{ t('admin.ops.requestDetails.details') }}
          </button>
          <button
            type="button"
            class="inline-flex shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-dark-700 dark:bg-dark-900 dark:text-gray-300 dark:hover:bg-dark-800"
            :disabled="state !== 'ready'"
            :title="t('admin.ops.charts.resetZoomHint')"
            @click="resetZoom"
          >
            {{ t('admin.ops.charts.resetZoom') }}
          </button>
          <button
            type="button"
            class="inline-flex shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-dark-700 dark:bg-dark-900 dark:text-gray-300 dark:hover:bg-dark-800"
            :disabled="state !== 'ready'"
            :title="t('admin.ops.charts.downloadChartHint')"
            @click="downloadChart"
          >
            {{ t('admin.ops.charts.downloadChart') }}
          </button>
        </template>
      </div>
    </div>

    <!-- Drilldown chips (baseline interaction: click to set global filter) -->
    <div v-if="(props.topGroups?.length ?? 0) > 0" class="mb-3 flex flex-wrap gap-2">
      <button
        v-for="g in props.topGroups"
        :key="g.group_id"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-dark-700 dark:bg-dark-900 dark:text-gray-200 dark:hover:bg-dark-800"
        @click="emit('selectGroup', g.group_id)"
      >
        <span class="max-w-[180px] truncate">{{ g.group_name || `#${g.group_id}` }}</span>
        <span class="text-gray-400 dark:text-gray-500">{{ formatNumber(g.request_count) }}</span>
      </button>
    </div>

    <div v-else-if="(props.byPlatform?.length ?? 0) > 0" class="mb-3 flex flex-wrap gap-2">
      <button
        v-for="p in props.byPlatform"
        :key="p.platform"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-dark-700 dark:bg-dark-900 dark:text-gray-200 dark:hover:bg-dark-800"
        @click="emit('selectPlatform', p.platform)"
      >
        <span class="uppercase">{{ p.platform }}</span>
        <span class="text-gray-400 dark:text-gray-500">{{ formatNumber(p.request_count) }}</span>
      </button>
    </div>

    <div v-if="state === 'ready' && qpsChartData && tpsChartData" class="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
      <section class="flex min-h-[190px] min-w-0 flex-col" aria-label="QPS">
        <h4 class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">QPS</h4>
        <div class="min-h-0 flex-1">
          <Line ref="qpsChartRef" :data="qpsChartData" :options="options" />
        </div>
      </section>
      <section class="flex min-h-[190px] min-w-0 flex-col" :aria-label="t('admin.ops.tpsK')">
        <h4 class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('admin.ops.tpsK') }}</h4>
        <div class="min-h-0 flex-1">
          <Line ref="tpsChartRef" :data="tpsChartData" :options="options" />
        </div>
      </section>
    </div>
    <div v-else class="flex min-h-0 flex-1 items-center justify-center">
      <div v-if="state === 'loading'" class="animate-pulse text-sm text-gray-400">{{ t('common.loading') }}</div>
      <EmptyState v-else :title="t('common.noData')" :description="t('admin.ops.charts.emptyRequest')" />
    </div>
  </div>
</template>
