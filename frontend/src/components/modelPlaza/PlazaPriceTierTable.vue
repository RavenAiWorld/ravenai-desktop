<template>
  <div class="overflow-x-auto rounded-lg ring-1 ring-inset ring-gray-200 dark:ring-neutral-700">
    <table class="plaza-tier-table w-full min-w-[400px] border-collapse text-[13px]">
      <thead>
        <tr class="bg-gray-50 text-left text-[11px] font-medium text-gray-500 dark:bg-neutral-800/70 dark:text-neutral-400">
          <th v-if="hasVariant" scope="col" class="py-2 pl-3 pr-2 font-medium">
            <span class="sr-only">{{ t('modelPlaza.detail.tier') }}</span>
          </th>
          <th scope="col" class="py-2 font-medium" :class="hasVariant ? 'px-2' : 'pl-3 pr-2'">{{ t('modelPlaza.detail.tier') }}</th>
          <th scope="col" class="px-2 py-2 text-right font-medium">{{ t('modelPlaza.price.input') }}</th>
          <th scope="col" class="px-2 py-2 text-right font-medium">{{ t('modelPlaza.price.output') }}</th>
          <th scope="col" class="px-2 py-2 text-right font-medium">{{ t('modelPlaza.price.cacheRead') }}</th>
          <th v-if="hasCacheWrite" scope="col" class="px-2 py-2 text-right font-medium" :class="{ 'pr-3': !has1h }">
            {{ has1h ? shortCacheWriteLabel : t('modelPlaza.price.cacheWrite') }}
          </th>
          <th v-if="has1h" scope="col" class="py-2 pl-2 pr-3 text-right font-medium">{{ longCacheWriteLabel }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in rows"
          :key="row.key"
          class="border-t border-gray-100 dark:border-neutral-800"
          :data-tier-row="row.key"
        >
          <th
            v-if="hasVariant"
            scope="row"
            class="whitespace-nowrap py-2 pl-3 pr-2 text-left text-xs font-medium"
            :class="row.fast ? 'text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-neutral-300'"
          >
            <span class="inline-flex items-center gap-0.5" :class="{ 'sm:invisible': index > 0 && rows[index - 1].variant === row.variant }">
              <Icon v-if="row.fast" name="bolt" size="xs" class="h-3 w-3" />{{ row.variant }}
            </span>
          </th>
          <td class="whitespace-nowrap py-2 font-mono text-xs text-gray-500 dark:text-neutral-400" :class="hasVariant ? 'px-2' : 'plaza-tier-label-wide pl-3 pr-2'">
            {{ row.tierLabel }}
          </td>
          <td v-for="field in fields" :key="field" :data-label="t(`modelPlaza.price.${field}`)" class="whitespace-nowrap px-2 py-2 text-right font-mono tabular-nums" :class="valueClass">
            {{ formatUnitPrice(row.tier[field], unit) }}
          </td>
          <td v-if="hasCacheWrite" :data-label="has1h ? shortCacheWriteLabel : t('modelPlaza.price.cacheWrite')" class="whitespace-nowrap px-2 py-2 text-right font-mono tabular-nums" :class="[valueClass, { 'pr-3': !has1h }]">
            {{ formatUnitPrice(row.tier.cacheWrite, unit) }}
          </td>
          <td v-if="has1h" :data-label="longCacheWriteLabel" class="whitespace-nowrap py-2 pl-2 pr-3 text-right font-mono tabular-nums" :class="valueClass">
            {{ formatUnitPrice(row.tier.cacheWrite1h ?? row.tier.cacheWrite, unit) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { formatUnitPrice, type PriceTierRow, type PriceUnit } from './plazaCatalog'

const props = defineProps<{
  rows: PriceTierRow[]
  unit: PriceUnit
  cacheWriteRetention?: '30m-12h'
  /** 官方参考价用浅色，和实付价区分。 */
  muted?: boolean
}>()

const { t } = useI18n()

const fields = ['input', 'output', 'cacheRead'] as const
const shortCacheWriteLabel = computed(() =>
  t(props.cacheWriteRetention === '30m-12h' ? 'modelPlaza.detail.cacheWrite30m' : 'modelPlaza.detail.cacheWrite5m')
)
const longCacheWriteLabel = computed(() =>
  t(props.cacheWriteRetention === '30m-12h' ? 'modelPlaza.detail.cacheWrite12h' : 'modelPlaza.detail.cacheWrite1h')
)

const hasVariant = computed(() => props.rows.some((row) => row.variant !== ''))
const hasCacheWrite = computed(() => props.rows.some((row) => row.tier.cacheWrite != null || row.tier.cacheWrite1h != null))
/** 1 小时缓存写入价与 5 分钟不同时才单独成列。 */
const has1h = computed(() =>
  props.rows.some((row) => {
    const { cacheWrite, cacheWrite1h } = row.tier
    return cacheWrite1h != null && (cacheWrite == null || Math.abs(cacheWrite1h - cacheWrite) > Math.abs(cacheWrite) * 1e-9)
  })
)

const valueClass = computed(() =>
  props.muted ? 'text-gray-500 dark:text-neutral-400' : 'font-medium text-gray-900 dark:text-white'
)
</script>

<style scoped>
@media (max-width: 639px) {
  .plaza-tier-table { display: block; min-width: 0; }
  .plaza-tier-table thead { display: none; }
  .plaza-tier-table tbody { display: block; }
  .plaza-tier-table tr { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 8px; }
  .plaza-tier-table td, .plaza-tier-table th { padding: 4px; }
  .plaza-tier-label-wide { grid-column: 1 / -1; }
  .plaza-tier-table td[data-label] { display: flex; min-width: 0; flex-direction: column; text-align: left; white-space: normal; overflow-wrap: anywhere; }
  .plaza-tier-table td[data-label]::before { content: attr(data-label); font: 10px/1.6 sans-serif; @apply text-gray-500 dark:text-neutral-400; }
}
</style>
