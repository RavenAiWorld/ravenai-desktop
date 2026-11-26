<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart as ChartJS, BarElement, CategoryScale, Legend, LinearScale, Tooltip } from 'chart.js'
import { Bar } from 'vue-chartjs'
import type { OpsLatencyHistogramResponse } from '@/api/admin/ops'
import type { ChartState } from '../types'
import HelpTooltip from '@/components/common/HelpTooltip.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { CHART_FONT_FAMILY, applyChartDefaults, chartAxis, chartChrome, chartTooltip, seriesColor } from '@/utils/chartTheme'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)
applyChartDefaults()

interface Props {
  latencyData: OpsLatencyHistogramResponse | null
  loading: boolean
}

const props = defineProps<Props>()
const { t } = useI18n()

const isDark = useDarkMode()

const hasData = computed(() => (props.latencyData?.total_requests ?? 0) > 0)

const state = computed<ChartState>(() => {
  if (hasData.value) return 'ready'
  if (props.loading) return 'loading'
  return 'empty'
})

const chartData = computed(() => {
  if (!props.latencyData || !hasData.value) return null
  return {
    labels: props.latencyData.buckets.map((b) => b.range),
    datasets: [
      {
        label: t('admin.ops.requests'),
        data: props.latencyData.buckets.map((b) => b.count),
        backgroundColor: seriesColor(0, isDark.value),
        borderRadius: 4,
        borderSkipped: 'start' as const,
        barPercentage: 0.7,
        categoryPercentage: 0.82
      }
    ]
  }
})

const options = computed(() => {
  const dark = isDark.value
  const chrome = chartChrome(dark)
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: chartTooltip(dark)
    },
    scales: {
      x: chartAxis(dark, {
        grid: { display: false },
        ticks: {
          color: chrome.muted,
          padding: 8,
          maxRotation: 0,
          autoSkip: true,
          autoSkipPadding: 12,
          font: { family: CHART_FONT_FAMILY, size: 11 }
        }
      }),
      y: chartAxis(dark, {
        beginAtZero: true,
        ticks: {
          color: chrome.muted,
          padding: 8,
          precision: 0,
          font: { family: CHART_FONT_FAMILY, size: 11 }
        }
      })
    }
  }
})
</script>

<template>
  <div class="flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 dark:bg-dark-800 dark:ring-dark-700">
    <div class="mb-4 flex items-center justify-between">
      <h3 class="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
        <svg class="h-4 w-4 text-rv-accent-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {{ t('admin.ops.latencyHistogram') }}
        <HelpTooltip :content="t('admin.ops.tooltips.latencyHistogram')" />
      </h3>
    </div>

    <div class="min-h-0 flex-1">
      <Bar v-if="state === 'ready' && chartData" :data="chartData" :options="options" />
      <div v-else class="flex h-full items-center justify-center">
        <div v-if="state === 'loading'" class="animate-pulse text-sm text-gray-400">{{ t('common.loading') }}</div>
        <EmptyState v-else :title="t('common.noData')" :description="t('admin.ops.charts.emptyRequest')" />
      </div>
    </div>
  </div>
</template>
