<template>
  <details v-if="rule.header_policy?.enabled" class="border-t border-gray-100 px-3 py-3 text-xs dark:border-dark-700 sm:px-4" :data-testid="`header-signal-${rule.id}-${accountId}`">
    <summary class="cursor-pointer list-none" :class="signal?.warning ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'">
      <span class="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span class="min-w-0 break-words">{{ t('admin.modelHealth.localRequests') }} · {{ rule.model }} · {{ t('admin.modelHealth.headerWaitLabel', { seconds: rule.header_policy.wait_seconds }) }}</span>
        <span class="font-semibold tabular-nums">{{ strongest ? `${percent(strongest.rate)} ${strongest.warning ? '≥' : '<'} ${rule.header_policy.rate_percent}%` : t('admin.modelHealth.headerInsufficient') }}</span>
      </span>
      <span class="mt-1 block text-gray-500">{{ strongest ? windowName(strongest.minutes) : '' }} {{ signal?.windows.some(item => item.partial) ? t('admin.modelHealth.headerPartial') : '' }}</span>
    </summary>
    <p v-if="signal?.error" class="mt-3 text-red-600">{{ t('admin.modelHealth.headerHistoryError') }}</p>
    <div v-for="window in signal?.windows ?? []" :key="window.minutes" class="mt-3 flex flex-wrap items-start justify-between gap-2 border-t border-gray-100 pt-2 dark:border-dark-700">
      <span>{{ windowName(window.minutes) }} · {{ window.partial ? t('admin.modelHealth.headerPartial') : t('admin.modelHealth.headerComplete') }}</span>
      <div class="min-w-0 text-right tabular-nums">
        <p :class="window.warning ? 'text-red-600 dark:text-red-400' : ''">{{ percent(window.rate) }} · {{ t('admin.modelHealth.headerCounts', { slow: window.slow.toLocaleString(), requests: window.requests.toLocaleString() }) }}</p>
        <p class="mt-1 text-gray-500">{{ t('admin.modelHealth.headerObserved', { minutes: Math.floor(window.observed_seconds / 60) }) }}</p>
        <p v-if="!window.enough_samples" class="mt-1 text-amber-600">{{ t('admin.modelHealth.headerSampleMinimum', { count: rule.header_policy.min_samples }) }}</p>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModelHealthHeaderSignal, ModelHealthRule } from '@/api/admin/modelHealth'

const props = defineProps<{ rule: ModelHealthRule; signal?: ModelHealthHeaderSignal; accountId: number }>()
const { t } = useI18n()
const strongest = computed(() => [...(props.signal?.windows ?? [])].filter(item => item.enough_samples && item.rate != null).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0])
const percent = (rate: number | null) => rate == null ? '-' : `${(rate * 100).toFixed(2)}%`
const windowName = (minutes: number) => minutes === 60 ? '1h' : `${minutes}m`
</script>
