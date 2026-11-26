<template>
  <dl class="provider-indicators" :aria-label="scope">
    <div v-for="gauge in gauges" :key="gauge.key" class="provider-indicator" :title="scope">
      <dt>{{ t('admin.modelHealth.' + gauge.key, { range }) }}</dt>
      <dd class="metric-ring" :data-tone="gauge.tone" :style="{ '--arc': gauge.arc + 'deg' }"><span>{{ gauge.text }}</span></dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModelHealthProviderMetrics } from '@/api/admin/modelHealth'
import type { SupplierSummaryRange } from '@/api/admin/supplierHall'
import { formatSupplierMetric } from '@/utils/supplierHall'

const props = defineProps<{
  stats?: Pick<ModelHealthProviderMetrics, 'cache_hit_rate' | 'success_rate' | 'tps'>
  range: SupplierSummaryRange
  scope: string
}>()
const { t, locale } = useI18n()
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const gauges = computed(() => {
  const values = [
    { key: 'cacheHit', metric: 'cache', value: props.stats?.cache_hit_rate },
    { key: 'requestSuccess', metric: 'success', value: props.stats?.success_rate },
    { key: 'tps', metric: 'speed', value: props.stats?.tps },
  ] as const
  return values.map(({ key, metric, value }) => {
    if (value == null || !Number.isFinite(value) || value < 0 || metric !== 'speed' && value > 1) {
      return { key, arc: 0, tone: 'unknown', text: '\u2014' }
    }
    // Arc length is AIHub's score, not the raw percentage printed inside.
    const score = clamp(metric === 'cache' ? (value - .65) / .27 : metric === 'success' ? (value - .5) / .5 : value / 50)
    const good = metric === 'cache' ? value >= .92 : metric === 'success' ? value > .95 : score > .9
    return { key, arc: Math.round(score * 360), tone: good ? 'good' : score >= .55 ? 'fair' : 'low',
      text: formatSupplierMetric(value, metric, locale?.value) }
  })
})
</script>

<style scoped>
.provider-indicators { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; align-items: start; }
.provider-indicator { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; text-align: center; }
.provider-indicator dt { font-size: 11px; line-height: 1.4; overflow-wrap: anywhere; @apply text-gray-600 dark:text-gray-400; }
.metric-ring { --tone: #7194a4; --track: #dfe7ec; order: -1; display: grid; width: min(100%, 64px); aspect-ratio: 1; padding: 6px; border-radius: 50%; background: conic-gradient(var(--tone) var(--arc), var(--track) 0); }
.metric-ring[data-tone="good"] { --tone: #35ba86; }
.metric-ring[data-tone="fair"] { --tone: #2baadd; }
.metric-ring[data-tone="low"] { --tone: #ec7969; }
.metric-ring > span { display: grid; place-items: center; min-width: 0; border-radius: 50%; font-size: 12px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; @apply bg-white text-gray-900 dark:bg-dark-900 dark:text-gray-100; }
:global(.dark) .metric-ring { --track: #39424b; }
</style>
