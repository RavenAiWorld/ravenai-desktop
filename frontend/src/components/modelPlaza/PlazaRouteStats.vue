<template>
  <section class="route-stats" data-testid="plaza-route-stats" :data-stale="stats.stale" :aria-label="scopeLabel" :title="scopeLabel">
    <div class="values">
      <div>
        <div class="status-heading">
          <span>{{ t('modelPlaza.metrics.status') }}</span>
          <strong data-metric="success" :title="t('modelPlaza.metrics.successRate')">{{ stats.success_rate == null ? '–' : (stats.success_rate * 100).toFixed(2) + '%' }}</strong>
        </div>
        <div class="segments" role="img" :aria-label="historyLabel" :title="historyLabel">
          <i v-for="(cell, index) in cells" :key="index" :data-state="cell.state" :title="cell.hint" />
        </div>
      </div>
      <div>
        <span>{{ t('modelPlaza.metrics.latency') }}</span>
        <strong data-metric="latency">{{ stats.latency_ms == null ? '–' : (stats.latency_ms / 1000).toFixed(2) + 's' }}</strong>
      </div>
      <div>
        <span>{{ t('modelPlaza.metrics.throughput') }}</span>
        <strong data-metric="tps">{{ stats.tps == null ? '–' : stats.tps.toFixed(1) + 't/s' }}</strong>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlazaRouteStats } from '@/api/modelPlaza'

const props = defineProps<{ stats: PlazaRouteStats; groupName: string }>()
const { t, locale } = useI18n()
const updated = computed(() => new Date(props.stats.updated_at))
const scopeLabel = computed(() => [
  props.groupName,
  t(props.stats.group_average ? 'modelPlaza.metrics.groupAverage' : 'modelPlaza.metrics.modelStats'),
  t('modelPlaza.metrics.lastHour'),
  t('modelPlaza.metrics.updated', { time: updated.value.toLocaleString(locale.value) }),
  ...(props.stats.stale ? [t('modelPlaza.metrics.cached')] : [])
].join(' · '))
const formatter = computed(() => new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }))
const clock = (date: Date) => formatter.value.format(date)
const historyLabel = computed(() => t('modelPlaza.metrics.probeWindow', { group: props.groupName }))
const cells = computed(() => props.stats.history.map((value, i, history) => {
  const state = value || 'unknown'
  const start = updated.value.getTime() - (history.length - i) * 900_000
  return {
    state,
    hint: `${props.groupName} · ${clock(new Date(start))}–${clock(new Date(start + 900_000))} · ${t(`modelPlaza.metrics.${state}`)}`
  }
}))
</script>

<style scoped>
.route-stats { @apply mt-1.5 border-t pt-2; border-color: var(--plaza-border); color: var(--plaza-muted-foreground); }
.values { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(0, .8fr) minmax(0, 1fr); column-gap: clamp(8px, 6%, 24px); max-width: 21rem; }
.values > div { @apply grid min-w-0 content-start gap-y-1; }
.values span { @apply text-xs leading-4; }
.values strong { @apply whitespace-nowrap font-mono text-[13px] font-medium leading-4 tabular-nums; color: var(--plaza-foreground); }
.status-heading { @apply flex flex-wrap items-baseline justify-between gap-x-1; }
.status-heading strong { @apply text-xs font-normal leading-4; color: var(--plaza-muted-foreground); }
.segments { @apply grid h-3.5 items-stretch; grid-template-columns: repeat(24, minmax(0, 1fr)); gap: 2px; }
.segments i { @apply block rounded-sm; }
.segments [data-state="unknown"] { @apply bg-gray-300 dark:bg-neutral-600; }
.segments [data-state="operational"] { @apply bg-emerald-500; }
.segments [data-state="degraded"] { @apply bg-amber-500; }
.segments [data-state="failed"] { @apply bg-red-500; }
</style>
