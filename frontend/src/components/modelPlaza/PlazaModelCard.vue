<!-- Copyright (C) 2023-2026 QuantumNous. AGPL-3.0-or-later.
     Vue port of New API 6f23339 pricing/components/model-card.tsx.
     Pricing, Fast variants and cache-write fields use the local API; see THIRD_PARTY_NOTICES.md. -->
<template>
  <article class="plaza-model-card" :data-model="entry.model.name">
    <div class="card-heading">
      <div class="card-identity">
        <PlazaVendorIcon :model="iconModel" size="md" />
        <div class="card-main">
          <h3><button type="button" class="plaza-card-open" :title="t('modelPlaza.card.openDetails', { name: entry.model.name })" @click="$emit('open', entry)">{{ entry.model.name }}</button></h3>
          <span class="card-group">{{ entry.group.name }} <GroupMaintenanceBadge :status="entry.group.status" /></span>
        </div>
      </div>
      <button type="button" class="card-copy" data-testid="plaza-copy" :title="t('modelPlaza.card.copyId', { id: entry.model.name })" :aria-label="t('modelPlaza.card.copyId', { id: entry.model.name })" @click="$emit('copy', entry.model.name)"><Icon name="copy" size="xs" /></button>
    </div>
    <p class="card-description" :title="entry.info?.description">{{ entry.info?.description || t('modelPlaza.card.noDescription') }}</p>
    <div class="card-billing"><span>{{ billingLabel }}</span><small v-if="tier">/ 1{{ unit }}</small></div>
    <dl v-if="tier" class="card-prices" :data-row="entry.alwaysFast ? 'fast' : 'standard'">
      <template v-for="field in priceFields" :key="field">
        <div v-if="tier[field] != null">
          <dt>{{ t(`modelPlaza.price.${field}`) }}</dt>
          <dd><strong :data-price="field">{{ formatUnitPrice(tier[field], unit) }}</strong><s v-if="compare && official?.[field] != null" data-official>{{ formatUnitPrice(official[field], unit) }}</s></dd>
        </div>
      </template>
    </dl>
    <div v-else-if="requestPrices.length" class="card-request"><div v-for="item in requestPrices" :key="item.label"><span>{{ item.label }}</span> <strong>{{ formatUsd(item.price) }}</strong> {{ requestUnit }}</div></div>
    <p v-else class="text-xs text-gray-400">{{ t('modelPlaza.price.noPrice') }}</p>
    <footer>
      <div class="card-meta">
        <div class="card-tags"><span v-if="contextText">{{ contextText }}</span><span v-if="entry.fast || entry.alwaysFast" class="fast-tag"><Icon name="bolt" size="xs" />{{ entry.alwaysFast ? t('modelPlaza.card.alwaysFast') : 'Fast' }}</span><span v-if="tiers.length > 1">{{ t('modelPlaza.card.tiered') }}</span><span v-if="entryFeatures(entry).has('flatContext')">{{ t('modelPlaza.features.flatContext') }}</span></div>
        <button type="button" class="card-details" :aria-label="t('modelPlaza.card.openDetails', { name: entry.model.name })" @click="$emit('open', entry)">{{ t('modelPlaza.table.details') }}<Icon name="chevronRight" size="xs" /></button>
      </div>
      <PlazaRouteStats v-if="entry.model.route_stats" :stats="entry.model.route_stats" :group-name="entry.group.name" />
      <p v-else class="card-stats-empty">{{ t('modelPlaza.metrics.unavailable') }}</p>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import GroupMaintenanceBadge from '@/components/common/GroupMaintenanceBadge.vue'
import PlazaRouteStats from './PlazaRouteStats.vue'
import PlazaVendorIcon from './PlazaVendorIcon.vue'
import { billingMode, entryFeatures, formatContextSize, formatUnitPrice, formatUsd, officialTokenTiers, paidRate, paidRequestPrices, paidTokenTiers, vendorMeta, type PlazaEntry, type PriceUnit } from './plazaCatalog'
const props = defineProps<{ entry: PlazaEntry; unit: PriceUnit; compare: boolean }>()
defineEmits<{ open: [entry: PlazaEntry]; copy: [id: string] }>()
const { t } = useI18n()
const priceFields = ['input', 'output', 'cacheRead', 'cacheWrite'] as const
const iconModel = computed(() => vendorMeta(props.entry.vendor).iconModel || props.entry.model.name)
const tiers = computed(() => paidTokenTiers(props.entry.model, paidRate(props.entry.model, props.entry.group)))
const tier = computed(() => tiers.value[0])
const official = computed(() => officialTokenTiers(props.entry.model)[0])
const requestPrices = computed(() => paidRequestPrices(props.entry.model, paidRate(props.entry.model, props.entry.group)))
const requestUnit = computed(() => t(`modelPlaza.price.${billingMode(props.entry.model) === 'image' ? 'unitImage' : billingMode(props.entry.model) === 'video' ? 'unitVideo' : 'unitRequest'}`))
const billingLabel = computed(() => t(`modelPlaza.filters.${billingMode(props.entry.model)}`))
const contextText = computed(() => {
  const size = Math.max(props.entry.info?.context_window ?? 0, props.entry.info?.max_context_window ?? 0)
  return size > 0 ? formatContextSize(size) : ''
})
</script>

<style scoped>
.plaza-model-card { @apply relative flex min-w-0 flex-col border p-5 transition-colors; border-color: var(--plaza-border); border-radius: var(--plaza-radius-xl); background: var(--plaza-background); }
.plaza-model-card:hover { background: color-mix(in oklch, var(--plaza-muted) 20%, var(--plaza-background)); }
.card-heading { @apply flex min-w-0 items-start justify-between gap-3; }
.card-identity { @apply flex min-w-0 items-start gap-3; }
.card-identity > span { border-radius: var(--plaza-radius-xl); background: color-mix(in oklch, var(--plaza-muted) 40%, var(--plaza-background)); box-shadow: none; }
.dark .card-identity > span { background: #f5f5f5; }
.card-main { @apply min-w-0; }
h3 { @apply min-w-0 font-mono text-[15px] font-bold leading-tight; color: var(--plaza-foreground); }
.plaza-card-open { @apply block w-full whitespace-normal text-left; overflow-wrap: anywhere; }
.card-copy, .card-details { @apply inline-flex shrink-0 items-center justify-center gap-1 text-xs transition-colors; color: var(--plaza-muted-foreground); }
.card-copy { @apply h-8 w-8 rounded; }
.card-copy:hover, .card-details:hover { color: var(--plaza-foreground); background: var(--plaza-muted); }
.card-details { @apply -mr-1 min-h-7 rounded px-1.5 font-medium; }
.card-group { @apply mt-1 block text-xs; color: var(--plaza-muted-foreground); overflow-wrap: anywhere; }
.card-billing { @apply mb-1.5 flex items-baseline gap-1.5 text-xs font-medium; color: var(--plaza-primary); }
.card-billing small, .card-prices dt { @apply text-[11px] font-normal; color: var(--plaza-muted-foreground); }
.card-prices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(60px, 100%), 1fr)); gap: 6px; }
.card-prices dd { @apply mt-0.5 flex flex-wrap items-baseline gap-x-1.5; }
.card-prices strong, .card-request strong { @apply font-mono text-sm font-semibold; color: var(--plaza-foreground); overflow-wrap: anywhere; }
.card-prices s { @apply text-[10px]; color: var(--plaza-muted-foreground); }
.card-request { @apply text-sm leading-5; color: var(--plaza-muted-foreground); }
.card-description { @apply my-3 line-clamp-2 text-[13px] leading-relaxed; color: var(--plaza-muted-foreground); }
footer { @apply mt-auto min-w-0 pt-3; }
.card-meta { @apply flex min-w-0 items-center justify-between gap-2; }
.card-stats-empty { @apply mt-1.5 border-t pt-2 text-xs; border-color: var(--plaza-border); color: var(--plaza-muted-foreground); }
.card-tags { @apply flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs; color: var(--plaza-muted-foreground); }
.fast-tag { @apply inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400; }
@media (max-width: 639px) { .plaza-model-card { @apply p-3; } .card-heading, .card-identity { gap: 10px; } .card-identity > span { width: 36px; height: 36px; border-radius: var(--plaza-radius); } .card-description { @apply my-2 line-clamp-1; } }
</style>
