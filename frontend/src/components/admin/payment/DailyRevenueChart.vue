<template>
  <div class="card p-4">
    <h3 class="mb-4 text-sm font-semibold text-rv-fg">
      {{ t('payment.admin.dailyRevenue') }}
    </h3>
    <div v-if="loading" class="flex h-64 items-center justify-center">
      <LoadingSpinner size="md" />
    </div>
    <div v-else-if="revenueChartData && countChartData" class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section class="h-64 min-w-0" :aria-label="t('payment.admin.revenue')">
        <Line :data="revenueChartData" :options="revenueOptions" />
      </section>
      <section class="min-w-0" :aria-label="t('payment.admin.orderCount')">
        <h4 class="mb-2 text-xs font-medium text-rv-fg-3">{{ t('payment.admin.orderCount') }}</h4>
        <div class="h-[220px]">
          <Line :data="countChartData" :options="countOptions" />
        </div>
      </section>
    </div>
    <div v-else class="flex h-64 items-center justify-center text-sm text-rv-fg-3">
      {{ t('payment.admin.noData') }}
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
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { DailyPaymentStats } from '@/types/payment'
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)
applyChartDefaults()

const { t } = useI18n()
const isDark = useDarkMode()
const props = defineProps<{
  data: DailyPaymentStats[]
  loading?: boolean
}>()

const labels = computed(() => props.data.map((day) => day.date))
const revenueChartData = computed(() => {
  if (!props.data.length) return null
  const currencies = [...new Set(props.data.flatMap((day) => Object.keys(day.amount)))].sort()
  return {
    labels: labels.value,
    datasets: currencies.map((currency, index) => {
      const color = seriesColor(index, isDark.value)
      return {
        label: `${currency} ${t('payment.admin.revenue')}`,
        data: props.data.map((day) => day.amount[currency] || 0),
        borderColor: color,
        backgroundColor: withAlpha(color, 0.08),
        fill: false,
        tension: 0.25
      }
    })
  }
})
const countChartData = computed(() => {
  if (!props.data.length) return null
  const color = seriesColor(2, isDark.value)
  return {
    labels: labels.value,
    datasets: [{
      label: t('payment.admin.orderCount'),
      data: props.data.map((day) => day.count),
      borderColor: color,
      backgroundColor: withAlpha(color, 0.08),
      fill: true,
      tension: 0.25
    }]
  }
})

function countAxis(dark: boolean) {
  const chrome = chartChrome(dark)
  return chartAxis(dark, {
    beginAtZero: true,
    ticks: {
      color: chrome.muted,
      padding: 8,
      font: { family: CHART_FONT_FAMILY, size: 11 },
      callback: (value: string | number) => formatNumber(Number(value))
    }
  })
}

const revenueOptions = computed(() => {
  const dark = isDark.value
  const chrome = chartChrome(dark)
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'start' as const,
        labels: {
          color: chrome.text,
          usePointStyle: true,
          boxWidth: 7,
          boxHeight: 7,
          font: { family: CHART_FONT_FAMILY, size: 11 }
        }
      },
      tooltip: chartTooltip(dark)
    },
    scales: { x: chartDateAxis(dark), y: countAxis(dark) }
  }
})

// Revenue and order count have separate units and therefore separate plots.
const countOptions = computed(() => {
  const dark = isDark.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { display: false }, tooltip: chartTooltip(dark) },
    scales: { x: chartDateAxis(dark), y: countAxis(dark) }
  }
})
</script>
