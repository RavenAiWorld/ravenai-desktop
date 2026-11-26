<template>
  <div class="supplier-detail" data-testid="supplier-details">
    <section class="detail-section" :aria-label="t('admin.supplierHall.response')">
      <div class="min-w-0">
        <h3><Icon name="chartBar" size="sm" aria-hidden="true" />{{ t('admin.supplierHall.response') }}</h3>
        <dl class="detail-stats">
          <div v-for="stat in responseStats" :key="stat.key">
            <dt>{{ t(`admin.supplierHall.${stat.key}`) }}</dt>
            <dd>{{ stat.value }}</dd>
          </div>
        </dl>
      </div>
      <div class="detail-plot">
        <div class="flex items-center justify-between gap-3">
          <h4>{{ t('admin.supplierHall.responseTrend') }}</h4><span class="detail-muted">{{ trendRange }}</span>
        </div>
        <p v-if="item.probe?.model" class="detail-muted">{{ t('admin.supplierHall.probeModel', { model: item.probe.model }) }}</p>
        <p v-if="item.probe?.chart_models?.length" class="detail-muted">{{ t('admin.supplierHall.trafficModels', { models: item.probe.chart_models.join(', ') }) }}</p>
        <SupplierHistoryChart :trend="trend" :period="trend?.period" :label="t('admin.supplierHall.responseTrend')" :empty-label="trendState" />
        <div class="detail-legend">
          <span>{{ t('admin.supplierHall.firstToken') }}</span><span>{{ t('admin.supplierHall.textProbe') }}</span>
        </div>
      </div>
    </section>

    <section class="detail-section" :aria-label="t('admin.supplierHall.pricingUsage')">
      <div class="min-w-0">
        <h3><Icon name="clock" size="sm" aria-hidden="true" />{{ t('admin.supplierHall.pricingUsage') }}</h3>
        <dl class="detail-stats">
          <div v-for="stat in pricingStats" :key="stat.key">
            <dt>{{ t(`admin.supplierHall.${stat.key}`) }}</dt>
            <dd>{{ stat.value }}</dd>
          </div>
          <div v-if="comparison">
            <dt>{{ t('admin.supplierHall.usageComparison', { range }) }}</dt>
            <dd>{{ relativeInput }}</dd>
          </div>
        </dl>
        <p v-if="comparison?.models.length" class="detail-muted mt-2">{{ comparison.models.join(', ') }}</p>
      </div>
      <div class="detail-plot">
        <div class="flex items-center justify-between gap-3">
          <h4>{{ t('admin.supplierHall.multiplierHistory') }}</h4><span class="detail-muted">7d</span>
        </div>
        <p v-if="rates?.source_at" class="detail-muted">{{ date(rates.source_at) }}</p>
        <SupplierHistoryChart :rates="rates" rate-chart :label="t('admin.supplierHall.multiplierHistory')" :empty-label="ratesState" />
      </div>
    </section>

    <section class="detail-prices">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3><Icon name="grid" size="sm" aria-hidden="true" />{{ t('admin.supplierHall.models') }}</h3>
        <span class="detail-muted">{{ t('admin.supplierHall.comparePrices') }}<template v-if="item.long_context"> · {{ t('admin.supplierHall.longContext') }}</template></span>
      </div>
      <p v-if="!item.supported_models?.length" class="detail-muted mt-2">{{ t('admin.supplierHall.noCatalog') }}</p>
      <div v-else class="detail-table-scroll" tabindex="0" role="region" :aria-label="t('admin.supplierHall.comparePrices')">
        <table class="w-full text-xs">
          <thead class="text-gray-600 dark:text-gray-300">
            <tr>
              <th scope="col" class="p-2 text-left">{{ t('admin.supplierHall.models') }}</th>
              <th v-for="key in priceColumns" :key="key.field" scope="col" class="p-2 text-right">{{ t(`admin.supplierHall.${key.label}`) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pricing in item.supported_models" :key="pricing.model" :class="{ 'bg-primary-50 dark:bg-dark-700': pricing.model === model }">
              <th scope="row" class="break-all p-2 text-left font-medium">{{ pricing.model }}</th>
              <td v-for="key in priceColumns" :key="key.field" class="p-2 text-right tabular-nums">{{ number(pricing.price[key.field], 4) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getSupplierRateHistory, getSupplierSeries, type SupplierHallItem, type SupplierSummaryRange, type SupplierTrendRange, type SupplierRateHistory, type SupplierTrend } from '@/api/admin/supplierHall'
import { formatSupplierMetric, supplierMetric, supplierScopedMetrics, type SupplierMetric } from '@/utils/supplierHall'
import Icon from '@/components/icons/Icon.vue'
import SupplierHistoryChart from './SupplierHistoryChart.vue'

const props = defineProps<{ item: SupplierHallItem; model: string; range: SupplierSummaryRange; trendRange: SupplierTrendRange; now: number; metricsStale: boolean }>()
const { t, locale } = useI18n()
const trend = ref<SupplierTrend>()
const rates = ref<SupplierRateHistory>()
const trendState = ref('')
const ratesState = ref('')
let controller: AbortController | undefined

const priceColumns = [
  { field: 'input_per_million', label: 'input' },
  { field: 'cache_input_per_million', label: 'cachedInput' },
  { field: 'cache_write_per_million', label: 'cacheWrite' },
  { field: 'output_per_million', label: 'output' }
] as const
const format = (v: number | null | undefined, key: SupplierMetric) => formatSupplierMetric(v, key, locale.value)
const metric = (key: SupplierMetric) => format(supplierMetric(props.item, props.model, key, props.now, props.metricsStale), key)
const number = (v: number | null | undefined, digits: number) => v == null || !Number.isFinite(v) ? '\u2014' : v.toLocaleString(locale.value, { maximumFractionDigits: digits })
function date(value?: string) {
  const timestamp = Date.parse(value ?? '')
  return timestamp > 0 ? new Date(timestamp).toLocaleString(locale.value) : '\u2014'
}
const responseStats = computed(() => [
  { key: 'probeFirstToken', value: format(props.item.probe?.ttft_ms, 'firstToken') },
  { key: 'firstToken', value: metric('firstToken') },
  { key: 'probeAvailability', value: format(props.item.probe?.success_6h, 'success') },
  { key: 'success', value: metric('success') },
  { key: 'probeE2E', value: format(props.item.probe?.e2e_ttft_ms, 'firstToken') },
  { key: 'lastProbe', value: date(props.item.probe?.last_probed_at) }
])
const pricingStats = computed(() => [
  { key: 'rate', value: metric('rate') },
  { key: 'effectivePrice', value: metric('cost') },
  { key: 'effective', value: metric('effective') },
  { key: 'cache', value: metric('cache') }
])
const comparison = computed(() => supplierScopedMetrics(props.item, props.model, props.metricsStale)?.input_comparison ??
  (!props.metricsStale && !props.model && props.range === '1h' ? props.item.input_comparison : undefined))
const relativeInput = computed(() => {
  const value = comparison.value
  if (!value) return ''
  const change = value.excess_percent
  return `${format(value.multiplier, 'effective')} (${change > 0 ? '+' : ''}${number(change, 1)}%)`
})

watch(() => [props.item.group_id, props.trendRange] as const, async ([id, window]) => {
  controller?.abort()
  const request = new AbortController()
  controller = request
  trend.value = rates.value = undefined
  trendState.value = ratesState.value = t('admin.supplierHall.loading')
  await Promise.allSettled([
    getSupplierSeries([id], window, request.signal).then(result => {
      if (request.signal.aborted) return
      trend.value = result[String(id)]
      trendState.value = ''
    }).catch(() => { if (!request.signal.aborted) trendState.value = t('admin.supplierHall.historyFailed') }),
    getSupplierRateHistory(id, request.signal).then(result => {
      if (request.signal.aborted) return
      rates.value = result
      ratesState.value = ''
    }).catch(() => { if (!request.signal.aborted) ratesState.value = t('admin.supplierHall.historyFailed') })
  ])
}, { immediate: true })
onUnmounted(() => controller?.abort())
</script>

<style scoped>
.supplier-detail {
  padding: 0 18px 14px;
  @apply border-l-2 border-cyan-600 bg-gray-50/70 dark:border-cyan-500 dark:bg-dark-800/50;
}
.detail-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.28fr);
  gap: 18px;
  align-items: start;
  padding: 16px 0;
  @apply border-t border-gray-200 dark:border-dark-700;
}
.detail-section h3, .detail-prices h3 { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; }
.supplier-detail h3 svg { flex-shrink: 0; @apply text-cyan-700 dark:text-cyan-300; }
.detail-section h4 { font-size: 12px; font-weight: 650; overflow-wrap: anywhere; }
.detail-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
.detail-stats div { padding-top: 7px; @apply border-t border-gray-200 dark:border-dark-700; }
.detail-stats dt, .detail-muted { font-size: 11px; overflow-wrap: anywhere; @apply text-gray-600 dark:text-gray-400; }
.detail-stats dd { margin-top: 3px; font-size: 14px; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.detail-plot { min-width: 0; }
.detail-plot p { margin-top: 3px; }
.detail-legend { display: flex; flex-wrap: wrap; gap: 3px 10px; font-size: 10px; @apply text-gray-600 dark:text-gray-400; }
.detail-legend span { display: inline-flex; align-items: center; gap: 4px; }
.detail-legend span::before { content: ''; width: 12px; border-top: 2px solid #21ae84; }
.detail-legend span + span::before { border-top: 1px dashed #36a5ce; }
.detail-prices { padding: 12px 0 0; @apply border-t border-gray-200 dark:border-dark-700; }
.detail-table-scroll { max-width: 100%; overflow: auto; margin-top: 7px; }
.detail-table-scroll table { min-width: 26rem; }
.detail-table-scroll tr { @apply border-b border-gray-200 dark:border-dark-700; }
@container provider-board (max-width: 720px) {
  .supplier-detail { padding-inline: 10px; }
  .detail-section { grid-template-columns: minmax(0, 1fr); }
  .detail-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
