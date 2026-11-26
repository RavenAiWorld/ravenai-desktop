<template>
  <section class="card p-4" :aria-label="t('admin.accounts.stats.usageTrend')">
    <h3 class="mb-4 text-sm font-semibold text-rv-fg">
      {{ t('admin.accounts.stats.usageTrend') }}
    </h3>
    <div v-if="history.length" class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section class="min-w-0" :aria-label="t('usage.accountBilled')">
        <div class="h-60">
          <Line :data="costChartData" :options="costOptions" />
        </div>
      </section>
      <section class="min-w-0" :aria-label="t('admin.accounts.stats.requests')">
        <h4 class="mb-2 text-xs font-medium text-rv-fg-3">{{ t('admin.accounts.stats.requests') }}</h4>
        <div class="h-[220px]">
          <Line :data="requestChartData" :options="requestOptions" />
        </div>
      </section>
    </div>
    <div v-else class="flex h-60 items-center justify-center text-sm text-rv-fg-3">
      {{ t('admin.dashboard.noDataAvailable') }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { AccountUsageHistory } from '@/types'
import { useDarkMode } from '@/composables/useDarkMode'
import {
  CHART_FONT_FAMILY,
  applyChartDefaults,
  chartAxis,
  chartChrome,
  chartDateAxis,
  chartTooltip,
  seriesColor,
  withAlpha
} from '@/utils/chartTheme'
import { formatNumber } from '@/utils/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)
applyChartDefaults()

const props = defineProps<{ history: AccountUsageHistory[] }>()
const { t } = useI18n()
const isDark = useDarkMode()

const labels = computed(() => props.history.map((point) => point.label || point.date))
const costChartData = computed(() => {
  const actualColor = seriesColor(0, isDark.value)
  return {
    labels: labels.value,
    datasets: [
      {
        label: `${t('usage.accountBilled')} (USD)`,
        data: props.history.map((point) => point.actual_cost),
        borderColor: actualColor,
        backgroundColor: withAlpha(actualColor, 0.1),
        fill: true,
        tension: 0.25
      },
      {
        label: `${t('usage.userBilled')} (USD)`,
        data: props.history.map((point) => point.user_cost),
        borderColor: seriesColor(1, isDark.value),
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        fill: false,
        tension: 0.25
      }
    ]
  }
})
const requestChartData = computed(() => {
  const color = seriesColor(2, isDark.value)
  return {
    labels: labels.value,
    datasets: [{
      label: t('admin.accounts.stats.requests'),
      data: props.history.map((point) => point.requests),
      borderColor: color,
      backgroundColor: withAlpha(color, 0.08),
      fill: true,
      tension: 0.25
    }]
  }
})

function formatCost(value: number): string {
  if (value === 0) return '0'
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`
  if (value >= 1) return value.toFixed(2)
  if (value >= 0.01) return value.toFixed(3)
  return value.toFixed(4)
}

function yAxis(dark: boolean, money: boolean) {
  const chrome = chartChrome(dark)
  return chartAxis(dark, {
    beginAtZero: true,
    ticks: {
      color: chrome.muted,
      padding: 8,
      font: { family: CHART_FONT_FAMILY, size: 11 },
      callback: (value: string | number) => money ? `$${formatCost(Number(value))}` : formatNumber(Number(value))
    }
  })
}

const costOptions = computed(() => {
  const dark = isDark.value
  const chrome = chartChrome(dark)
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
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
          padding: 12,
          font: { family: CHART_FONT_FAMILY, size: 11 }
        }
      },
      tooltip: {
        ...chartTooltip(dark),
        callbacks: {
          label: (context: any) => `${context.dataset.label}: $${formatCost(Number(context.raw))}`
        }
      }
    },
    scales: { x: chartDateAxis(dark), y: yAxis(dark, true) }
  }
})

// Cost and request counts use different units; separate plots avoid a dual axis.
const requestOptions = computed(() => {
  const dark = isDark.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...chartTooltip(dark),
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${formatNumber(Number(context.raw))}`
        }
      }
    },
    scales: { x: chartDateAxis(dark), y: yAxis(dark, false) }
  }
})
</script>
