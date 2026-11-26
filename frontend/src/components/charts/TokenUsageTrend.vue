<template>
  <div class="card flex flex-col">
    <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 pb-1 pt-4">
      <h3 class="text-sm font-semibold text-rv-fg">
        {{ t('admin.dashboard.tokenUsageTrend') }}
      </h3>
      <p v-if="periodHitRate !== null" class="text-xs text-rv-fg-3">
        {{ t('usage.cacheHitRate') }}
        <span class="ml-1 font-medium text-rv-fg">{{ periodHitRate.toFixed(1) }}%</span>
      </p>
    </div>
    <div v-if="loading" class="flex h-60 items-center justify-center">
      <LoadingSpinner />
    </div>
    <div v-else-if="trendData.length > 0 && chartData" class="h-60 px-3 pb-3">
      <Line :data="chartData" :options="lineOptions" />
    </div>
    <div
      v-else
      class="flex h-60 items-center justify-center text-sm text-rv-fg-3"
    >
      {{ t('admin.dashboard.noDataAvailable') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { TrendDataPoint } from '@/types'
import { useDarkMode } from '@/composables/useDarkMode'
import { applyChartDefaults, chartAxis, chartDateAxis, chartChrome, chartTooltip, seriesColor, CHART_FONT_FAMILY } from '@/utils/chartTheme'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)
applyChartDefaults()

const { t } = useI18n()

const props = defineProps<{
  trendData: TrendDataPoint[]
  loading?: boolean
}>()

const isDarkMode = useDarkMode()

const hitRate = (d: TrendDataPoint) => {
  const totalPromptTokens = d.input_tokens + d.cache_read_tokens + d.cache_creation_tokens
  return totalPromptTokens > 0 ? (d.cache_read_tokens / totalPromptTokens) * 100 : 0
}

// Cache hit rate is a percentage, so it is summarised here and in the tooltip
// instead of sharing the token axis (one chart, one scale).
const periodHitRate = computed(() => {
  if (!props.trendData?.length) return null
  const totals = props.trendData.reduce(
    (acc, d) => {
      acc.read += d.cache_read_tokens
      acc.prompt += d.input_tokens + d.cache_read_tokens + d.cache_creation_tokens
      return acc
    },
    { read: 0, prompt: 0 }
  )
  return totals.prompt > 0 ? (totals.read / totals.prompt) * 100 : 0
})

const chartData = computed(() => {
  if (!props.trendData?.length) return null
  const dark = isDarkMode.value
  const series = [
    { label: t('dashboard.input'), key: 'input_tokens' as const },
    { label: t('dashboard.output'), key: 'output_tokens' as const },
    { label: t('usage.cacheCreationTokensLabel'), key: 'cache_creation_tokens' as const },
    { label: t('usage.cacheReadTokensLabel'), key: 'cache_read_tokens' as const }
  ]

  return {
    labels: props.trendData.map((d) => d.date),
    datasets: series.map((s, index) => ({
      label: s.label,
      data: props.trendData.map((d) => d[s.key]),
      borderColor: seriesColor(index, dark),
      backgroundColor: seriesColor(index, dark),
      pointBackgroundColor: seriesColor(index, dark),
      pointBorderColor: chartChrome(dark).surface,
      pointBorderWidth: 2,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.25
    }))
  }
})

const lineOptions = computed(() => {
  const dark = isDarkMode.value
  const chrome = chartChrome(dark)
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const
    },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'start' as const,
        labels: {
          color: chrome.text,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 7,
          boxHeight: 7,
          padding: 14,
          font: { family: CHART_FONT_FAMILY, size: 12 }
        }
      },
      tooltip: {
        ...chartTooltip(dark),
        callbacks: {
          label: (context: any) => ` ${context.dataset.label}: ${formatTokens(context.raw)}`,
          footer: (tooltipItems: any) => {
            const dataIndex = tooltipItems[0]?.dataIndex
            if (dataIndex !== undefined && props.trendData[dataIndex]) {
              const data = props.trendData[dataIndex]
              return [
                `${t('usage.cacheHitRate')}: ${hitRate(data).toFixed(1)}%`,
                `Actual: $${formatCost(data.actual_cost)} | Standard: $${formatCost(data.cost)}`
              ]
            }
            return ''
          }
        }
      }
    },
    scales: {
      x: chartDateAxis(isDarkMode.value),
      y: chartAxis(dark, {
        beginAtZero: true,
        ticks: {
          color: chrome.muted,
          padding: 8,
          font: { family: CHART_FONT_FAMILY, size: 11 },
          callback: (value: string | number) => formatTokens(Number(value))
        }
      })
    }
  }
})

const formatTokens = (value: number): string => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toLocaleString()
}

const formatCost = (value: number): string => {
  if (value >= 1000) {
    return (value / 1000).toFixed(2) + 'K'
  } else if (value >= 1) {
    return value.toFixed(2)
  } else if (value >= 0.01) {
    return value.toFixed(3)
  }
  return value.toFixed(4)
}
</script>
