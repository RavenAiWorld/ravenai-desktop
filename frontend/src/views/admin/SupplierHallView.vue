<template>
  <AppLayout hide-heading>
    <section class="min-w-0 space-y-5" :aria-busy="loading" data-testid="supplier-hall">
      <header class="hall-page-head">
        <div class="min-w-0">
          <h1 class="break-words text-[25px] font-semibold leading-tight text-gray-950 dark:text-gray-100">{{ t('admin.supplierHall.title') }}</h1>
          <p class="hall-source">
            <span class="hall-source-dot" :data-state="hall && !catalogStale ? 'fresh' : 'waiting'" aria-hidden="true" />
            <strong>AIHub</strong>
            <span v-if="hall">{{ t('admin.supplierHall.updated', { time: updatedAt }) }}</span>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div role="group" :aria-label="t('admin.supplierHall.range')" class="inline-flex rounded border border-gray-200 p-0.5 dark:border-dark-700">
            <button v-for="item in ranges" :key="item" type="button" :aria-pressed="range === item" class="h-8 min-w-12 rounded-sm px-2 text-xs font-medium" :class="range === item ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700'" @click="range = item">{{ item }}</button>
          </div>
          <button type="button" class="btn btn-secondary h-9 w-9 !p-0" :aria-label="t('admin.supplierHall.refresh')" :title="t('admin.supplierHall.refresh')" :disabled="loading" @click="load()"><Icon name="refresh" size="sm" :class="{ 'animate-spin': loading }" /></button>
        </div>
      </header>

      <div class="hall-platforms">
        <div class="mb-2 flex items-center justify-between gap-2 px-px">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-200" id="hall-platform-label">{{ t('admin.modelHealth.channelPlatform') }}</span>
          <button type="button" class="inline-flex min-h-8 shrink-0 items-center gap-1 rounded px-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500" :class="!platform ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700'" :aria-pressed="!platform" @click="platform = ''">
            <Icon name="grid" size="xs" aria-hidden="true" />{{ t('admin.supplierHall.allPlatforms') }}
          </button>
        </div>
        <div class="hall-platform-list" :style="{ '--hall-tab-cols': Math.max(1, Math.min(7, platforms.length)) }" role="group" aria-labelledby="hall-platform-label">
          <button v-for="item in platforms" :key="item.id" type="button" class="hall-platform-card" :aria-pressed="platform === item.id" :data-testid="`hall-platform-${item.id}`" @click="platform = item.id">
            <span class="flex min-w-0 items-center gap-2">
              <span class="hall-platform-logo" aria-hidden="true"><ModelIcon :model="item.icon" size="19px" /></span>
              <span class="min-w-0 break-words text-sm font-semibold leading-tight">{{ item.label }}</span>
            </span>
            <span class="hall-platform-health" :data-state="item.state" :title="item.hint">
              <Icon :name="platformIcons[item.state]" size="sm" aria-hidden="true" />
              <strong v-if="item.confirmed != null" class="tabular-nums">{{ item.confirmed }}</strong>
              {{ t('admin.supplierHall.' + platformLabels[item.state]) }}
            </span>
          </button>
        </div>
      </div>
      <div class="hall-filters" :aria-label="t('admin.supplierHall.filter')" role="group">
        <label class="hall-search">
          <span class="sr-only">{{ t('admin.supplierHall.search') }}</span>
          <Icon name="search" size="sm" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <input v-model.trim="search" type="search" class="input h-10 w-full !pl-9" :placeholder="t('admin.supplierHall.searchPlaceholder')" />
        </label>
        <Select :model-value="model" :options="modelOptions" searchable :aria-label="t('admin.supplierHall.models')" @update:model-value="model = String($event ?? '')" />
        <label class="min-w-0">
          <span class="sr-only">{{ t('admin.supplierHall.connection') }}</span>
          <select v-model="filterConnection" class="input h-10 w-full">
            <option value="">{{ t('admin.supplierHall.allConnections') }}</option>
            <option value="yes">{{ t('admin.supplierHall.connected') }}</option>
            <option value="no">{{ t('admin.supplierHall.unconnected') }}</option>
          </select>
        </label>
        <label class="min-w-0">
          <span class="sr-only">{{ t('admin.supplierHall.visibility') }}</span>
          <select v-model="filterVisibility" class="input h-10 w-full">
            <option value="">{{ t('admin.supplierHall.excludeBlocked') }}</option>
            <option value="all">{{ t('admin.supplierHall.allVisibility') }}</option>
            <option value="shown">{{ t('admin.supplierHall.upstreamShown') }}</option>
            <option value="hidden">{{ t('admin.supplierHall.upstreamHidden') }}</option>
            <option value="favorite">{{ t('admin.supplierHall.favorites') }}</option>
            <option value="blocked">{{ t('admin.supplierHall.blocked') }}</option>
          </select>
        </label>
        <button type="button" class="hall-numeric-toggle btn btn-secondary min-h-10 gap-1.5 text-sm" :aria-expanded="numericOpen" aria-controls="hall-metric-filters" @click="numericOpen = !numericOpen">
          <Icon name="filter" size="sm" aria-hidden="true" />{{ t('admin.supplierHall.numericFilters') }}
          <strong v-if="metricFilters.length" class="tabular-nums">{{ metricFilters.length }}</strong>
        </button>
      </div>

      <div v-if="numericOpen || metricFilters.length" id="hall-metric-filters" class="space-y-3">
        <form v-if="numericOpen" class="hall-metric-form" @submit.prevent="addMetricFilter">
          <label>
            <span>{{ t('admin.supplierHall.filterMode') }}</span>
            <select v-model="filterMode" class="input h-10 w-full">
              <option value="exclude">{{ t('admin.supplierHall.excludeMatches') }}</option>
              <option value="keep">{{ t('admin.supplierHall.keepMatches') }}</option>
            </select>
          </label>
          <label>
            <span>{{ t('admin.supplierHall.filterMetric') }}</span>
            <select v-model="filterMetric" class="input h-10 w-full">
              <option v-for="key in supplierMetrics" :key="key" :value="key">{{ filterMetricLabel(key) }}</option>
            </select>
          </label>
          <label>
            <span>{{ t('admin.supplierHall.filterComparison') }}</span>
            <select v-model="filterComparison" class="input h-10 w-full">
              <option v-for="(symbol, key) in supplierComparisons" :key="key" :value="key">{{ symbol }}</option>
            </select>
          </label>
          <label>
            <span>{{ t('admin.supplierHall.filterThreshold') }}<template v-if="filterInput.unit"> ({{ filterInput.unit }})</template></span>
            <input v-model="filterThreshold" type="number" inputmode="decimal" min="0" :max="filterInput.max" step="any" class="input h-10 w-full" required />
          </label>
          <button type="submit" class="btn btn-primary h-10 gap-1.5 text-sm" :disabled="!draftFilter">
            <Icon name="plus" size="sm" aria-hidden="true" />{{ t('admin.supplierHall.addFilter') }}
          </button>
        </form>
        <ul v-if="metricFilters.length" class="flex flex-wrap gap-2" :aria-label="t('admin.supplierHall.numericFilters')">
          <li v-for="(rule, index) in metricFilters" :key="metricFilterLabel(rule)" class="hall-metric-chip" :data-mode="rule.mode">
            <span>{{ metricFilterLabel(rule) }}</span>
            <button type="button" class="grid h-8 w-8 shrink-0 place-items-center rounded-r hover:bg-black/10" :aria-label="t('admin.supplierHall.removeFilter', { rule: metricFilterLabel(rule) })" :title="t('common.remove')" @click="metricFilters = metricFilters.filter((_, i) => i !== index)">
              <Icon name="x" size="sm" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </div>

      <p v-if="error" class="break-words border-l-2 border-red-500 px-3 py-2 text-sm text-red-600" role="alert">{{ error }}</p>
      <p v-else-if="hall && (catalogStale || hall.stale)" class="border-l-2 border-amber-500 px-3 py-2 text-xs text-amber-700 dark:text-amber-300" role="status">{{ t(catalogStale ? 'admin.supplierHall.catalogStale' : 'admin.supplierHall.metricsStale') }}</p>
      <p v-if="!hall && loading" class="py-12 text-center text-sm text-gray-500" role="status">{{ t('admin.supplierHall.loading') }}</p>

      <template v-if="hall">
        <div class="hall-list-head">
          <span class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm" data-testid="supplier-count" aria-live="polite">
            <strong class="font-semibold text-gray-900 dark:text-gray-100">{{ t('admin.supplierHall.result', { count: sorted.length }) }}</strong>
            <span v-if="sorted.length !== hall.total" class="text-xs text-gray-600 dark:text-gray-400">{{ t('admin.supplierHall.total', { count: hall.total }) }}</span>
            <button v-if="hasFilters && sorted.length" type="button" class="text-xs font-medium text-primary-700 hover:underline dark:text-primary-300" @click="resetFilters">{{ t('admin.supplierHall.resetFilters') }}</button>
          </span>
          <div class="flex min-w-0 items-center gap-1.5">
            <select :value="sortKey" class="input h-9 min-w-0 py-1 text-sm" :aria-label="t('admin.supplierHall.order')" @change="setSort(($event.target as HTMLSelectElement).value as SupplierMetric, false)">
              <option v-for="key in supplierMetrics" :key="key" :value="key" :title="key === 'rank' ? t('admin.supplierHall.rankTitle') : undefined">{{ metricLabel(key) }}</option>
            </select>
            <button type="button" class="btn btn-secondary h-9 w-9 shrink-0 !p-0" :aria-label="t(ascending ? 'admin.supplierHall.ascending' : 'admin.supplierHall.descending')" :title="t(ascending ? 'admin.supplierHall.ascending' : 'admin.supplierHall.descending')" @click="ascending = !ascending"><Icon :name="ascending ? 'arrowUp' : 'arrowDown'" size="sm" /></button>
          </div>
        </div>
        <div v-if="rows.length" class="hall-board provider-board" :aria-label="t('admin.supplierHall.title')">
          <div class="hall-head board-head">
            <span>{{ t('admin.supplierHall.supplier') }}</span>
            <button type="button" :title="metricLabel('rate')" @click="setSort('rate', true)">{{ t('admin.supplierHall.rate') }}<Icon v-if="sortKey === 'rate'" :name="ascending ? 'arrowUp' : 'arrowDown'" size="xs" aria-hidden="true" /></button>
            <button type="button" :title="metricLabel('cost')" @click="setSort('cost', true)">{{ t('admin.modelHealth.hallPrice') }}<Icon v-if="sortKey === 'cost'" :name="ascending ? 'arrowUp' : 'arrowDown'" size="xs" aria-hidden="true" /></button>
            <span>{{ t('admin.modelHealth.hallStatus') }}</span>
            <button type="button" :title="metricLabel('firstToken')" @click="setSort('firstToken', true)">{{ t(model ? 'admin.supplierHall.modelAverage' : 'admin.modelHealth.hallAverage') }}<Icon v-if="sortKey === 'firstToken'" :name="ascending ? 'arrowUp' : 'arrowDown'" size="xs" aria-hidden="true" /></button>
            <span>{{ t('admin.supplierHall.modelDetection') }}</span><span>{{ t('admin.supplierHall.image') }}</span><span class="text-right">{{ t('admin.supplierHall.actions') }}</span>
          </div>
          <SupplierHallRow
            v-for="item in rows"
            :key="item.group_id"
            :item="item"
            :now="now"
            :range="range"
            :trend-range="trendRange"
            :model="model"
            :catalog-stale="catalogStale"
            :metrics-stale="metricsStale"
            :connected="connected(item)"
            :pending="!!hall.pending?.includes(item.group_id)"
            :expanded="detailId === item.group_id"
            :favorite="favorites.includes(item.group_id)"
            :blocked="blocked.includes(item.group_id)"
            :trend="trends[String(item.group_id)]"
            :trend-label="trendLabel"
            @expand="detailId = detailId === item.group_id ? null : item.group_id"
            @reviews="review = { id: item.group_id, code: item.code }"
            @detection="detectionId = item.group_id"
            @connect="connectTarget = item"
            @favorite="togglePreference('favorites', item.group_id)"
            @block="togglePreference('blocked', item.group_id)"
          >
            <SupplierHallDetail :item="item" :model="model" :range="range" :trend-range="trendRange" :now="now" :metrics-stale="metricsStale" />
          </SupplierHallRow>
        </div>
        <div v-else class="hall-empty">
          <Icon name="search" size="lg" class="text-gray-400 dark:text-gray-500" aria-hidden="true" />
          <p>{{ t('admin.supplierHall.empty') }}</p>
          <button v-if="hasFilters" type="button" class="btn btn-secondary text-xs" @click="resetFilters">{{ t('admin.supplierHall.resetFilters') }}</button>
        </div>
        <Pagination v-if="sorted.length" v-model:page="page" v-model:page-size="pageSize" :page-size-options="[10, 20, 50]" :total="sorted.length" />
      </template>

      <BaseDialog :show="!!detection" :title="detection ? `${detectionItem?.code} · ${t('admin.supplierHall.modelDetection')}` : ''" width="wide" @close="detectionId = null">
        <div v-if="detection && detectionItem" class="space-y-4 break-words text-sm [overflow-wrap:anywhere]">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="font-semibold">{{ detectionTitle || detection.model || t('admin.supplierHall.modelDetection') }}</h3>
            <p v-if="detection.detected_at" class="text-xs text-gray-500 dark:text-gray-400">{{ date(detection.detected_at) }}</p>
          </div>
          <ModelHealthDetectionImage v-if="detection.has_image || detection.has_preview" :supplier-id="detectionItem.group_id" :source="detection.detected_at || ''" :preview="!detection.has_image" :title="detectionTitle || t('admin.supplierHall.modelDetection')" class="hall-detection-image" />
          <dl v-if="detection.model || detection.question || detection.answer" class="hall-detection-facts">
            <div v-if="detection.model"><dt>{{ t('admin.supplierHall.models') }}</dt><dd>{{ detection.model }}</dd></div>
            <div v-if="detection.question"><dt>{{ t('admin.supplierHall.detectionQuestion') }}</dt><dd>{{ detection.question }}</dd></div>
            <div v-if="detection.answer"><dt>{{ t('admin.supplierHall.detectionAnswer') }}</dt><dd>{{ detection.answer }}</dd></div>
          </dl>
        </div>
      </BaseDialog>
      <SupplierReviewsDialog :provider="review" @close="review = null" />
      <SupplierConnectDialog :provider="connectTarget" :model="model" @close="connectTarget = null" @connected="handleConnected" />
    </section>
  </AppLayout>
</template>

<script setup lang="ts">
import { desktopStorage as localStorage } from '@/desktop/storage'

import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import ModelIcon from '@/components/common/ModelIcon.vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Pagination from '@/components/common/Pagination.vue'
import Select from '@/components/common/Select.vue'
import Icon from '@/components/icons/Icon.vue'
import ModelHealthDetectionImage from '@/components/admin/ModelHealthDetectionImage.vue'
import SupplierConnectDialog from '@/components/admin/SupplierConnectDialog.vue'
import SupplierReviewsDialog from '@/components/admin/SupplierReviewsDialog.vue'
import '@/components/admin/providerBoard.css'
import SupplierHallRow from '@/components/admin/SupplierHallRow.vue'
import SupplierHallDetail from '@/components/admin/SupplierHallDetail.vue'
import { getSupplierHall, getSupplierSeries, supplierErrorText, type SupplierConnection, type SupplierHall, type SupplierHallItem, type SupplierSummaryRange, type SupplierTrend } from '@/api/admin/supplierHall'
import { compareSupplierMetric, matchesSupplierMetricFilter, supplierHallVisible, supplierPlatformCounts, supplierComparisons, supplierMetric, supplierMetricInput, supplierMetrics, supplierPlatformLabels, type SupplierMetric, type SupplierMetricFilter } from '@/utils/supplierHall'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

const { t, locale } = useI18n()
const app = useAppStore()
const auth = useAuthStore()
const ranges = ['1h', '6h', '24h', '7d'] as const
const featuredPlatforms = [
  { id: 'openai', label: 'OpenAI', icon: 'gpt' },
  { id: 'deepseek', label: 'DeepSeek', icon: 'deepseek' },
  { id: 'zhipu', label: 'Zhipu GLM', icon: 'glm' },
  { id: 'kimi', label: 'Kimi', icon: 'kimi' },
  { id: 'anthropic', label: 'Claude / Anthropic', icon: 'claude' },
  { id: 'grok', label: 'Grok', icon: 'grok' },
  { id: 'gemini', label: 'Gemini', icon: 'gemini' },
] as const
const range = ref<SupplierSummaryRange>('1h')
const hall = shallowRef<SupplierHall | null>(null)
const error = ref('')
const loading = ref(false)
const platform = ref('')
const model = ref('')
const search = ref('')
const filterConnection = ref('')
const filterVisibility = ref('shown')
const numericOpen = ref(false)
const filterMode = ref<SupplierMetricFilter['mode']>('exclude')
const filterMetric = ref<SupplierMetric>('success')
const filterComparison = ref<SupplierMetricFilter['comparison']>('lt')
const filterThreshold = ref<number | ''>('')
const metricFilters = ref<SupplierMetricFilter[]>([])
const filterInput = computed(() => supplierMetricInput(filterMetric.value))
const draftFilter = computed<SupplierMetricFilter | undefined>(() => {
  const threshold = filterThreshold.value
  const max = filterInput.value.max
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || (max !== undefined && threshold > max)) return
  const rule = { metric: filterMetric.value, comparison: filterComparison.value, threshold, mode: filterMode.value }
  if (!metricFilters.value.some(item => item.metric === rule.metric && item.comparison === rule.comparison && item.threshold === rule.threshold && item.mode === rule.mode)) return rule
})
const hasFilters = computed(() => Boolean(search.value || platform.value || model.value || filterConnection.value || filterVisibility.value !== 'shown' || metricFilters.value.length))
const sortKey = ref<SupplierMetric>('rank')
const ascending = ref(true)
const page = ref(1)
const pageSize = ref(20)
const now = ref(Date.now())
const detailId = ref<number | null>(null)
const detectionId = ref<number | null>(null)
const connectTarget = shallowRef<SupplierHallItem | null>(null)
const review = ref<{ id: number; code: string } | null>(null)
const trends = shallowRef<Record<string, SupplierTrend>>({})
const trendLabel = ref('')
const favorites = ref<number[]>([])
const blocked = ref<number[]>([])
let controller: AbortController | undefined
let trendController: AbortController | undefined
let trendTimer: ReturnType<typeof setTimeout> | undefined
let timer: ReturnType<typeof setInterval> | undefined
let clock: ReturnType<typeof setInterval> | undefined

const preferencesKey = computed(() => `supplier-hall-preferences:${auth.user?.id ?? 'guest'}`)
watch(preferencesKey, key => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    const ids = (value: unknown) => Array.isArray(value) ? value.filter((id): id is number => Number.isSafeInteger(id) && id > 0) : []
    favorites.value = ids(saved?.favorites)
    blocked.value = ids(saved?.blocked)
  } catch {
    favorites.value = blocked.value = []
  }
}, { immediate: true })

function togglePreference(key: 'favorites' | 'blocked', id: number) {
  const target = key === 'favorites' ? favorites : blocked
  target.value = target.value.includes(id) ? target.value.filter(value => value !== id) : [...target.value, id]
  try { localStorage.setItem(preferencesKey.value, JSON.stringify({ favorites: favorites.value, blocked: blocked.value })) } catch { /* Keep in-session preferences available. */ }
}

function addMetricFilter() {
  if (!draftFilter.value) return
  metricFilters.value = [...metricFilters.value, draftFilter.value]
  filterThreshold.value = ''
}

const catalogStale = computed(() => {
  if (!hall.value || hall.value.catalog_stale || error.value) return true
  const fetched = Date.parse(hall.value.catalog_at)
  return !Number.isFinite(fetched) || now.value - fetched > 90_000
})
const platformIcons = { available: 'checkCircle', unavailable: 'xCircle', pending: 'clock', empty: 'grid', stale: 'clock', offline: 'exclamationTriangle', loading: 'refresh' } as const
const platformLabels = { available: 'available', unavailable: 'available', pending: 'unknown', empty: 'noVisibleGroups', stale: 'catalogExpired', offline: 'feedOffline', loading: 'loading' } as const
const publishedPlatforms = computed(() => hall.value?.platform_tabs ? new Set(hall.value.platform_tabs) : null)
const published = (id: string) => !publishedPlatforms.value || publishedPlatforms.value.has(id)
const platforms = computed(() => {
  const items = hall.value?.items ?? []
  const counts = supplierPlatformCounts(items.filter(item => published(item.platform)), new Set(blocked.value), now.value)
  const featuredIDs = new Set<string>(featuredPlatforms.map(item => item.id))
  const otherIDs = [...new Set(items.map(item => item.platform))].filter(id => !featuredIDs.has(id)).sort()
  const choices = [...featuredPlatforms, ...otherIDs.map(id => ({ id, label: platformName(id), icon: id }))]
  return choices.filter(item => published(item.id) || filterVisibility.value !== 'shown' && items.some(row => row.platform === item.id)).map(item => {
    const count = counts.get(item.id)
    const state: keyof typeof platformIcons = !hall.value ? error.value ? 'offline' : 'loading' : catalogStale.value ? 'stale' :
      !count ? 'empty' : count.available > 0 ? 'available' : count.pending > 0 ? 'pending' : 'unavailable'
    const confirmed = state === 'available' || state === 'unavailable' ? count!.available : null
    const hint = count && !catalogStale.value ? t('admin.supplierHall.platformCoverage', { ...count }) : t('admin.supplierHall.' + platformLabels[state])
    return { ...item, state, confirmed, hint }
  })
})
const platformRows = computed(() => (hall.value?.items ?? []).filter(item => !platform.value || item.platform === platform.value))
const modelOptions = computed(() => [{ value: '', label: t('admin.supplierHall.allModels') }, ...[...new Set(platformRows.value.flatMap(item =>
  (item.supported_models ?? []).map(row => row.model)))].sort().map(value => ({ value, label: value }))])
const updatedAt = computed(() => date(hall.value?.catalog_at || hall.value?.generated_at))
const detectionItem = computed(() => hall.value?.items.find(item => item.group_id === detectionId.value))
const detection = computed(() => detectionItem.value?.detection)
const detectionTitle = computed(() => detection.value?.image_title?.[locale.value.startsWith('zh') ? 'zh' : 'en'])
const connected = (item: SupplierHallItem) => !!hall.value?.connected[String(item.group_id)]?.length
const metricsStale = computed(() => !!hall.value?.stale || hall.value?.range !== range.value)
const value = (item: SupplierHallItem, key: SupplierMetric) => supplierMetric(item, model.value, key, now.value, metricsStale.value)
function visibilityMatches(item: SupplierHallItem) {
  const isBlocked = blocked.value.includes(item.group_id)
  switch (filterVisibility.value) {
    case 'all': return true
    case 'shown': return !isBlocked && published(item.platform) && supplierHallVisible(item)
    case 'hidden': return !isBlocked && (!published(item.platform) || !supplierHallVisible(item))
    case 'favorite': return !isBlocked && favorites.value.includes(item.group_id)
    case 'blocked': return isBlocked
    default: return !isBlocked
  }
}
const sorted = computed(() => platformRows.value.filter(item =>
  (!search.value || `${item.code} ${item.group_id} ${item.detail ?? ''}`.toLowerCase().includes(search.value.toLowerCase())) &&
  (!model.value || item.supported_models?.some(row => row.model === model.value)) &&
  (!filterConnection.value || connected(item) === (filterConnection.value === 'yes')) &&
  visibilityMatches(item) &&
  metricFilters.value.every(rule => matchesSupplierMetricFilter(value(item, rule.metric), rule)))
  .sort((a, b) => compareSupplierMetric(value(a, sortKey.value), value(b, sortKey.value), ascending.value) || a.code.localeCompare(b.code, locale.value)))
const rows = computed(() => sorted.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const trendRange = computed(() => hall.value?.range === range.value ? hall.value.trend_range ?? range.value : range.value)
const trendQuery = computed(() => `${range.value}:${trendRange.value}:${rows.value.map(item => item.group_id).sort((a, b) => a - b).join(',')}`)

watch(platforms, list => {
  if (platform.value && !list.some(entry => entry.id === platform.value)) platform.value = ''
})
watch([platform, modelOptions], () => {
  if (!modelOptions.value.some(option => option.value === model.value)) model.value = ''
})
watch([search, platform, model, filterConnection, filterVisibility, metricFilters, sortKey, ascending, pageSize], () => { page.value = 1 })
watch(() => sorted.value.length, count => { page.value = Math.min(page.value, Math.max(1, Math.ceil(count / pageSize.value))) })
watch(rows, list => { if (!list.some(item => item.group_id === detailId.value)) detailId.value = null })
watch(range, () => { void load() })
watch(trendQuery, () => scheduleTrendLoad())
onMounted(() => {
  void load()
  clock = setInterval(() => { now.value = Date.now() }, 1000)
  timer = setInterval(() => {
    if (!connectTarget.value && !review.value && !detectionId.value && !loading.value) void load(true)
  }, 30_000)
})
onUnmounted(() => {
  controller?.abort()
  trendController?.abort()
  if (trendTimer) clearTimeout(trendTimer)
  if (timer) clearInterval(timer)
  if (clock) clearInterval(clock)
})

async function load(background = false) {
  controller?.abort()
  const current = new AbortController()
  controller = current
  if (!background) loading.value = true
  try {
    const queryBefore = trendQuery.value
    const next = await getSupplierHall(range.value, current.signal)
    if (current.signal.aborted) return
    error.value = ''
    now.value = Date.now()
    hall.value = next
    if (queryBefore === trendQuery.value) scheduleTrendLoad(true)
  } catch (cause) {
    if (!current.signal.aborted) error.value = supplierErrorText(cause) ?? t('admin.supplierHall.failed')
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}

function scheduleTrendLoad(refresh = false) {
  trendController?.abort()
  if (trendTimer) clearTimeout(trendTimer)
  if (!refresh) trends.value = {}
  trendLabel.value = ''
  if (!rows.value.length || hall.value?.range !== range.value) return
  if (!Object.keys(trends.value).length) trendLabel.value = t('admin.supplierHall.loading')
  trendTimer = setTimeout(() => { void loadTrends() }, 140)
}

async function loadTrends() {
  const current = new AbortController()
  trendController = current
  const ids = rows.value.map(item => item.group_id)
  const requests = []
  for (let offset = 0; offset < ids.length; offset += 20) {
    requests.push(getSupplierSeries(ids.slice(offset, offset + 20), trendRange.value, current.signal))
  }
  const result = await Promise.allSettled(requests)
  if (current.signal.aborted) return
  const successes = result.flatMap(item => item.status === 'fulfilled' ? [item.value] : [])
  trends.value = Object.assign({}, ...successes)
  trendLabel.value = result.some(item => item.status === 'rejected') ? t('admin.supplierHall.historyFailed') : ''
}

function handleConnected(connection: SupplierConnection) {
  connectTarget.value = null
  app.showSuccess(t('admin.supplierHall.connectDone', { id: connection.account_id }))
  void load()
}
function setSort(key: SupplierMetric, toggle: boolean) {
  ascending.value = sortKey.value === key && toggle ? !ascending.value : ['rank', 'rate', 'effective', 'cost', 'firstToken'].includes(key)
  sortKey.value = key
}
function metricLabel(key: SupplierMetric) { return t(`admin.supplierHall.${key}`) }
function filterMetricLabel(key: SupplierMetric) {
  return key === 'models' ? t('admin.supplierHall.modelNumber') : metricLabel(key)
}
function metricFilterLabel(rule: SupplierMetricFilter) {
  const mode = t(rule.mode === 'exclude' ? 'admin.supplierHall.excludeMatches' : 'admin.supplierHall.keepMatches')
  const unit = supplierMetricInput(rule.metric).unit
  return `${mode} ${filterMetricLabel(rule.metric)} ${supplierComparisons[rule.comparison]} ${rule.threshold}${unit ? ` ${unit}` : ''}`
}
function platformName(p: string) { return supplierPlatformLabels[p] || p }
function resetFilters() {
  search.value = platform.value = model.value = filterConnection.value = ''
  filterVisibility.value = 'shown'
  metricFilters.value = []
  filterThreshold.value = ''
}
function date(value?: string) {
  const timestamp = Date.parse(value ?? '')
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString(locale.value) : '\u2014'
}
</script>

<style scoped>
.hall-page-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  @apply border-b border-gray-200 dark:border-dark-700;
}
.hall-source {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 7px;
  margin-top: 7px;
  font-size: 12px;
  @apply text-gray-600 dark:text-gray-400;
}
.hall-source strong { @apply font-semibold text-gray-800 dark:text-gray-200; }
.hall-source-dot { @apply h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400; }
.hall-source-dot[data-state="fresh"] { @apply bg-emerald-500; }
.hall-platforms { container-type: inline-size; min-width: 0; }
.hall-platform-list {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(8.8rem, 44%);
  gap: 0.625rem;
  overflow-x: auto;
  padding: 2px 2px 0.5rem;
  scroll-snap-type: x proximity;
}
.hall-platform-card {
  display: grid;
  min-height: 5.625rem;
  grid-template-rows: 1fr auto;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  scroll-snap-align: start;
  @apply rounded-lg border border-gray-200 bg-white text-left text-gray-900 transition-colors hover:border-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 dark:border-dark-600 dark:bg-dark-800 dark:text-gray-100;
}
.hall-platform-card[aria-pressed="true"] {
  box-shadow: inset 0 3px 0 #0891b2;
  @apply border-cyan-600 bg-cyan-50 text-cyan-900 dark:border-cyan-500 dark:bg-cyan-950/60 dark:text-cyan-100;
}
.hall-platform-health { display: flex; min-height: 22px; align-items: center; gap: 6px; font-size: 12px; overflow-wrap: anywhere; @apply text-gray-600 dark:text-gray-400; }
.hall-platform-health > svg { flex-shrink: 0; }
.hall-platform-health strong { font-size: 19px; line-height: 1; @apply text-gray-900 dark:text-gray-100; }
.hall-platform-health[data-state="available"] > svg { @apply text-emerald-600 dark:text-emerald-400; }
.hall-platform-health[data-state="unavailable"] > svg, .hall-platform-health[data-state="offline"] > svg { @apply text-rose-700 dark:text-rose-400; }
.hall-platform-health[data-state="stale"] > svg, .hall-platform-health[data-state="pending"] > svg { @apply text-amber-700 dark:text-amber-400; }
.hall-platform-logo {
  @apply grid h-7 w-7 shrink-0 place-items-center rounded bg-gray-50 ring-1 ring-gray-900/5 dark:bg-white dark:ring-0;
}
@container (min-width: 535px) { .hall-platform-list { grid-auto-columns: minmax(8rem, 23%); } }
@container (min-width: 980px) { .hall-platform-list { grid-auto-columns: calc((100% + .625rem) / var(--hall-tab-cols, 7) - .625rem); } }
.hall-filters {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 1fr)) auto;
  gap: 8px;
  align-items: end;
  padding: 11px 0;
  @apply border-y border-gray-200 dark:border-dark-700;
}
.hall-search { position: relative; min-width: 0; }
.hall-metric-form {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, .65fr) minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
  padding: 12px 0;
  @apply border-b border-gray-200 dark:border-dark-700;
}
.hall-metric-form label { display: grid; min-width: 0; gap: 4px; @apply text-xs text-gray-700 dark:text-gray-300; }
.hall-metric-form button { justify-self: start; }
.hall-metric-chip {
  @apply inline-flex min-w-0 max-w-full items-center gap-1 rounded border border-primary-200 bg-primary-50 pl-2 text-xs text-primary-800 dark:border-primary-900 dark:bg-primary-900/30 dark:text-primary-200;
  overflow-wrap: anywhere;
}
.hall-metric-chip[data-mode="exclude"] { @apply border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200; }
.hall-list-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 8px;
  margin-bottom: -0.65rem;
}
.hall-empty {
  display: grid;
  min-height: 10rem;
  place-content: center;
  justify-items: center;
  gap: 10px;
  text-align: center;
  @apply border-y border-gray-200 text-sm text-gray-600 dark:border-dark-700 dark:text-gray-300;
}
.hall-detection-image { min-height: 9rem; max-height: 60vh; @apply rounded-md border border-gray-200 bg-gray-50 dark:border-dark-700 dark:bg-dark-800; }
.hall-detection-image :deep(img) { display: block; width: auto; max-width: 100%; max-height: 60vh; object-fit: contain; }
.hall-detection-facts > div { display: grid; grid-template-columns: minmax(70px, .25fr) minmax(0, 1fr); gap: 8px; padding: 8px 0; @apply border-b border-gray-100 dark:border-dark-700; }
.hall-detection-facts dt { @apply text-xs font-medium text-gray-600 dark:text-gray-400; }
.hall-detection-facts dd { white-space: pre-wrap; }
@media (max-width: 767px) {
  .hall-filters, .hall-metric-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hall-numeric-toggle { grid-column: 1 / -1; justify-self: start; }
}
</style>
