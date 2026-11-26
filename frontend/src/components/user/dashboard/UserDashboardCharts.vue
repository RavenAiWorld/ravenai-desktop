<template>
  <div class="space-y-3">
    <!-- Filters: one row scoping every chart below -->
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-[13px] text-rv-fg-3">{{ t('dashboard.timeRange') }}</span>
      <DateRangePicker :start-date="startDate" :end-date="endDate" @update:startDate="$emit('update:startDate', $event)" @update:endDate="$emit('update:endDate', $event)" @change="$emit('dateRangeChange', $event)" />
      <div class="w-28">
        <Select :model-value="granularity" :options="[{value:'day', label:t('dashboard.day')}, {value:'hour', label:t('dashboard.hour')}]" :aria-label="t('dashboard.granularity')" @update:model-value="$emit('update:granularity', $event)" @change="$emit('granularityChange')" />
      </div>
      <button @click="$emit('refresh')" :disabled="loading" class="btn btn-ghost btn-sm" :title="t('common.refresh')">
        <Icon name="refresh" size="sm" :class="loading ? 'animate-spin' : ''" />
        <span class="hidden sm:inline">{{ t('common.refresh') }}</span>
      </button>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <!-- Token Usage Trend Chart -->
      <TokenUsageTrend class="xl:col-span-3" :trend-data="trend" :loading="loading" />

      <!-- Model distribution as a ranked list: closer to the numbers than a doughnut -->
      <div class="card relative flex flex-col overflow-hidden xl:col-span-2">
        <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-rv-surface/60">
          <LoadingSpinner size="md" />
        </div>
        <div class="flex items-baseline justify-between gap-3 px-5 pb-2 pt-4">
          <h3 class="text-sm font-semibold text-rv-fg">{{ t('dashboard.modelDistribution') }}</h3>
          <span class="text-xs text-rv-fg-3">{{ t('dashboard.tokens') }}</span>
        </div>
        <div v-if="rankedModels.length" class="min-h-0 flex-1 overflow-auto px-3 pb-3">
          <div class="model-rank-row model-rank-head">
            <span class="min-w-0 flex-1">{{ t('dashboard.model') }}</span>
            <span class="w-14 text-right">{{ t('dashboard.requests') }}</span>
            <span class="w-16 text-right">{{ t('dashboard.tokens') }}</span>
            <span class="w-[72px] text-right">{{ t('dashboard.actual') }}</span>
            <span class="hidden w-[72px] text-right sm:block">{{ t('dashboard.standard') }}</span>
          </div>
          <div v-for="model in rankedModels" :key="model.model" class="model-rank-row group">
            <span class="model-rank-bar" :style="{ width: `${model.share}%` }" aria-hidden="true"></span>
            <span class="relative min-w-0 flex-1 truncate font-mono text-[12.5px] text-rv-fg" :title="model.model">{{ model.model }}</span>
            <span class="relative w-14 text-right text-rv-fg-3">{{ formatNumber(model.requests) }}</span>
            <span class="relative w-16 text-right text-rv-fg">{{ formatTokens(model.total_tokens) }}</span>
            <span class="relative w-[72px] text-right text-rv-fg">${{ formatCost(model.actual_cost) }}</span>
            <span class="relative hidden w-[72px] text-right text-rv-fg-4 sm:block">${{ formatCost(model.cost) }}</span>
          </div>
        </div>
        <div v-else class="flex flex-1 items-center justify-center py-12 text-sm text-rv-fg-3">{{ t('dashboard.noDataAvailable') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import Select from '@/components/common/Select.vue'
import Icon from '@/components/icons/Icon.vue'
import TokenUsageTrend from '@/components/charts/TokenUsageTrend.vue'
import type { TrendDataPoint, ModelStat } from '@/types'
import { formatCostFixed as formatCost, formatNumberLocaleString as formatNumber, formatTokensK as formatTokens } from '@/utils/format'

const props = defineProps<{ loading: boolean, startDate: string, endDate: string, granularity: string, trend: TrendDataPoint[], models: ModelStat[] }>()
defineEmits(['update:startDate', 'update:endDate', 'update:granularity', 'dateRangeChange', 'granularityChange', 'refresh'])
const { t } = useI18n()

const rankedModels = computed(() => {
  const models = [...(props.models || [])].sort((a, b) => b.total_tokens - a.total_tokens)
  const max = models[0]?.total_tokens || 0
  return models.map((m) => ({ ...m, share: max > 0 ? Math.max(2, (m.total_tokens / max) * 100) : 0 }))
})
</script>

<style scoped>
.model-rank-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.model-rank-row + .model-rank-row {
  margin-top: 2px;
}

.model-rank-head {
  height: 26px;
  font-size: 11.5px;
  color: rgb(var(--rv-fg-4));
}

.model-rank-bar {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 6px;
  background: rgb(var(--rv-accent) / 0.1);
  transition: background-color 0.15s;
}

.model-rank-row:hover .model-rank-bar {
  background: rgb(var(--rv-accent) / 0.18);
}
</style>
