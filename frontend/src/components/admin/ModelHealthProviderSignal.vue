<template>
  <section class="min-w-0 border-t border-gray-100 px-3 py-3 text-xs dark:border-dark-700 sm:px-4" data-testid="provider-signal">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="font-medium">AIHub · {{ group?.code ?? `#${groupId}` }}</span>
      <span :class="source?.stale || source?.error || !group ? 'text-amber-600' : 'text-gray-500'">{{ source?.stale || source?.error || !group ? t(modelHealthProviderNotice(source?.error)) : t('admin.modelHealth.upstreamMetrics', { range }) }} · {{ time(source?.metrics_updated_at ?? source?.generated_at) }}</span>
    </div>
    <div v-if="group" class="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-gray-500">
      <span>{{ t('admin.modelHealth.providerInputPrice') }} <strong class="font-medium text-gray-700 dark:text-gray-200">{{ number(stats?.input_price_per_million, 4) }}</strong></span>
      <span>{{ t('admin.modelHealth.effectiveMultiplier') }} <strong class="font-medium text-gray-700 dark:text-gray-200">{{ predictedRate == null ? '-' : number(predictedRate, 4) + ' x' }}</strong></span>
      <span>{{ t('admin.modelHealth.multiplier') }} {{ number(group.rate_multiplier, 3) }} x</span>
    </div>
    <div v-if="group" class="mt-3 overflow-x-auto">
      <table class="w-full min-w-[540px] text-left">
        <thead class="border-b border-gray-100 text-gray-500 dark:border-dark-700"><tr><th class="py-2 pr-3 font-normal">{{ t('admin.modelHealth.model') }}</th><th class="px-3 py-2 font-normal">{{ t('admin.modelHealth.providerHealth') }}</th><th class="px-3 py-2 font-normal">{{ t('admin.modelHealth.upstreamLatency') }}</th><th class="px-3 py-2 font-normal">{{ t('admin.modelHealth.requestSuccess', { range }) }}</th><th class="px-3 py-2 font-normal">{{ t('admin.modelHealth.tps', { range }) }}</th><th class="py-2 pl-3 font-normal">{{ t('admin.modelHealth.providerExpires') }}</th></tr></thead>
        <tbody><tr v-for="model in models" :key="model.model" class="border-b border-gray-100 last:border-b-0 dark:border-dark-700">
          <td class="py-2 pr-3">{{ model.model }}</td>
          <td class="px-3 py-2" :class="model.health === 'healthy' ? 'text-emerald-600' : model.health === 'failed' ? 'text-red-600' : 'text-gray-500'">{{ t(`admin.modelHealth.${model.health}`) }}<span v-if="model.probe" class="ml-1 text-gray-400">({{ model.probe.sample_count }})</span></td>
          <td class="px-3 py-2 tabular-nums">{{ number(modelStats(model.target)?.duration_ms, 0) }} ms</td>
          <td class="px-3 py-2 tabular-nums">{{ percent(modelStats(model.target)?.success_rate) }}</td>
          <td class="px-3 py-2 tabular-nums">{{ number(modelStats(model.target)?.tps, 1) }}</td>
          <td class="py-2 pl-3 tabular-nums text-gray-500">{{ time(model.probe?.health_expires_at) }}</td>
        </tr></tbody>
      </table>
    </div>
    <details v-if="group" class="mt-3">
      <summary class="cursor-pointer text-gray-600 dark:text-gray-300">{{ t('admin.modelHealth.providerWarnings') }} <span class="ml-1" :class="typeof activeWarnings === 'number' && activeWarnings > 0 ? 'text-red-600' : 'text-gray-500'">{{ activeWarnings }}</span></summary>
      <div class="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="warning in group.warnings" :key="warning.id" class="min-w-0 border-t border-gray-100 py-2 dark:border-dark-700">
          <div class="flex items-center justify-between gap-2"><span>{{ warningName(warning.id) }}</span><span :class="warning.status === 'active' && warningsFresh ? 'text-red-600' : 'text-gray-500'">{{ t(`admin.modelHealth.providerStatuses.${warningsFresh ? warning.status : 'unknown'}`) }}</span></div>
          <p v-for="(trigger, index) in warning.triggers" :key="index" class="mt-1 break-words text-gray-500">{{ trigger.window }} · {{ trigger.model === 'all recorded models' ? t('admin.modelHealth.allModels') : trigger.model }} · {{ number(trigger.numerator, 3) }}/{{ number(trigger.denominator, 3) }} · {{ number(trigger.value, 2) }}{{ warning.id === 'slow_response' ? '%' : '' }} {{ trigger.operator }} {{ trigger.threshold }}{{ warning.id === 'slow_response' ? '%' : '' }} · {{ time(trigger.expires_at) }}</p>
        </div>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { supplierEffectiveMultiplier, supplierScopedMetrics } from '@/utils/supplierHall'
import { modelHealthProviderNotice } from '@/utils/modelHealthProvider'
import type { ModelHealthMetricsRange, ModelHealthProviderGroup, ModelHealthProviderModel, ModelHealthProviders } from '@/api/admin/modelHealth'

const props = defineProps<{
  group?: ModelHealthProviderGroup
  source?: ModelHealthProviders
  groupId: number
  range: ModelHealthMetricsRange
  metricsStale: boolean
  models: { model: string; target: string; health: string; probe?: ModelHealthProviderModel }[]
}>()
const { t, te } = useI18n()
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
const stats = computed(() => supplierScopedMetrics(props.group, '', props.metricsStale))
const predictedRate = computed(() => supplierEffectiveMultiplier(stats.value, now.value))
const modelStats = (model: string) => supplierScopedMetrics(props.group, model, props.metricsStale)
const warningsFresh = computed(() => !props.source?.stale && !props.source?.error && Date.parse(props.group?.warnings_expires_at ?? '') > now.value)
const activeWarnings = computed(() => warningsFresh.value ? props.group?.warnings.filter(item => item.status === 'active').length ?? 0 : '-')
function warningName(id: string) { return te(`admin.modelHealth.providerWarningNames.${id}`) ? t(`admin.modelHealth.providerWarningNames.${id}`) : id }
function number(value: number | null | undefined, digits: number) { return value == null || !Number.isFinite(value) ? '-' : value.toLocaleString(undefined, { maximumFractionDigits: digits }) }
function percent(value?: number | null) { return value == null ? '-' : `${number(value * 100, 1)}%` }
function time(value?: string) { return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-' }
</script>
