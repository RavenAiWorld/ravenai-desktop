<template>
  <section
    class="card flex min-h-[360px] flex-col overflow-hidden !rounded-3xl !border-0 !p-6 shadow-sm ring-1 ring-gray-900/5 dark:!bg-dark-800 dark:ring-dark-700"
  >
    <div class="card-header mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3 !border-0 !p-0">
      <div class="min-w-0">
        <h2 class="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <span class="inline-flex h-4 w-4 text-rv-accent-fg" aria-hidden="true">
            <Icon name="chart" size="sm" />
          </span>
          {{ t('channelMonitorV2.chart.title') }}
        </h2>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-dark-400">
          {{ t('channelMonitorV2.chart.description') }}
        </p>
      </div>
      <div class="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 text-xs text-gray-500 dark:text-gray-400 sm:w-auto">
        <span class="flex shrink-0 items-center gap-1">
          <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: seriesColor(0, isDark) }"></span>{{ t('channelMonitorV2.chart.errorLegend') }}
        </span>
        <span class="flex shrink-0 items-center gap-1">
          <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: seriesColor(1, isDark) }"></span>{{ t('channelMonitorV2.chart.cacheLegend') }}
        </span>
        <span class="flex shrink-0 items-center gap-1">
          <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: seriesColor(2, isDark) }"></span>{{ t('channelMonitorV2.chart.ttftLegend') }}
        </span>
        <span class="badge badge-gray shrink-0">{{ bucketLabel }}</span>
        <button
          type="button"
          class="inline-flex shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-dark-700 dark:bg-dark-900 dark:text-gray-300 dark:hover:bg-dark-800"
          :disabled="!zoomed"
          @click="resetChartZoom"
        >
          {{ t('channelMonitorV2.chart.resetZoom') }}
        </button>
      </div>
    </div>
    <div class="card-body min-h-0 flex-1 !p-0">
      <div v-if="loading" class="flex h-[280px] items-center justify-center sm:h-[300px]">
        <div class="animate-pulse text-sm text-gray-400">{{ t('common.loading') }}</div>
      </div>
      <div
        v-else-if="rateChartData && ttftChartData"
        ref="chartRef"
        class="space-y-5"
        @wheel="onChartWheel"
      >
        <section :aria-label="t('channelMonitorV2.chart.percentAxis')">
          <h3 class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('channelMonitorV2.chart.percentAxis') }}</h3>
          <div class="h-[190px] sm:h-[210px]">
            <Line :data="rateChartData" :options="rateChartOptions" />
          </div>
        </section>
        <section :aria-label="t('channelMonitorV2.metrics.ttftP50')">
          <h3 class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('channelMonitorV2.metrics.ttftP50') }}</h3>
          <div class="h-[170px] sm:h-[190px]">
            <Line :data="ttftChartData" :options="ttftChartOptions" />
          </div>
        </section>
      </div>
      <div v-else class="flex h-[280px] items-center justify-center sm:h-[300px]">
        <EmptyState
          :title="t('channelMonitorV2.chart.emptyTitle')"
          :description="t('channelMonitorV2.empty.description')"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref, watch } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import EmptyState from '@/components/common/EmptyState.vue'
import Icon from '@/components/icons/Icon.vue'
import type { MonitorCoverage, MonitorMetric, MonitorHealth } from '@/api/channelMonitorV2'
import { formatMonitorMs, formatMonitorPercent } from '@/features/channel-monitor-v2/monitorFormat'
import {
  applyWheelZoom,
  clientXRatio,
  isZoomed,
  resetZoom,
  sliceByZoom,
  type ZoomState,
} from '@/features/channel-monitor-v2/monitorZoom'
import { useDarkMode } from '@/composables/useDarkMode'
import {
  CHART_FONT_FAMILY,
  applyChartDefaults,
  chartAxis,
  chartChrome,
  chartTooltip,
  seriesColor,
  withAlpha,
} from '@/utils/chartTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)
applyChartDefaults()
const { t, locale } = useI18n()

const props = defineProps<{
  trend: Array<{ bucket_start: string; metrics: MonitorMetric; health: MonitorHealth }>
  coverage: MonitorCoverage | null
  loading?: boolean
}>()

const chartRef = ref<HTMLElement | null>(null)
const zoom = ref<ZoomState>(resetZoom())
const zoomed = computed(() => isZoomed(zoom.value))
const isDark = useDarkMode()

const bucketLabel = computed(() => {
  const seconds = props.coverage?.bucket_seconds || 60
  const minutes = seconds / 60
  if (minutes < 60) return t('channelMonitorV2.bucket.minutes', { count: minutes })
  const hours = minutes / 60
  if (hours < 24) return t('channelMonitorV2.bucket.hours', { count: hours })
  return t('channelMonitorV2.bucket.days', { count: hours / 24 })
})

const trendLabels = computed(() => visibleTrend.value.map((p) =>
  new Intl.DateTimeFormat(locale.value || undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(p.bucket_start))
))

const rateChartData = computed(() => {
  const points = visibleTrend.value
  if (!points.length) return null
  const errorColor = seriesColor(0, isDark.value)
  return {
    labels: trendLabels.value,
    datasets: [
      {
        label: t('channelMonitorV2.chart.errorDataset'),
        data: smoothTrend(points.map((p) => (p.metrics.error_rate || 0) * 100)),
        borderColor: errorColor,
        backgroundColor: withAlpha(errorColor, 0.1),
        tension: 0.3,
        cubicInterpolationMode: 'monotone' as const,
        fill: 'origin' as const,
      },
      {
        label: t('channelMonitorV2.chart.cacheDataset'),
        data: smoothTrend(points.map((p) => (p.metrics.cache_rate || 0) * 100)),
        borderColor: seriesColor(1, isDark.value),
        backgroundColor: 'transparent',
        tension: 0.3,
        cubicInterpolationMode: 'monotone' as const,
        fill: false,
      },
    ],
  }
})

const ttftChartData = computed(() => {
  const points = visibleTrend.value
  if (!points.length) return null
  return {
    labels: trendLabels.value,
    datasets: [{
      label: t('channelMonitorV2.chart.ttftDataset'),
      data: smoothTrend(points.map((p) => p.metrics.ttft?.p50_ms ?? null)),
      borderColor: seriesColor(2, isDark.value),
      backgroundColor: 'transparent',
      tension: 0.3,
      cubicInterpolationMode: 'monotone' as const,
      fill: false,
      spanGaps: true,
    }],
  }
})

/** Window the series by zoom state around the cursor — not always the last N points. */
const visibleTrend = computed(() => sliceByZoom(props.trend || [], zoom.value))

function onChartWheel(event: WheelEvent) {
  // Plain vertical wheel zooms X (narrower time range); shift/horizontal pans.
  event.preventDefault()
  const ratio = clientXRatio(event.clientX, chartRef.value)
  zoom.value = applyWheelZoom(zoom.value, event, ratio)
}

function resetChartZoom() {
  zoom.value = resetZoom()
}

watch(() => props.trend, () => {
  zoom.value = resetZoom()
})

function smoothTrend(values: Array<number | null>): Array<number | null> {
  if (values.length <= 2) return values
  return values.map((value, index) => {
    if (value == null) return null
    const neighbors = values.slice(Math.max(0, index - 1), Math.min(values.length, index + 2))
      .filter((item): item is number => item != null)
    if (!neighbors.length) return value
    return neighbors.reduce((sum, item) => sum + item, 0) / neighbors.length
  })
}

function xAxis(dark: boolean) {
  const chrome = chartChrome(dark)
  return chartAxis(dark, {
    grid: { display: false },
    ticks: {
      color: chrome.muted,
      padding: 8,
      maxRotation: 0,
      autoSkip: true,
      maxTicksLimit: 8,
      autoSkipPadding: 18,
      font: { family: CHART_FONT_FAMILY, size: 11 },
    },
  })
}

const rateChartOptions = computed(() => {
  const dark = isDark.value
  const chrome = chartChrome(dark)
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...chartTooltip(dark),
        callbacks: {
          label(ctx: { dataset: { label?: string }; parsed: { y: number | null } }) {
            const label = ctx.dataset.label || ''
            const y = ctx.parsed.y
            return `${label}: ${y == null ? '-' : formatMonitorPercent(y / 100)}`
          },
        },
      },
    },
    scales: {
      x: xAxis(dark),
      y: chartAxis(dark, {
        min: 0,
        suggestedMax: 100,
        ticks: {
          color: chrome.muted,
          padding: 8,
          font: { family: CHART_FONT_FAMILY, size: 11 },
          callback: (v: string | number) => `${v}%`,
        },
      }),
    },
  }
})

// Percentages and milliseconds have different units, so TTFT gets its own plot
// rather than a second y-axis on the rate chart.
const ttftChartOptions = computed(() => {
  const dark = isDark.value
  const chrome = chartChrome(dark)
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...chartTooltip(dark),
        callbacks: {
          label(ctx: { dataset: { label?: string }; parsed: { y: number | null } }) {
            const label = ctx.dataset.label || ''
            const y = ctx.parsed.y
            return `${label}: ${y == null ? '-' : formatMonitorMs(y)}`
          },
        },
      },
    },
    scales: {
      x: xAxis(dark),
      y: chartAxis(dark, {
        min: 0,
        ticks: {
          color: chrome.muted,
          padding: 8,
          font: { family: CHART_FONT_FAMILY, size: 11 },
          callback: (v: string | number) => formatMonitorMs(Number(v)),
        },
      }),
    },
  }
})
</script>
