<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('admin.balanceBilling.timeRange') }}:</span>
          <div ref="rangePickerRef" class="relative">
            <button
              type="button"
              class="inline-flex h-10 items-center gap-2 rounded-lg border border-rv-line bg-rv-surface px-3 text-sm font-medium text-rv-fg shadow-sm transition-colors hover:border-rv-line-strong hover:bg-rv-hover"
              :aria-expanded="rangeOpen"
              aria-haspopup="dialog"
              @click="toggleRangePicker"
            >
              <Icon name="calendar" size="sm" class="text-rv-fg-3" />
              <span>{{ rangeLabel }}</span>
              <Icon name="chevronDown" size="sm" class="text-gray-400 transition-transform" :class="{ 'rotate-180': rangeOpen }" />
            </button>
            <div
              v-if="rangeOpen"
              class="absolute left-0 top-full z-40 mt-2 w-[min(540px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-dark-700 dark:bg-dark-800"
              role="dialog"
              :aria-label="t('admin.balanceBilling.timeRange')"
            >
              <div class="grid grid-cols-2 gap-2 p-3">
                <button
                  v-for="preset in rangePresets"
                  :key="preset.id"
                  type="button"
                  class="rounded-lg px-3 py-2 text-left text-sm transition-colors"
                  :class="draftRange === preset.id
                    ? 'bg-rv-muted font-medium text-rv-fg'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-dark-700'"
                  @click="chooseRangePreset(preset.id)"
                >
                  {{ preset.label }}
                </button>
              </div>
              <div class="border-t border-gray-100 p-3 dark:border-dark-700">
                <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
                  <label class="min-w-0">
                    <span class="mb-1 block text-xs text-gray-500 dark:text-gray-400">{{ t('admin.balanceBilling.startDate') }}</span>
                    <input v-model="draftStartDate" type="date" class="input h-9 w-full" @input="markCustomRange" />
                  </label>
                  <span class="pb-2 text-gray-400">→</span>
                  <label class="min-w-0">
                    <span class="mb-1 block text-xs text-gray-500 dark:text-gray-400">{{ t('admin.balanceBilling.endDate') }}</span>
                    <input v-model="draftEndDate" type="date" class="input h-9 w-full" @input="markCustomRange" />
                  </label>
                </div>
                <div class="mt-3 flex items-center justify-between gap-3">
                  <p v-if="rangeError" class="text-xs text-red-600 dark:text-red-300">{{ rangeError }}</p>
                  <span v-else class="text-xs text-gray-400">{{ t('admin.balanceBilling.rangeCustom') }}</span>
                  <button type="button" class="btn btn-primary h-9 px-4" @click="applyRange">
                    {{ t('admin.balanceBilling.apply') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="loadReport(true)">
          <Icon name="refresh" size="md" class="mr-1.5" :class="{ 'animate-spin': loading }" />
          {{ t('common.refresh') }}
        </button>
      </div>

      <div v-if="error" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
        {{ t('admin.balanceBilling.loadError') }}
        <button type="button" class="ml-2 font-medium underline" @click="loadReport(false)">{{ t('common.tryAgain') }}</button>
      </div>

      <div class="stat-strip sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="card in summaryCards" :key="card.key" class="stat-cell">
          <p class="stat-cell-label">{{ card.label }}</p>
          <p class="stat-cell-value" :title="card.exact">{{ card.value }}</p>
          <p class="stat-cell-meta">{{ card.detail }}</p>
        </div>
      </div>

      <section v-if="isSingleDayRange" class="card overflow-hidden">
        <div class="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-dark-700 sm:px-5">
          <div>
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ singleDayReportTitle }}</h2>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ report?.start_date }} · {{ t('admin.balanceBilling.todayDetail', { users: report?.period_users ?? 0, requests: report?.period_requests ?? 0 }) }} · {{ t('admin.balanceBilling.tokens') }} {{ report ? tokenYi(report.period_tokens) : '—' }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ rangeTotalLabel }}</p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-rv-fg">{{ report ? money(report.period_total) : '—' }}</p>
          </div>
        </div>
        <DataTable :columns="todayColumns" :data="report?.users ?? []" :loading="loading" row-key="user_id">
          <template #cell-user="{ row }">
            <div class="font-medium text-gray-900 dark:text-white">{{ row.username || `#${row.user_id}` }}</div>
            <div v-if="row.email" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ row.email }}</div>
          </template>
          <template #cell-total_cost="{ row }">
            <span class="font-medium tabular-nums text-rv-fg">{{ money(row.total_cost) }}</span>
          </template>
          <template #cell-requests="{ row }"><span class="tabular-nums">{{ number(row.requests) }}</span></template>
          <template #cell-total_tokens="{ row }"><span class="tabular-nums">{{ tokenYi(row.total_tokens) }}</span></template>
          <template #cell-last_at="{ row }"><span class="text-xs text-gray-500 dark:text-gray-400">{{ dateTime(row.last_at) }}</span></template>
        </DataTable>
      </section>

      <div class="grid grid-cols-1 gap-4" :class="{ 'xl:grid-cols-2': isSingleDayRange }">
        <section class="card p-4 sm:p-5">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('admin.balanceBilling.dailyTrend') }}</h2>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span v-if="report?.billing_start_date">{{ t('admin.balanceBilling.billingStart', { date: report.billing_start_date }) }} · </span>{{ report?.start_date }} – {{ report?.end_date }}
              </p>
            </div>
            <Icon name="chart" size="lg" class="text-rv-fg-3" />
          </div>
          <div class="h-72">
            <Line v-if="hasDailyData" :data="dailyChartData" :options="lineOptions" />
            <div v-else class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">{{ t('common.noData') }}</div>
          </div>
        </section>

        <section v-if="isSingleDayRange" class="card p-4 sm:p-5">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('admin.balanceBilling.hourlyTrend') }}</h2>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ report?.start_date }}</p>
            </div>
            <Icon name="chartBar" size="lg" class="text-rv-fg-3" />
          </div>
          <div class="h-72">
            <Bar v-if="hasHourlyData" :data="hourlyChartData" :options="barOptions" />
            <div v-else class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">{{ t('common.noData') }}</div>
          </div>
        </section>
      </div>

      <section class="card p-4 sm:p-5">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('admin.balanceBilling.modelTokenChart') }}</h2>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ report?.start_date }} – {{ report?.end_date }} · {{ t('admin.balanceBilling.tokens') }}</p>
          </div>
          <Icon name="chartBar" size="lg" class="text-rv-fg-3" />
        </div>
        <div class="h-80">
          <Bar v-if="hasModelData" :data="modelChartData" :options="modelChartOptions" />
          <div v-else class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">{{ t('common.noData') }}</div>
        </div>
      </section>

      <section class="card overflow-hidden">
        <div class="border-b border-gray-100 px-4 py-3 dark:border-dark-700 sm:px-5">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('admin.balanceBilling.modelConsumption') }}</h2>
        </div>
        <DataTable :columns="modelColumns" :data="report?.models ?? []" :loading="loading" row-key="model">
          <template #cell-total_cost="{ row }">
            <span class="font-medium tabular-nums text-rv-fg">{{ money(row.total_cost) }}</span>
          </template>
          <template #cell-input_tokens="{ row }"><span class="tabular-nums">{{ tokenYi(row.input_tokens) }}</span></template>
          <template #cell-output_tokens="{ row }"><span class="tabular-nums">{{ tokenYi(row.output_tokens) }}</span></template>
          <template #cell-cache_tokens="{ row }"><span class="tabular-nums">{{ tokenYi(row.cache_tokens) }}</span></template>
          <template #cell-total_tokens="{ row }">
            <span class="tabular-nums text-rv-fg-2">{{ tokenYi(row.total_tokens) }}</span>
          </template>
        </DataTable>
      </section>

      <section class="card overflow-hidden">
        <div class="border-b border-gray-100 px-4 py-3 dark:border-dark-700 sm:px-5">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('admin.balanceBilling.modelUserConsumption') }}</h2>
        </div>
        <DataTable :columns="modelUserColumns" :data="report?.model_users ?? []" :loading="loading" :row-key="modelUserKey">
          <template #cell-user="{ row }">
            <div class="font-medium text-gray-900 dark:text-white">{{ row.username || `#${row.user_id}` }}</div>
            <div v-if="row.email" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ row.email }}</div>
          </template>
          <template #cell-total_cost="{ row }">
            <span class="font-medium tabular-nums text-rv-fg">{{ money(row.total_cost) }}</span>
          </template>
          <template #cell-total_tokens="{ row }">
            <span class="tabular-nums text-rv-fg-2">{{ tokenYi(row.total_tokens) }}</span>
          </template>
          <template #cell-last_at="{ row }"><span class="text-xs text-gray-500 dark:text-gray-400">{{ dateTime(row.last_at) }}</span></template>
        </DataTable>
      </section>

      <section class="card overflow-hidden">
        <div class="border-b border-gray-100 px-4 py-3 dark:border-dark-700 sm:px-5">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('admin.balanceBilling.dailyDetail') }}</h2>
        </div>
        <DataTable :columns="dailyColumns" :data="report?.daily ?? []" :loading="loading" row-key="date">
          <template #cell-total_cost="{ row }">
            <span class="font-medium tabular-nums text-rv-fg">{{ money(row.total_cost) }}</span>
          </template>
          <template #cell-requests="{ row }"><span class="tabular-nums">{{ number(row.requests) }}</span></template>
          <template #cell-users="{ row }"><span class="tabular-nums">{{ number(row.users) }}</span></template>
          <template #cell-total_tokens="{ row }"><span class="tabular-nums">{{ tokenYi(row.total_tokens) }}</span></template>
        </DataTable>
      </section>

      <section class="card overflow-hidden">
        <div class="border-b border-gray-100 px-4 py-3 dark:border-dark-700 sm:px-5">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('admin.balanceBilling.userRanking') }}</h2>
        </div>
        <DataTable :columns="userColumns" :data="report?.users ?? []" :loading="loading" row-key="user_id">
          <template #cell-user="{ row }">
            <div class="font-medium text-gray-900 dark:text-white">{{ row.username || `#${row.user_id}` }}</div>
            <div v-if="row.email" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ row.email }}</div>
          </template>
          <template #cell-total_cost="{ row }">
            <span class="font-medium tabular-nums text-rv-fg">{{ money(row.total_cost) }}</span>
          </template>
          <template #cell-requests="{ row }"><span class="tabular-nums">{{ number(row.requests) }}</span></template>
          <template #cell-total_tokens="{ row }"><span class="tabular-nums">{{ tokenYi(row.total_tokens) }}</span></template>
          <template #cell-last_at="{ row }"><span class="text-xs text-gray-500 dark:text-gray-400">{{ dateTime(row.last_at) }}</span></template>
        </DataTable>
      </section>

      <div class="flex flex-wrap justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{{ t('admin.balanceBilling.scope') }}</span>
        <span v-if="report">{{ t('admin.balanceBilling.updatedAt', { time: dateTime(report.generated_at) }) }}</span>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onClickOutside } from '@vueuse/core'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  type ChartOptions
} from 'chart.js'
import { Bar, Line } from 'vue-chartjs'
import AppLayout from '@/components/layout/AppLayout.vue'
import DataTable from '@/components/common/DataTable.vue'
import Icon from '@/components/icons/Icon.vue'
import type { Column } from '@/components/common/types'
import { getBalanceBillingReport, type BalanceBillingModelUserRow, type BalanceBillingReport } from '@/api/admin/usage'
import { useDarkMode } from '@/composables/useDarkMode'
import { businessDate, businessDateRange } from '@/utils/businessCalendar'
import { formatBusinessDateTime } from '@/utils/format'
import {
  CHART_FONT_FAMILY,
  applyChartDefaults,
  chartAxis,
  chartChrome,
  chartDateAxis,
  chartTooltip,
  seriesColor,
  seriesColors,
  withAlpha
} from '@/utils/chartTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)
applyChartDefaults()
const isDark = useDarkMode()

const { t, locale } = useI18n()
type RangePresetId = 'today' | 'yesterday' | 'twoDays' | '7d' | '14d' | '30d' | 'thisMonth' | 'lastMonth' | 'custom'
type PresetId = Exclude<RangePresetId, 'custom'>
const initialRange = businessDateRange('today')
const loading = ref(true)
const error = ref(false)
const report = ref<BalanceBillingReport | null>(null)
const rangePickerRef = ref<HTMLElement | null>(null)
const rangeOpen = ref(false)
const rangeError = ref('')
const activeRange = ref<RangePresetId>('today')
const draftRange = ref<RangePresetId>('today')
const startDate = ref(initialRange.start)
const endDate = ref(initialRange.end)
const draftStartDate = ref(initialRange.start)
const draftEndDate = ref(initialRange.end)
let controller: AbortController | undefined
let requestSequence = 0

const rangePresets = computed<{ id: PresetId; label: string }[]>(() => [
  { id: 'today', label: t('admin.balanceBilling.rangeToday') },
  { id: 'yesterday', label: t('admin.balanceBilling.rangeYesterday') },
  { id: 'twoDays', label: t('admin.balanceBilling.rangeTwoDays') },
  { id: '7d', label: t('admin.balanceBilling.range7d') },
  { id: '14d', label: t('admin.balanceBilling.range14d') },
  { id: '30d', label: t('admin.balanceBilling.range30d') },
  { id: 'thisMonth', label: t('admin.balanceBilling.rangeThisMonth') },
  { id: 'lastMonth', label: t('admin.balanceBilling.rangeLastMonth') }
])
const rangeLabel = computed(() => {
  if (activeRange.value === 'custom') return `${startDate.value} – ${endDate.value}`
  return rangePresets.value.find((preset) => preset.id === activeRange.value)?.label || t('admin.balanceBilling.rangeCustom')
})
const effectiveStartDate = computed(() => report.value?.start_date || startDate.value)
const effectiveEndDate = computed(() => report.value?.end_date || endDate.value)
const reportRangeDetail = computed(() => effectiveStartDate.value === effectiveEndDate.value
  ? effectiveStartDate.value
  : `${effectiveStartDate.value} – ${effectiveEndDate.value}`)
const isSingleDayRange = computed(() => effectiveStartDate.value === effectiveEndDate.value)
const singleDayKind = computed<'today' | 'yesterday' | 'other'>(() => {
  if (!isSingleDayRange.value) return 'other'
  const now = new Date()
  if (effectiveStartDate.value === businessDate(now)) return 'today'
  if (effectiveStartDate.value === businessDateRange('yesterday', now).start) return 'yesterday'
  return 'other'
})
const rangeTotalLabel = computed(() => {
  if (singleDayKind.value === 'today') return t('admin.balanceBilling.todayDeduction')
  if (singleDayKind.value === 'yesterday') return t('admin.balanceBilling.yesterdayDeduction')
  return t('admin.balanceBilling.periodDeduction')
})
const singleDayReportTitle = computed(() => {
  if (singleDayKind.value === 'today') return t('admin.balanceBilling.todayReport')
  if (singleDayKind.value === 'yesterday') return t('admin.balanceBilling.yesterdayReport')
  return t('admin.balanceBilling.singleDayReport')
})
const tokenCardLabel = computed(() => {
  if (singleDayKind.value === 'today') return t('admin.balanceBilling.todayTokens')
  if (singleDayKind.value === 'yesterday') return t('admin.balanceBilling.yesterdayTokens')
  return t('admin.balanceBilling.totalTokens')
})
onClickOutside(rangePickerRef, () => { rangeOpen.value = false })

const number = (value: number) => value.toLocaleString(locale.value)
const money = (value: number, compact = false) => new Intl.NumberFormat(locale.value, {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: compact ? 2 : 8
}).format(value)
const tokenYi = (value: number) => `${new Intl.NumberFormat(locale.value, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(value / 100_000_000)} 亿`
const dateTime = (value: string) => formatBusinessDateTime(value, undefined, locale.value)
const hasDailyData = computed(() => !!report.value?.daily.some((point) => point.total_cost > 0))
const hasHourlyData = computed(() => !!report.value?.hourly.some((point) => point.total_cost > 0))
const hasModelData = computed(() => !!report.value?.models.some((point) => point.total_tokens > 0))

const summaryCards = computed(() => {
  const data = report.value
  return [
    {
      key: 'range-total',
      label: rangeTotalLabel.value,
      value: data ? money(data.period_total, true) : '—',
      exact: data ? money(data.period_total) : '',
      detail: reportRangeDetail.value,
      accent: 'text-primary-600 dark:text-primary-400'
    },
    {
      key: 'range-requests',
      label: t('admin.balanceBilling.requests'),
      value: data ? number(data.period_requests) : '—',
      exact: data ? number(data.period_requests) : '',
      detail: reportRangeDetail.value,
      accent: 'text-gray-900 dark:text-white'
    },
    {
      key: 'range-users',
      label: t('admin.balanceBilling.periodUsers'),
      value: data ? number(data.period_users) : '—',
      exact: data ? number(data.period_users) : '',
      detail: t('admin.balanceBilling.periodRequests', { requests: data?.period_requests ?? 0 }),
      accent: 'text-gray-900 dark:text-white'
    },
    {
      key: 'range-tokens',
      label: tokenCardLabel.value,
      value: data ? tokenYi(data.period_tokens) : '—',
      exact: data ? tokenYi(data.period_tokens) : '',
      detail: data ? t('admin.balanceBilling.tokenBreakdown', {
        input: tokenYi(data.period_input_tokens),
        output: tokenYi(data.period_output_tokens),
        cache: tokenYi(data.period_cache_tokens)
      }) : '',
      accent: 'text-violet-600 dark:text-violet-400'
    }
  ]
})

const dailyColumns = computed<Column[]>(() => [
  { key: 'date', label: t('admin.balanceBilling.date') },
  { key: 'total_cost', label: t('admin.balanceBilling.deduction'), class: 'text-right' },
  { key: 'requests', label: t('admin.balanceBilling.requests'), class: 'text-right' },
  { key: 'users', label: t('admin.balanceBilling.users'), class: 'text-right' },
  { key: 'total_tokens', label: t('admin.balanceBilling.tokens'), class: 'text-right' }
])
const userColumns = computed<Column[]>(() => [
  { key: 'user', label: t('admin.balanceBilling.user') },
  { key: 'total_cost', label: t('admin.balanceBilling.deduction'), class: 'text-right' },
  { key: 'requests', label: t('admin.balanceBilling.requests'), class: 'text-right' },
  { key: 'total_tokens', label: t('admin.balanceBilling.tokens'), class: 'text-right' },
  { key: 'last_at', label: t('admin.balanceBilling.lastRequest') }
])
const todayColumns = computed<Column[]>(() => userColumns.value)
const modelColumns = computed<Column[]>(() => [
  { key: 'model', label: t('admin.balanceBilling.model') },
  { key: 'total_cost', label: t('admin.balanceBilling.deduction'), class: 'text-right' },
  { key: 'requests', label: t('admin.balanceBilling.requests'), class: 'text-right' },
  { key: 'users', label: t('admin.balanceBilling.users'), class: 'text-right' },
  { key: 'input_tokens', label: t('admin.balanceBilling.inputTokens'), class: 'text-right' },
  { key: 'output_tokens', label: t('admin.balanceBilling.outputTokens'), class: 'text-right' },
  { key: 'cache_tokens', label: t('admin.balanceBilling.cacheTokens'), class: 'text-right' },
  { key: 'total_tokens', label: t('admin.balanceBilling.tokens'), class: 'text-right' }
])
const modelUserColumns = computed<Column[]>(() => [
  { key: 'model', label: t('admin.balanceBilling.model') },
  { key: 'user', label: t('admin.balanceBilling.user') },
  { key: 'total_cost', label: t('admin.balanceBilling.deduction'), class: 'text-right' },
  { key: 'requests', label: t('admin.balanceBilling.requests'), class: 'text-right' },
  { key: 'total_tokens', label: t('admin.balanceBilling.tokens'), class: 'text-right' },
  { key: 'last_at', label: t('admin.balanceBilling.lastRequest') }
])
const modelUserKey = (row: BalanceBillingModelUserRow) => `${row.model}:${row.user_id}`

const dailyChartData = computed(() => {
  const color = seriesColor(0, isDark.value)
  return {
    labels: (report.value?.daily ?? []).map((point) => point.date),
    datasets: [{
      label: t('admin.balanceBilling.deduction'),
      data: (report.value?.daily ?? []).map((point) => point.total_cost),
      borderColor: color,
      backgroundColor: withAlpha(color, 0.12),
      pointBackgroundColor: color,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: true,
      tension: 0.25
    }]
  }
})
const hourlyChartData = computed(() => {
  const color = seriesColor(0, isDark.value)
  return {
    labels: (report.value?.hourly ?? []).map((point) => `${String(point.hour).padStart(2, '0')}:00`),
    datasets: [{
      label: t('admin.balanceBilling.deduction'),
      data: (report.value?.hourly ?? []).map((point) => point.total_cost),
      backgroundColor: color,
      borderRadius: 4,
      borderSkipped: 'start' as const,
      maxBarThickness: 28,
      categoryPercentage: 0.82
    }]
  }
})
const modelChartData = computed(() => {
  const models = report.value?.models ?? []
  const top = models.slice(0, 7)
  const rest = models.slice(7)
  const rows = top.map((point) => ({ label: point.model, value: point.total_tokens / 100_000_000 }))
  const otherTokens = rest.reduce((sum, point) => sum + point.total_tokens, 0)
  if (otherTokens > 0) rows.push({ label: t('admin.ops.other'), value: otherTokens / 100_000_000 })
  const colors = seriesColors(rows.length, isDark.value)
  if (otherTokens > 0 && rows.length) colors[rows.length - 1] = seriesColor(8, isDark.value)
  return {
    labels: rows.map((row) => row.label),
    datasets: [{
      label: t('admin.balanceBilling.tokens'),
      data: rows.map((row) => row.value),
      backgroundColor: colors,
      borderColor: chartChrome(isDark.value).surface,
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: 'start' as const,
      maxBarThickness: 22
    }]
  }
})

function cartesianOptions(dark: boolean) {
  const chrome = chartChrome(dark)
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...chartTooltip(dark),
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${money(Number(context.raw), true)}`
        }
      }
    },
    scales: {
      x: chartAxis(dark, {
        grid: { display: false },
        ticks: {
          color: chrome.muted,
          padding: 8,
          font: { family: CHART_FONT_FAMILY, size: 11 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12
        }
      }),
      y: chartAxis(dark, {
        beginAtZero: true,
        ticks: {
          color: chrome.muted,
          padding: 8,
          font: { family: CHART_FONT_FAMILY, size: 11 },
          callback: (value: string | number) => money(Number(value), true)
        }
      })
    }
  }
}
const lineOptions = computed<ChartOptions<'line'>>(() => ({
  ...cartesianOptions(isDark.value),
  scales: {
    ...cartesianOptions(isDark.value).scales,
    x: chartDateAxis(isDark.value)
  }
}) as ChartOptions<'line'>)
const barOptions = computed<ChartOptions<'bar'>>(() => cartesianOptions(isDark.value) as ChartOptions<'bar'>)
const modelChartOptions = computed<ChartOptions<'bar'>>(() => {
  const dark = isDark.value
  const chrome = chartChrome(dark)
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...chartTooltip(dark),
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${Number(context.raw).toFixed(2)} 亿`
        }
      }
    },
    scales: {
      x: chartAxis(dark, {
        beginAtZero: true,
        ticks: {
          color: chrome.muted,
          padding: 8,
          font: { family: CHART_FONT_FAMILY, size: 11 },
          callback: (value: string | number) => `${Number(value).toFixed(2)} 亿`
        }
      }),
      y: chartAxis(dark, {
        grid: { display: false },
        ticks: {
          color: chrome.text,
          padding: 8,
          font: { family: CHART_FONT_FAMILY, size: 11 }
        }
      })
    }
  }
})

async function loadReport(forceRefresh = false) {
  const sequence = ++requestSequence
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = false
  try {
    const data = await getBalanceBillingReport({
      start_date: startDate.value,
      end_date: endDate.value,
      nocache: forceRefresh || undefined
    }, { signal: controller.signal })
    if (sequence !== requestSequence) return
    report.value = data
  } catch {
    if (sequence === requestSequence) error.value = true
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function toggleRangePicker() {
  if (!rangeOpen.value) {
    draftRange.value = activeRange.value
    draftStartDate.value = startDate.value
    draftEndDate.value = endDate.value
    rangeError.value = ''
  }
  rangeOpen.value = !rangeOpen.value
}

function chooseRangePreset(id: PresetId) {
  const range = businessDateRange(id)
  draftRange.value = id
  draftStartDate.value = range.start
  draftEndDate.value = range.end
  rangeError.value = ''
}

function markCustomRange() {
  draftRange.value = 'custom'
  rangeError.value = ''
}

function applyRange() {
  if (!draftStartDate.value || !draftEndDate.value) {
    rangeError.value = t('admin.balanceBilling.invalidRange')
    return
  }
  if (draftStartDate.value > draftEndDate.value) {
    rangeError.value = t('admin.balanceBilling.invalidRange')
    return
  }
  startDate.value = draftStartDate.value
  endDate.value = draftEndDate.value
  activeRange.value = draftRange.value
  report.value = null
  rangeOpen.value = false
  void loadReport(false)
}

onMounted(() => {
  void loadReport(false)
})
onBeforeUnmount(() => {
  requestSequence++
  controller?.abort()
})
</script>
