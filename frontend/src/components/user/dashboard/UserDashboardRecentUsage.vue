<template>
  <div class="card flex h-full flex-col">
    <div class="flex items-center justify-between gap-3 border-b border-rv-line px-5 py-3">
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-semibold text-rv-fg">{{ t('dashboard.recentUsage') }}</h2>
        <span class="badge badge-gray">{{ t('dashboard.last7Days') }}</span>
      </div>
      <router-link v-if="data.length" to="/usage" class="inline-flex items-center gap-1 text-[13px] font-medium text-rv-accent-fg hover:text-rv-accent">
        {{ t('dashboard.viewAllUsage') }}
        <Icon name="arrowRight" size="xs" />
      </router-link>
    </div>
    <div v-if="loading" class="flex flex-1 items-center justify-center py-12">
      <LoadingSpinner size="md" />
    </div>
    <div v-else-if="data.length === 0" class="flex-1 py-6">
      <EmptyState :title="t('dashboard.noUsageRecords')" :description="t('dashboard.startUsingApi')" />
    </div>
    <ul v-else class="flex-1 divide-y divide-rv-line-soft">
      <li v-for="log in data" :key="log.id" class="flex items-center gap-4 px-5 py-2.5 text-[13px] transition-colors hover:bg-rv-hover/50">
        <div class="min-w-0 flex-1">
          <p class="truncate font-mono text-[12.5px] text-rv-fg">{{ log.model }}</p>
          <p class="mt-0.5 text-xs text-rv-fg-3">{{ formatDateTime(log.created_at) }}</p>
        </div>
        <p class="hidden w-28 text-right text-xs text-rv-fg-3 sm:block" style="font-variant-numeric: tabular-nums">{{ (log.input_tokens + log.output_tokens).toLocaleString() }} tokens</p>
        <p class="w-32 text-right" style="font-variant-numeric: tabular-nums">
          <span class="font-medium text-rv-fg" :title="t('dashboard.actual')">${{ formatCost(log.actual_cost) }}</span>
          <span class="block text-xs text-rv-fg-4" :title="t('dashboard.standard')">${{ formatCost(log.total_cost) }}</span>
        </p>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Icon from '@/components/icons/Icon.vue'
import { formatBusinessDateTime as formatDateTime } from '@/utils/format'
import type { UsageLog } from '@/types'

defineProps<{
  data: UsageLog[]
  loading: boolean
}>()
const { t } = useI18n()
const formatCost = (c: number) => c.toFixed(4)
</script>
