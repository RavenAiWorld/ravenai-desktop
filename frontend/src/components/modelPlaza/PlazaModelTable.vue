<template>
  <div class="overflow-x-auto" data-testid="plaza-price-table">
    <table class="plaza-price-table w-full min-w-[790px] border-collapse text-sm">
      <thead>
        <tr class="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-400">
          <th scope="col" class="w-[24%] px-3 py-3 font-medium">{{ t('modelPlaza.table.model') }}</th>
          <th scope="col" class="px-3 py-3 font-medium">{{ t('modelPlaza.variant') }}</th>
          <th scope="col" class="px-3 py-3 font-medium">{{ t('modelPlaza.inputLength') }}</th>
          <th v-for="field in fields" :key="field" scope="col" class="px-3 py-3 text-right font-medium">{{ t(`modelPlaza.price.${field}`) }}</th>
          <th scope="col" class="w-8"><span class="sr-only">{{ t('modelPlaza.table.details') }}</span></th>
        </tr>
      </thead>
      <tbody v-for="row in rows" :key="row.entry.key" class="border-b border-gray-200 dark:border-neutral-700">
        <tr v-for="(price, index) in row.prices" :key="price.key"
          :data-model="index === 0 ? row.entry.model.name : undefined"
          :data-price-row="`${row.entry.model.name}:${price.key}`"
          class="group/row cursor-pointer hover:bg-teal-50/40 dark:hover:bg-teal-900/10"
          @click="$emit('open', row.entry)">
          <td v-if="index === 0" :rowspan="row.prices.length" class="px-3 py-5 align-top">
            <div class="flex items-start gap-3">
              <PlazaVendorIcon :model="row.iconModel" size="sm" />
              <div class="min-w-0">
                <button type="button" class="break-words text-left font-semibold text-gray-950 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:text-white"
                  :aria-label="t('modelPlaza.card.openDetails', { name: row.title })" @click.stop="$emit('open', row.entry)">{{ row.title }}</button>
                <div v-for="id in row.ids" :key="id" class="mt-1 flex items-start gap-1">
                  <code class="break-all text-[11px] leading-5 text-gray-500 dark:text-neutral-400">{{ id }}</code>
                  <button type="button" class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:text-teal-700 focus-visible:ring-2 focus-visible:ring-teal-600"
                    :title="t('modelPlaza.card.copyId', { id })" :aria-label="t('modelPlaza.card.copyId', { id })" @click.stop="$emit('copy', id)"><Icon name="copy" size="xs" class="h-3 w-3" /></button>
                </div>
                <div v-if="row.context" class="mt-3 text-[11px] text-gray-400 dark:text-neutral-500">{{ t('modelPlaza.card.context', { size: row.context }) }}</div>
                <div class="mt-2 text-xs text-primary-700 dark:text-primary-500">{{ row.entry.group.name }} <GroupMaintenanceBadge :status="row.entry.group.status" /> <span class="font-mono">{{ paidRate(row.entry.model, row.entry.group) }}×</span></div>
                <span v-if="row.flat" class="mt-1 block text-[11px] text-teal-700 dark:text-teal-300">{{ t('modelPlaza.features.flatContext') }}</span>
                <div v-if="row.estimate != null" class="mt-2 text-[11px] text-gray-500 dark:text-neutral-400">{{ t('modelPlaza.table.estimate') }} <span class="font-mono">{{ formatUsd(row.estimate) }}</span></div>
              </div>
            </div>
          </td>
          <td class="px-3 py-3 text-xs" :class="price.fast ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-neutral-300'">
            <span class="inline-flex items-center gap-1 whitespace-nowrap"><Icon v-if="price.fast" name="bolt" size="xs" class="h-3 w-3" />{{ price.fast ? t('modelPlaza.price.fast') : t('modelPlaza.price.standard') }}</span>
          </td>
          <td class="whitespace-nowrap px-3 py-3 font-mono text-xs text-gray-500 dark:text-neutral-400">{{ price.tier?.label || t('modelPlaza.detail.allLengths') }}</td>
          <template v-if="price.tier">
            <td v-for="field in fields" :key="field" class="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums" :data-price="field">
              <span class="font-semibold" :class="price.fast ? 'text-amber-800 dark:text-amber-300' : 'text-gray-950 dark:text-white'">{{ formatUnitPrice(price.tier[field], unit) }}</span>
              <span v-if="compare" class="mt-1 block text-[10px] text-gray-400 dark:text-neutral-500" data-official>
                {{ t('modelPlaza.price.officialLabel') }} <s>{{ formatUnitPrice(price.official?.[field], unit) }}</s>
              </span>
            </td>
          </template>
          <td v-else colspan="4" class="px-3 py-3 text-right text-sm text-gray-700 dark:text-neutral-200">{{ row.requestText || t('modelPlaza.price.noPrice') }}</td>
          <td class="pr-2 text-gray-300"><Icon name="chevronRight" size="xs" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import GroupMaintenanceBadge from '@/components/common/GroupMaintenanceBadge.vue'
import PlazaVendorIcon from './PlazaVendorIcon.vue'
import { BILLING_MODE_IMAGE, BILLING_MODE_VIDEO } from '@/constants/channel'
import {
  billingMode, entryEstimate, entryFeatures, entryTitle, formatContextSize, formatUnitPrice, formatUsd,
  officialTokenTiers, paidRate, paidRequestPrices, paidTokenTiers, vendorMeta,
  type PlazaEntry, type PriceUnit, type TokenTier, type Workload
} from './plazaCatalog'

const props = defineProps<{ entries: PlazaEntry[]; unit: PriceUnit; compare: boolean; workload: Workload }>()
defineEmits<{ open: [entry: PlazaEntry]; copy: [id: string] }>()
const { t } = useI18n()
const fields = ['input', 'output', 'cacheRead', 'cacheWrite'] as const
interface PriceRow { key: string; fast: boolean; tier: TokenTier | null; official: TokenTier | null }

function contextText(entry: PlazaEntry): string {
  const base = entry.info?.context_window ?? 0
  const max = entry.info?.max_context_window ?? 0
  if (base > 0 && max > base) return `${formatContextSize(base)}–${formatContextSize(max)}`
  const size = Math.max(base, max)
  return size > 0 ? formatContextSize(size) : ''
}
function requestText(entry: PlazaEntry): string {
  const prices = paidRequestPrices(entry.model, paidRate(entry.model, entry.group))
  const mode = billingMode(entry.model)
  const key = mode === BILLING_MODE_IMAGE ? 'perImage' : mode === BILLING_MODE_VIDEO ? 'perVideo' : 'perRequest'
  return prices.map(p => `${p.label ? p.label + ' ' : ''}${t(`modelPlaza.price.${key}`, { price: formatUsd(p.price) })}`).join(' · ')
}
const rows = computed(() => props.entries.map(entry => {
  const prices: PriceRow[] = []
  const pairedFast = entry.fast && !props.entries.some(other => other.group.id === entry.group.id && other.model.name === entry.fast?.name) ? entry.fast : null
  for (const model of [entry.model, ...(pairedFast ? [pairedFast] : [])]) {
    const fast = model === entry.fast || entry.alwaysFast
    const official = officialTokenTiers(model)
    const tiers = paidTokenTiers(model, paidRate(model, entry.group))
    tiers.forEach((tier, index) => {
      // Match by context range, not array index: official and group tiers may differ.
      const reference = official.find(candidate => candidate.minTokens <= tier.minTokens && (candidate.maxTokens == null || candidate.maxTokens > tier.minTokens)) ?? null
      prices.push({ key: `${fast ? 'fast' : 'standard'}-${index}`, fast, tier, official: reference })
    })
  }
  if (!prices.length) prices.push({ key: 'request', fast: entry.alwaysFast, tier: null, official: null })
  return {
    entry, title: entryTitle(entry), iconModel: vendorMeta(entry.vendor).iconModel || entry.model.name,
    ids: [entry.model.name, ...(pairedFast ? [pairedFast.name] : [])], prices,
    context: contextText(entry), flat: entryFeatures(entry).has('flatContext'),
    requestText: requestText(entry), estimate: entryEstimate(entry, props.workload)?.total ?? null
  }
}))
</script>

<style scoped>
.plaza-price-table tbody tr + tr { @apply border-t border-gray-100 dark:border-neutral-800; }
</style>
