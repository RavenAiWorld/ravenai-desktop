<template>
  <div class="latency-meter" :data-tier="tier" :title="hint">
    <div class="latency-value"><strong>{{ formatSupplierMetric(value, 'firstToken', locale) }}</strong><span v-if="value != null">{{ t('admin.modelHealth.speedLabels.' + tier) }}</span></div>
    <div class="latency-track" aria-hidden="true"><i :style="{ width: score + '%' }" /></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSupplierMetric } from '@/utils/supplierHall'

const props = defineProps<{ ms?: number | null; hint?: string }>()
const { t, locale } = useI18n()
const value = computed(() => props.ms != null && Number.isFinite(props.ms) && props.ms >= 0 ? props.ms : null)
const tier = computed(() => value.value == null ? 'unknown' : value.value <= 15000 ? 'fast' : value.value <= 22000 ? 'medium' : 'slow')
const score = computed(() => value.value == null ? 0 : Math.max(0, Math.min(100, (30000 - value.value) / 200)))
</script>

<style scoped>
.latency-meter { --signal: #31ba89; }
.latency-meter[data-tier="medium"] { --signal: #d8a431; }
.latency-meter[data-tier="slow"] { --signal: #df7266; }
.latency-value { display: flex; align-items: baseline; flex-wrap: wrap; justify-content: space-between; gap: 3px 6px; }
.latency-value strong { font-size: 17px; font-weight: 700; line-height: 1.3; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.latency-value span { font-size: 10px; font-weight: 600; border-radius: 3px; padding: 1px 5px; @apply bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300; }
[data-tier="medium"] .latency-value span { @apply bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300; }
[data-tier="slow"] .latency-value span { @apply bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300; }
.latency-track { height: 5px; margin-top: 6px; border-radius: 3px; overflow: hidden; @apply bg-gray-200 dark:bg-dark-700; }
.latency-track i { display: block; height: 100%; background: var(--signal); }
</style>
