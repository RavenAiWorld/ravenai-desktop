<template>
  <article :data-provider-id="item.group_id" class="supplier-row" :class="{ 'supplier-row-open': expanded }" :aria-labelledby="nameId">
    <div class="board-summary supplier-row-grid">
      <header class="board-identity supplier-identity">
        <div class="supplier-name-line">
          <button :id="nameId" type="button" class="supplier-name" :aria-expanded="expanded" :aria-controls="expanded ? bodyId : undefined" @click="emit('expand')">
            <span>{{ item.code }}</span><Icon :name="expanded ? 'chevronUp' : 'chevronDown'" size="xs" aria-hidden="true" />
          </button>
          <ModelHealthProviderPopularity :group="item" :now="now" />
        </div>
        <div class="supplier-meta">
          <span>{{ platformLabel }} · #{{ item.group_id }}</span>
          <span v-if="connected" class="text-emerald-700 dark:text-emerald-400">{{ t('admin.supplierHall.connected') }}</span>
          <span v-if="!supplierHallVisible(item)" class="text-amber-700 dark:text-amber-400">{{ t('admin.supplierHall.upstreamHidden') }}</span>
          <span v-if="blocked" class="text-rose-700 dark:text-rose-400">{{ t('admin.supplierHall.blocked') }}</span>
        </div>
        <ProviderReputation :group="item" :name="item.code" :warning="stats?.input_warning" @reviews="emit('reviews')">
          <ModelHealthProviderWarnings v-if="item.warnings?.length" :group="item" :source="{ stale: catalogStale, error: '' }" :now="now" />
        </ProviderReputation>
        <p v-if="item.detail" class="supplier-note" :title="item.detail">{{ item.detail }}</p>
      </header>
      <div class="board-rate"><p class="board-label">{{ t('admin.supplierHall.rate') }}</p><strong class="supplier-number">{{ metric('rate') }}</strong></div>
      <div class="board-price supplier-quote">
        <p class="board-label">{{ t('admin.modelHealth.hallPrice') }}</p>
        <div class="supplier-cost" :title="t('admin.supplierHall.costTitle')"><strong class="supplier-number">{{ metric('cost') }}</strong><small v-if="value('cost') != null"> / M</small></div>
        <span class="supplier-effective" :title="t('admin.supplierHall.effective')">{{ metric('effective') }}</span>
      </div>
      <div class="board-state">
        <p class="board-label">{{ t('admin.modelHealth.hallStatus') }}</p>
        <span class="supplier-state" :data-state="availability"><i aria-hidden="true" />{{ t('admin.supplierHall.' + availability) }}</span>
        <div v-if="chips.length" class="supplier-models">
          <span v-for="chip in chips.slice(0, 3)" :key="chip.model" :data-health="chip.health" :title="chip.title"><span>{{ chip.alias }}</span><i aria-hidden="true" /></span>
          <button v-if="chips.length > 3" type="button" :aria-expanded="expanded" :aria-label="t('admin.supplierHall.modelCount', { count: chips.length })" @click="emit('expand')">+{{ chips.length - 3 }}</button>
        </div>
      </div>
      <div class="board-latency"><p class="board-label">{{ averageLabel }}</p><ProviderLatencyMeter :ms="stats?.duration_ms" :hint="averageLabel + ' · ' + (model || item.code) + ' · ' + range" /><span v-if="stats && stats.sample_count > 0" class="supplier-samples">{{ t('admin.supplierHall.sampleCount', { count: metric('samples') }) }}</span></div>
      <div class="board-detection supplier-detection">
        <p class="board-label">{{ t('admin.supplierHall.modelDetection') }}</p>
        <template v-if="hasDetection">
          <button type="button" class="supplier-detection-status" :data-state="detectionState" @click="emit('detection')"><Icon :name="detectionIcon" size="xs" aria-hidden="true" />{{ detectionLabel }}</button>
          <button v-if="detectionTitle" type="button" class="supplier-detection-title" :title="detectionTitle" @click="emit('detection')"><Icon name="eye" size="xs" aria-hidden="true" /><span>{{ detectionTitle }}</span></button>
        </template>
        <span v-else class="board-absent">{{ t('admin.supplierHall.noDetection') }}</span>
      </div>
      <div class="board-image">
        <button v-if="detection?.has_preview || detection?.has_image" type="button" class="supplier-thumbnail" :aria-label="detectionTitle || t('admin.supplierHall.image')" :title="detectionTitle" @click="emit('detection')">
          <ModelHealthDetectionImage lazy :supplier-id="item.group_id" :source="detection.detected_at ?? ''" :title="detectionTitle || t('admin.supplierHall.image')" :preview="!!detection.has_preview" />
        </button><span v-else class="board-absent" aria-hidden="true">&ndash;</span>
      </div>
      <div class="board-actions supplier-actions">
        <RouterLink v-if="connected && !pending" class="supplier-connect btn btn-secondary" :to="{ path: '/admin/model-health', query: { provider: item.code, provider_id: String(item.group_id), platform: item.platform } }"><Icon name="externalLink" size="xs" aria-hidden="true" />{{ t('admin.supplierHall.goHealth') }}</RouterLink>
        <button v-else type="button" class="supplier-connect btn btn-primary" :disabled="catalogStale || blocked || !item.supported_models?.length" :title="blocked ? t('admin.supplierHall.blocked') : undefined" @click="emit('connect')"><Icon name="link" size="xs" aria-hidden="true" />{{ t(pending ? 'admin.supplierHall.pending' : 'admin.supplierHall.connect') }}</button>
        <div class="supplier-tools">
          <button type="button" class="supplier-icon-button supplier-favorite" :aria-pressed="favorite" :aria-label="t(favorite ? 'admin.supplierHall.unfavorite' : 'admin.supplierHall.favorite')" :title="t(favorite ? 'admin.supplierHall.unfavorite' : 'admin.supplierHall.favorite')" @click="emit('favorite')"><span aria-hidden="true">{{ favorite ? filledStar : emptyStar }}</span></button>
          <button type="button" class="supplier-icon-button supplier-block" :aria-pressed="blocked" :aria-label="t(blocked ? 'admin.supplierHall.unblock' : 'admin.supplierHall.block')" :title="t(blocked ? 'admin.supplierHall.unblock' : 'admin.supplierHall.block')" @click="emit('block')"><Icon name="ban" size="sm" aria-hidden="true" /></button>
        </div>
      </div>
    </div>
    <div class="board-history">
      <ProviderIndicators :stats="stats" :range="range" :scope="(model || item.code) + ' · ' + range" />
      <div class="supplier-trend">
        <SupplierHistoryChart compact :trend="metricsStale ? undefined : trend" :period="trend?.period" :label="item.code + ' · ' + t('admin.supplierHall.responseTrend')" :empty-label="trendLabel" />
        <div class="board-legend"><span><i class="probe-line" />{{ t('admin.supplierHall.textProbe') }}</span><span><i />{{ t('admin.modelHealth.hallAverage') }}</span><span v-if="!metricsStale && hasFailures"><i class="failed-band" />{{ t('admin.supplierHall.failedProbe') }}</span><span class="board-scope">{{ t('admin.supplierHall.responseTrend') }} · {{ trendRange }}</span></div>
      </div>
    </div>
    <div v-if="expanded" :id="bodyId"><slot /></div>
  </article>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SupplierHallItem, SupplierSummaryRange, SupplierTrendRange, SupplierTrend } from '@/api/admin/supplierHall'
import Icon from '@/components/icons/Icon.vue'
import ProviderIndicators from './ProviderIndicators.vue'
import ProviderLatencyMeter from './ProviderLatencyMeter.vue'
import ProviderReputation from './ProviderReputation.vue'
import ModelHealthProviderPopularity from './ModelHealthProviderPopularity.vue'
import ModelHealthProviderWarnings from './ModelHealthProviderWarnings.vue'
import ModelHealthDetectionImage from './ModelHealthDetectionImage.vue'
import SupplierHistoryChart from './SupplierHistoryChart.vue'
import { formatSupplierMetric, supplierAvailability, supplierCardHealth, supplierHallVisible, supplierMetric, supplierPlatformLabels, supplierScopedMetrics, type SupplierMetric } from '@/utils/supplierHall'

const props = defineProps<{
  item: SupplierHallItem
  now: number
  range: SupplierSummaryRange
  trendRange: SupplierTrendRange
  model: string
  catalogStale: boolean
  metricsStale: boolean
  connected: boolean
  pending: boolean
  expanded: boolean
  favorite: boolean
  blocked: boolean
  trend?: SupplierTrend
  trendLabel?: string
}>()
const emit = defineEmits<{
  expand: []; reviews: []; detection: []; connect: []; favorite: []; block: []
}>()
const { t, locale } = useI18n()
const nameId = useId()
const bodyId = useId()
const filledStar = '\u2605'
const emptyStar = '\u2606'
const stats = computed(() => supplierScopedMetrics(props.item, props.model, props.metricsStale))
const averageLabel = computed(() => t(props.model ? 'admin.supplierHall.modelAverage' : 'admin.modelHealth.hallAverage'))
const hasFailures = computed(() => props.trend?.probe?.some(point => !!point.failed_from))

const platformLabel = computed(() => supplierPlatformLabels[props.item.platform] || props.item.platform)
const availability = computed(() => supplierAvailability(props.item, props.catalogStale, props.now))
const value = (key: SupplierMetric) => supplierMetric(props.item, props.model, key, props.now, props.metricsStale)
const format = (v: number | null | undefined, key: SupplierMetric) => formatSupplierMetric(v, key, locale.value)
const metric = (key: SupplierMetric) => format(value(key), key)
const chips = computed(() => {
  const offered = new Set((props.item.supported_models ?? []).map(item => item.model))
  const cards = new Map((props.item.models ?? []).map(card => [card.model, card]))
  const names = [...new Set([...(props.model ? [props.model] : []), ...cards.keys(), ...offered])]
  return names.map(model => {
    const card = cards.get(model)
    const listed = offered.has(model)
    const health = card && !props.catalogStale ? supplierCardHealth(card, props.now) : 'unknown'
    const availabilityKey = props.catalogStale || !props.item.catalog_known ? 'unknownCatalog' : listed ? 'currentlyListed' : 'knownDelisted'
    return { model, alias: card?.alias || model, listed, health, title: model + ' · ' + t('admin.supplierHall.' + availabilityKey) }
  })
})
const detection = computed(() => props.item.detection)
const hasDetection = computed(() => !!(detection.value?.status || detection.value?.model || detection.value?.has_image || detection.value?.has_preview))
const detectionTitle = computed(() => detection.value?.image_title?.[locale.value.startsWith('zh') ? 'zh' : 'en'] || detection.value?.image_title?.zh || detection.value?.image_title?.en || '')
const detectionState = computed(() => {
  if (detection.value?.status === 'failed' || detection.value?.passed === false) return 'failed'
  if (detection.value?.status === 'passed') return 'passed'
  if (detection.value?.status === 'running') return 'running'
  return 'unknown'
})
const detectionIcon = computed(() => ({ passed: 'checkCircle', failed: 'xCircle', running: 'clock', unknown: 'eye' })[detectionState.value] as 'checkCircle' | 'xCircle' | 'clock' | 'eye')
const detectionLabel = computed(() => t({
  passed: 'admin.supplierHall.detectionPassed',
  failed: 'admin.supplierHall.detectionFailed',
  running: 'admin.modelHealth.detectionStates.running',
  unknown: 'admin.modelHealth.detectionStates.unknown'
}[detectionState.value]))
</script>

<style scoped>
.supplier-row { @apply border-b border-gray-200 bg-white text-gray-900 dark:border-dark-700 dark:bg-dark-900 dark:text-gray-100; }
.supplier-row-open { box-shadow: inset 3px 0 0 #0891b2; }
.supplier-identity { display: grid; gap: 3px; }
.supplier-name-line, .supplier-meta, .supplier-models, .supplier-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.supplier-name { display: inline-flex; min-width: 0; align-items: center; gap: 4px; font-size: 16px; font-weight: 700; line-height: 1.4; text-align: left; overflow-wrap: anywhere; @apply rounded hover:text-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700 dark:hover:text-cyan-300; }
.supplier-name svg, .supplier-detection-title svg { flex-shrink: 0; }
.supplier-meta, .supplier-note, .supplier-samples, .supplier-cost small { font-size: 11px; @apply text-gray-600 dark:text-gray-400; }
.supplier-note { @apply line-clamp-2; }
.supplier-number { font-size: 17px; font-variant-numeric: tabular-nums; line-height: 1.25; }
.supplier-cost { padding-bottom: 3px; @apply border-b border-gray-200 dark:border-dark-700; }
.supplier-effective { display: inline-block; margin-top: 3px; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.supplier-state, .supplier-models > *, .supplier-detection-status, .supplier-detection-title { display: inline-flex; align-items: center; gap: 4px; }
.supplier-state, .supplier-detection-status { width: fit-content; border-radius: 4px; padding: 3px 7px; font-size: 11px; font-weight: 650; @apply bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-gray-300; }
.supplier-state[data-state="available"], .supplier-detection-status[data-state="passed"], .supplier-models > [data-health="healthy"] { @apply bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300; }
.supplier-state[data-state="unavailable"], .supplier-detection-status[data-state="failed"], .supplier-models > [data-health="failed"] { @apply bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300; }
.supplier-models { margin-top: 5px; gap: 3px; }
.supplier-models > * { max-width: 100%; padding: 2px 5px; border-radius: 3px; font-size: 10px; @apply bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-300; }
.supplier-models > span > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.supplier-models button:hover { text-decoration: underline; }
.supplier-state i, .supplier-models i { flex: 0 0 5px; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.supplier-samples { display: block; margin-top: 4px; font-variant-numeric: tabular-nums; }
.supplier-detection-title { font-size: 11px; @apply text-cyan-800 hover:underline dark:text-cyan-300; }
.supplier-detection-title span { @apply line-clamp-2; }
.supplier-actions { display: grid; justify-items: end; gap: 5px; }
.supplier-connect { min-height: 32px; max-width: 100%; padding: 4px 7px; gap: 4px; font-size: 12px; text-align: center; white-space: normal; }
.supplier-tools { gap: 4px; }
.supplier-icon-button { display: inline-grid; width: 30px; height: 30px; place-items: center; font-size: 17px; @apply rounded border border-gray-200 text-gray-600 hover:border-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700 dark:border-dark-600 dark:text-gray-300; }
.supplier-favorite[aria-pressed="true"] { @apply border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300; }
.supplier-block[aria-pressed="true"] { @apply border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300; }
@container provider-board (max-width: 599px) {
  .supplier-actions { display: flex; align-items: center; gap: 8px; }
  .supplier-connect { flex: 1; min-height: 36px; }
  .supplier-icon-button { width: 36px; height: 36px; }
}
</style>
