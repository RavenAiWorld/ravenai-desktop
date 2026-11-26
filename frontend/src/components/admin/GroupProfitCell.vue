<template>
  <div v-if="summary" class="space-y-1 text-xs tabular-nums" data-testid="group-profit-rates">
    <div v-if="summary.target_sell_rate != null" class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
      :title="t('admin.groups.profit.targetHint')">
      <span class="text-gray-500 dark:text-gray-400">{{ t('admin.groups.profit.target') }}</span>
      <strong class="text-sm text-gray-900 dark:text-gray-100" data-testid="profit-target-rate">{{ formatRate(summary.target_sell_rate) }}</strong>
    </div>
    <p v-else class="whitespace-normal text-gray-500 dark:text-gray-400">
      {{ t(summaryStatus) }}
    </p>
    <details v-if="summary.keys.length" class="w-fit max-w-64">
      <summary class="cursor-pointer text-primary-600 dark:text-primary-400">{{ t('admin.groups.profit.details') }}</summary>
      <dl class="my-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
        <dt>{{ t('admin.groups.profit.sellRate') }}</dt><dd class="text-right">{{ formatRate(summary.sell_rate) }}</dd>
        <dt>{{ t('admin.groups.profit.buyRate') }}</dt><dd class="text-right">{{ formatRate(summary.buy_rate) }}</dd>
        <template v-if="summary.profit_per_100 != null">
          <dt>{{ t('admin.groups.profit.per100') }}</dt>
          <dd class="whitespace-nowrap text-right">
            <strong :class="profitTone(summary.profit_per_100)" data-testid="profit-per-100">{{ money(summary.profit_per_100) }}</strong>
          </dd>
          <dt>{{ t('admin.groups.profit.rate') }}</dt>
          <dd class="text-right">{{ summary.margin == null ? '-' : summary.margin.toFixed(2) + '%' }}</dd>
        </template>
      </dl>
      <ul class="divide-y divide-gray-100 dark:divide-gray-700">
        <li v-for="key in summary.keys" :key="key.account_id" class="flex justify-between gap-3 py-1">
          <span class="min-w-0 whitespace-normal break-words" :title="'#' + key.account_id">{{ key.name }}</span>
          <span class="shrink-0 text-right">
            <span v-if="key.buy_rate == null" class="text-gray-500 dark:text-gray-400">{{ t(key.awaiting_first_quote ? 'admin.groups.profit.pending' : 'admin.groups.profit.noQuote') }}</span>
            <template v-else>
              <span class="block text-gray-500 dark:text-gray-400">{{ formatRate(key.buy_rate) }}</span>
              <span v-if="key.stale" class="text-gray-500 dark:text-gray-400">{{ t('admin.groups.profit.lastQuote') }}</span>
              <b v-else-if="key.profit_per_100 != null" :class="profitTone(key.profit_per_100)">{{ money(key.profit_per_100) }}</b>
            </template>
          </span>
        </li>
      </ul>
    </details>
  </div>
  <span v-else class="text-xs text-gray-400">{{ error ? t('admin.groups.profit.unavailable') : '…' }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GroupProfitRates } from '@/api/admin/groups'

const props = defineProps<{ summary?: GroupProfitRates; error?: boolean }>()
const { t, locale } = useI18n()
const summaryStatus = computed(() => {
  const keys = props.summary?.keys ?? []
  if (!keys.length) return 'admin.groups.profit.noKeys'
  const unpriced = keys.filter(key => key.buy_rate == null || key.stale)
  return unpriced.length && unpriced.every(key => key.buy_rate == null && key.awaiting_first_quote)
    ? 'admin.groups.profit.awaitingFirstQuote' : 'admin.groups.profit.incomplete'
})
const money = (v: number) => new Intl.NumberFormat(locale.value, {
  style: 'currency', currency: 'CNY', currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(v)
const formatRate = (v: number | null) => v == null ? '-' : new Intl.NumberFormat(locale.value, {
  useGrouping: false, maximumFractionDigits: 10,
}).format(v)
const profitTone = (v: number) => v >= 40 ? 'text-emerald-700 dark:text-emerald-300'
  : v < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'
</script>
