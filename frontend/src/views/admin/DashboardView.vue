<template>
  <AppLayout>
    <template #actions>
      <RouterLink to="/admin/usage" class="btn btn-secondary"><Icon name="chart" size="sm" />{{ t('nav.usage') }}</RouterLink>
      <RouterLink to="/admin/accounts" class="btn btn-primary"><Icon name="server" size="sm" />{{ t('nav.accounts') }}</RouterLink>
    </template>
    <div class="space-y-4">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>

      <template v-else-if="stats">
        <!-- Row 1: Core Stats -->
        <section class="stat-strip lg:grid-cols-4">
          <div class="stat-cell">
            <p class="stat-cell-label"><Icon name="key" size="sm" />{{ t('admin.dashboard.apiKeys') }}</p>
            <p class="stat-cell-value">{{ stats.total_api_keys }}</p>
            <p class="stat-cell-meta"><span class="stat-dot"></span>{{ stats.active_api_keys }} {{ t('common.active') }}</p>
          </div>
          <div class="stat-cell">
            <p class="stat-cell-label"><Icon name="server" size="sm" />{{ t('admin.dashboard.accounts') }}</p>
            <p class="stat-cell-value">{{ stats.total_accounts }}</p>
            <p class="stat-cell-meta">
              <span class="stat-dot"></span>{{ stats.normal_accounts }} {{ t('common.active') }}
              <span v-if="stats.error_accounts > 0" class="ml-2 text-red-600 dark:text-red-400"><span class="stat-dot !bg-red-500"></span>{{ stats.error_accounts }} {{ t('common.error') }}</span>
            </p>
          </div>
          <div class="stat-cell">
            <p class="stat-cell-label"><Icon name="chart" size="sm" />{{ t('admin.dashboard.todayRequests') }}</p>
            <p class="stat-cell-value">{{ formatNumber(stats.today_requests) }}</p>
            <p class="stat-cell-meta">{{ t('common.total') }}: {{ formatNumber(stats.total_requests) }}</p>
          </div>
          <div class="stat-cell">
            <p class="stat-cell-label"><Icon name="userPlus" size="sm" />{{ t('admin.dashboard.users') }}</p>
            <p class="stat-cell-value">+{{ stats.today_new_users }}</p>
            <p class="stat-cell-meta">{{ t('common.total') }}: {{ formatNumber(stats.total_users) }}</p>
          </div>
        </section>

        <!-- Row 2: Token Stats -->
        <section class="stat-strip stat-strip-secondary lg:grid-cols-4">
          <div class="stat-cell">
            <p class="stat-cell-label"><Icon name="cube" size="sm" />{{ t('admin.dashboard.todayTokens') }}</p>
            <p class="stat-cell-value">{{ formatTokens(stats.today_tokens) }}</p>
            <p class="stat-cell-meta">
              <span class="text-rv-fg-2" :title="t('admin.dashboard.actual')">${{ formatCost(stats.today_actual_cost) }}</span>
              <span class="stat-cell-sep">/</span>
              <span class="text-amber-700 dark:text-amber-400" :title="t('admin.dashboard.accountCost')">${{ formatCost(stats.today_account_cost) }}</span>
              <span class="stat-cell-sep">/</span>
              <span :title="t('admin.dashboard.standard')">${{ formatCost(stats.today_cost) }}</span>
            </p>
          </div>
          <div class="stat-cell">
            <p class="stat-cell-label"><Icon name="database" size="sm" />{{ t('admin.dashboard.totalTokens') }}</p>
            <p class="stat-cell-value">{{ formatTokens(stats.total_tokens) }}</p>
            <p class="stat-cell-meta">
              <span class="text-rv-fg-2" :title="t('admin.dashboard.actual')">${{ formatCost(stats.total_actual_cost) }}</span>
              <span class="stat-cell-sep">/</span>
              <span class="text-amber-700 dark:text-amber-400" :title="t('admin.dashboard.accountCost')">${{ formatCost(stats.total_account_cost) }}</span>
              <span class="stat-cell-sep">/</span>
              <span :title="t('admin.dashboard.standard')">${{ formatCost(stats.total_cost) }}</span>
            </p>
          </div>
          <div class="stat-cell">
            <p class="stat-cell-label"><Icon name="bolt" size="sm" />{{ t('admin.dashboard.performance') }}</p>
            <p class="stat-cell-value">{{ formatTokens(stats.rpm) }}<span class="stat-cell-unit">RPM</span></p>
            <p class="stat-cell-meta">{{ formatTokens(stats.tpm) }} TPM</p>
          </div>
          <div class="stat-cell">
            <p class="stat-cell-label"><Icon name="clock" size="sm" />{{ t('admin.dashboard.avgResponse') }}</p>
            <p class="stat-cell-value">{{ formatDuration(stats.average_duration_ms) }}</p>
            <p class="stat-cell-meta">{{ stats.active_users }} {{ t('admin.dashboard.activeUsers') }}</p>
          </div>
        </section>

        <!-- Quick Actions -->
        <div class="card">
          <div class="border-b border-rv-line px-5 py-3">
            <h2 class="text-sm font-semibold text-rv-fg">
              {{ t('admin.dashboard.quickActions') }}
            </h2>
          </div>
          <div class="grid grid-cols-1 gap-1 p-1.5 md:grid-cols-2">
            <button
              v-if="canUseBatchImage"
              type="button"
              class="admin-qa group"
              @click="router.push('/batch-image')"
            >
              <span class="admin-qa-icon"><Icon name="sparkles" size="sm" /></span>
              <span class="min-w-0 flex-1">
                <span class="block text-[13.5px] font-medium text-rv-fg">
                  {{ t('admin.dashboard.batchImage') }}
                </span>
                <span class="block truncate text-xs text-rv-fg-3">
                  {{ t('admin.dashboard.batchImageDesc') }}
                </span>
              </span>
              <Icon name="chevronRight" size="sm" class="shrink-0 text-rv-fg-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              class="admin-qa group"
              @click="router.push('/admin/groups')"
            >
              <span class="admin-qa-icon"><Icon name="grid" size="sm" /></span>
              <span class="min-w-0 flex-1">
                <span class="block text-[13.5px] font-medium text-rv-fg">
                  {{ t('admin.dashboard.groupPricing') }}
                </span>
                <span class="block truncate text-xs text-rv-fg-3">
                  {{ t('admin.dashboard.groupPricingDesc') }}
                </span>
              </span>
              <Icon name="chevronRight" size="sm" class="shrink-0 text-rv-fg-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="space-y-3">
          <!-- Filters: one row scoping every chart below -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[13px] text-rv-fg-3">{{ t('admin.dashboard.timeRange') }}</span>
            <DateRangePicker
              v-model:start-date="startDate"
              v-model:end-date="endDate"
              @change="onDateRangeChange"
            />
            <div class="w-28">
              <Select
                v-model="granularity"
                :options="granularityOptions"
                :aria-label="t('admin.dashboard.granularity')"
                @change="loadChartData"
              />
            </div>
            <button @click="loadDashboardStats" :disabled="chartsLoading" class="btn btn-ghost btn-sm">
              <Icon name="refresh" size="sm" :class="chartsLoading ? 'animate-spin' : ''" />
              {{ t('common.refresh') }}
            </button>
          </div>

          <!-- Charts Grid -->
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ModelDistributionChart
              :model-stats="modelStats"
              :enable-ranking-view="true"
              :ranking-items="rankingItems"
              :ranking-total-actual-cost="rankingTotalActualCost"
              :ranking-total-requests="rankingTotalRequests"
              :ranking-total-tokens="rankingTotalTokens"
              :loading="chartsLoading"
              :ranking-loading="rankingLoading"
              :ranking-error="rankingError"
              :start-date="startDate"
              :end-date="endDate"
              @ranking-click="goToUserUsage"
            />
            <TokenUsageTrend :trend-data="trendData" :loading="chartsLoading" />
          </div>

          <!-- User Usage Trend (Full Width) -->
          <div class="card px-5 pb-4 pt-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <h3 class="text-sm font-semibold text-rv-fg">{{ t('admin.dashboard.recentUsage') }} (Top 12)</h3>
              <div class="tabs" role="group" :aria-label="t('admin.dashboard.recentUsage')">
                <button v-for="metric in (['tokens', 'actual_cost'] as const)" :key="metric" type="button"
                  class="tab" :class="{ 'tab-active': userTrendMetric === metric }"
                  :aria-pressed="userTrendMetric === metric" @click="setUserTrendMetric(metric)">
                  {{ t(metric === 'tokens' ? 'admin.dashboard.tokens' : 'admin.dashboard.actualSpending') }}
                </button>
              </div>
            </div>
            <div class="h-64">
              <div v-if="userTrendLoading" class="flex h-full items-center justify-center">
                <LoadingSpinner size="md" />
              </div>
              <Line v-else-if="userTrendChartData" :data="userTrendChartData" :options="lineOptions" />
              <div
                v-else
                class="flex h-full items-center justify-center text-sm text-rv-fg-3"
              >
                {{ t('admin.dashboard.noDataAvailable') }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const { t } = useI18n()
import { adminAPI } from '@/api/admin'
import type {
  DashboardStats,
  TrendDataPoint,
  ModelStat,
  UserUsageTrendPoint,
  UserSpendingRankingItem
} from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Icon from '@/components/icons/Icon.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import { businessDateRange } from '@/utils/businessCalendar'
import Select from '@/components/common/Select.vue'
import ModelDistributionChart from '@/components/charts/ModelDistributionChart.vue'
import TokenUsageTrend from '@/components/charts/TokenUsageTrend.vue'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'

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
import { useDarkMode } from '@/composables/useDarkMode'
import { applyChartDefaults, chartAxis, chartDateAxis, chartChrome, chartTooltip, seriesColor, CHART_FONT_FAMILY } from '@/utils/chartTheme'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
)
applyChartDefaults()

const appStore = useAppStore()
const router = useRouter()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()
const stats = ref<DashboardStats | null>(null)
const loading = ref(false)
const chartsLoading = ref(false)
const userTrendLoading = ref(false)
const rankingLoading = ref(false)
const rankingError = ref(false)

// Chart data
const trendData = ref<TrendDataPoint[]>([])
const modelStats = ref<ModelStat[]>([])
const userTrend = ref<UserUsageTrendPoint[]>([])
const userTrendMetric = ref<'tokens' | 'actual_cost'>('tokens')
const rankingItems = ref<UserSpendingRankingItem[]>([])
const rankingTotalActualCost = ref(0)
const rankingTotalRequests = ref(0)
const rankingTotalTokens = ref(0)
let chartLoadSeq = 0
let usersTrendLoadSeq = 0
let rankingLoadSeq = 0
const rankingLimit = 12

// Date range
const granularity = ref<'day' | 'hour'>('hour')
const defaultRange = businessDateRange('twoDays')
const startDate = ref(defaultRange.start)
const endDate = ref(defaultRange.end)

// Granularity options for Select component
const granularityOptions = computed(() => [
  { value: 'day', label: t('admin.dashboard.day') },
  { value: 'hour', label: t('admin.dashboard.hour') }
])

const isDarkMode = useDarkMode()

// Line chart options (for user trend chart)
const lineOptions = computed(() => ({
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
        color: chartChrome(isDarkMode.value).text,
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 7,
        boxHeight: 7,
        padding: 14,
        font: { family: CHART_FONT_FAMILY, size: 12 }
      }
    },
    tooltip: {
      ...chartTooltip(isDarkMode.value),
      itemSort: (a: any, b: any) => {
        const aValue = typeof a?.raw === 'number' ? a.raw : Number(a?.parsed?.y ?? 0)
        const bValue = typeof b?.raw === 'number' ? b.raw : Number(b?.parsed?.y ?? 0)
        return bValue - aValue
      },
      callbacks: {
        label: (context: any) => {
          return `${context.dataset.label}: ${formatUserTrendValue(Number(context.raw))}`
        }
      }
    }
  },
  scales: {
    x: chartDateAxis(isDarkMode.value),
    y: chartAxis(isDarkMode.value, {
      beginAtZero: true,
      ticks: {
        color: chartChrome(isDarkMode.value).muted,
        padding: 8,
        font: { family: CHART_FONT_FAMILY, size: 11 },
        callback: (value: string | number) => formatUserTrendValue(Number(value))
      }
    })
  }
}))

// User trend chart data
const userTrendChartData = computed(() => {
  if (!userTrend.value?.length) return null

  const getDisplayName = (point: UserUsageTrendPoint): string => {
    const username = point.username?.trim()
    if (username) {
      return username
    }

    const email = point.email?.trim()
    if (email) {
      return email
    }

    return t('admin.redeem.userPrefix', { id: point.user_id })
  }

  // Group by user_id to avoid merging different users with the same display name
  const userGroups = new Map<number, { name: string; data: Map<string, number> }>()
  const allDates = new Set<string>()

  userTrend.value.forEach((point) => {
    allDates.add(point.date)
    const key = point.user_id
    if (!userGroups.has(key)) {
      userGroups.set(key, { name: getDisplayName(point), data: new Map() })
    }
    userGroups.get(key)!.data.set(point.date, userTrendMetric.value === 'tokens' ? point.tokens : point.actual_cost)
  })

  const sortedDates = Array.from(allDates).sort()
  // Slots follow the ranking; users past the eighth slot share the neutral "other" colour.
  const datasets = Array.from(userGroups.values()).map((group, idx) => ({
    label: group.name,
    data: sortedDates.map((date) => group.data.get(date) || 0),
    borderColor: seriesColor(idx, isDarkMode.value),
    backgroundColor: seriesColor(idx, isDarkMode.value),
    pointBackgroundColor: seriesColor(idx, isDarkMode.value),
    pointBorderColor: chartChrome(isDarkMode.value).surface,
    pointBorderWidth: 2,
    fill: false,
    tension: 0.25
  }))

  return {
    labels: sortedDates,
    datasets
  }
})

// Format helpers
const formatUserTrendValue = (value: number): string =>
  userTrendMetric.value === 'tokens' ? formatTokens(value) : `$${formatCost(value)}`

const formatTokens = (value: number | undefined): string => {
  if (value === undefined || value === null) return '0'
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toLocaleString()
}

const toFiniteNumber = (value: unknown): number => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const formatNumber = (value: number | null | undefined): string => {
  return toFiniteNumber(value).toLocaleString()
}

const formatCost = (value: number | null | undefined): string => {
  const safeValue = toFiniteNumber(value)
  if (safeValue >= 1000) {
    return (safeValue / 1000).toFixed(2) + 'K'
  } else if (safeValue >= 1) {
    return safeValue.toFixed(2)
  } else if (safeValue >= 0.01) {
    return safeValue.toFixed(3)
  }
  return safeValue.toFixed(4)
}

const formatDuration = (ms: number): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`
  }
  return `${Math.round(ms)}ms`
}

const goToUserUsage = (item: UserSpendingRankingItem) => {
  void router.push({
    path: '/admin/usage',
    query: {
      user_id: String(item.user_id),
      start_date: startDate.value,
      end_date: endDate.value
    }
  })
}

// Date range change handler
const onDateRangeChange = (range: {
  startDate: string
  endDate: string
  preset: string | null
}) => {
  // Auto-select granularity based on date range
  const start = new Date(range.startDate)
  const end = new Date(range.endDate)
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  // If range is 1 day, use hourly granularity
  if (daysDiff <= 1) {
    granularity.value = 'hour'
  } else {
    granularity.value = 'day'
  }

  loadChartData()
}

// Load data
const loadDashboardSnapshot = async (includeStats: boolean) => {
  const currentSeq = ++chartLoadSeq
  if (includeStats && !stats.value) {
    loading.value = true
  }
  chartsLoading.value = true
  try {
    const response = await adminAPI.dashboard.getSnapshotV2({
      start_date: startDate.value,
      end_date: endDate.value,
      granularity: granularity.value,
      include_stats: includeStats,
      include_trend: true,
      include_model_stats: true,
      include_group_stats: false,
      include_users_trend: false
    })
    if (currentSeq !== chartLoadSeq) return
    if (includeStats && response.stats) {
      stats.value = response.stats
    }
    trendData.value = response.trend || []
    modelStats.value = response.models || []
  } catch (error) {
    if (currentSeq !== chartLoadSeq) return
    appStore.showError(t('admin.dashboard.failedToLoad'))
    console.error('Error loading dashboard snapshot:', error)
  } finally {
    if (currentSeq === chartLoadSeq) {
      loading.value = false
      chartsLoading.value = false
    }
  }
}

const setUserTrendMetric = (metric: 'tokens' | 'actual_cost') => {
  if (userTrendMetric.value === metric) return
  userTrendMetric.value = metric
  userTrend.value = []
  loadUsersTrend()
}

const loadUsersTrend = async () => {
  const currentSeq = ++usersTrendLoadSeq
  userTrendLoading.value = true
  try {
    const response = await adminAPI.dashboard.getUserUsageTrend({
      start_date: startDate.value,
      end_date: endDate.value,
      granularity: granularity.value,
      limit: 12,
      metric: userTrendMetric.value
    })
    if (currentSeq !== usersTrendLoadSeq) return
    userTrend.value = response.trend || []
  } catch (error) {
    if (currentSeq !== usersTrendLoadSeq) return
    console.error('Error loading users trend:', error)
    userTrend.value = []
  } finally {
    if (currentSeq === usersTrendLoadSeq) {
      userTrendLoading.value = false
    }
  }
}

const loadUserSpendingRanking = async () => {
  const currentSeq = ++rankingLoadSeq
  rankingLoading.value = true
  rankingError.value = false
  try {
    const response = await adminAPI.dashboard.getUserSpendingRanking({
      start_date: startDate.value,
      end_date: endDate.value,
      limit: rankingLimit
    })
    if (currentSeq !== rankingLoadSeq) return
    rankingItems.value = response.ranking || []
    rankingTotalActualCost.value = response.total_actual_cost || 0
    rankingTotalRequests.value = response.total_requests || 0
    rankingTotalTokens.value = response.total_tokens || 0
  } catch (error) {
    if (currentSeq !== rankingLoadSeq) return
    console.error('Error loading user spending ranking:', error)
    rankingItems.value = []
    rankingTotalActualCost.value = 0
    rankingTotalRequests.value = 0
    rankingTotalTokens.value = 0
    rankingError.value = true
  } finally {
    if (currentSeq === rankingLoadSeq) {
      rankingLoading.value = false
    }
  }
}

const loadDashboardStats = async () => {
  await Promise.all([
    loadDashboardSnapshot(true),
    loadUsersTrend(),
    loadUserSpendingRanking()
  ])
}

const loadChartData = async () => {
  await Promise.all([
    loadDashboardSnapshot(false),
    loadUsersTrend(),
    loadUserSpendingRanking()
  ])
}

onMounted(() => {
  void refreshBatchImageAccess()
  loadDashboardStats()
})
</script>

<style scoped>
.admin-qa {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  text-align: left;
  transition: background-color 0.15s;
}

.admin-qa:hover {
  background: rgb(var(--rv-hover) / 0.7);
}

.admin-qa-icon {
  display: flex;
  height: 32px;
  width: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rv-line));
  border-radius: 8px;
  background: rgb(var(--rv-surface));
  color: rgb(var(--rv-fg-2));
}
</style>
