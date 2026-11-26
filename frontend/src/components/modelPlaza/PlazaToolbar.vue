<!-- Copyright (C) 2023-2026 QuantumNous. AGPL-3.0-or-later.
     Vue port of New API 6f23339 pricing/components/pricing-toolbar.tsx; see THIRD_PARTY_NOTICES.md. -->
<template>
  <div class="plaza-toolbar">
    <div class="toolbar-count">
      <button v-if="compact" type="button" class="toolbar-button" data-testid="plaza-filter-open" @click="$emit('filters')"><Icon name="filter" size="sm" />{{ t('modelPlaza.filters.title') }}</button>
      <span><strong>{{ totalCount }}</strong> {{ t('modelPlaza.filters.models') }}</span>
    </div>
    <div class="toolbar-actions">
      <label class="compare-check"><input v-model="compare" type="checkbox" data-testid="plaza-compare" />{{ t('modelPlaza.toolbar.compare') }}</label>
      <div class="plaza-segmented" role="group" :aria-label="t('modelPlaza.toolbar.unit')">
        <button type="button" :aria-pressed="unit === 'M'" @click="unit = 'M'">/1M</button><button type="button" :aria-pressed="unit === 'K'" @click="unit = 'K'">/1K</button>
      </div>
      <label class="sort-select"><Icon name="arrowsUpDown" size="sm" /><span class="sr-only">{{ t('modelPlaza.toolbar.sort') }}</span><select v-model="sort" data-testid="plaza-sort"><option v-for="key in SORT_KEYS" :key="key" :value="key">{{ t(`modelPlaza.sort.${key}`) }}</option></select></label>
      <div v-if="!compact" class="plaza-segmented" role="group" :aria-label="t('modelPlaza.toolbar.view')">
        <button type="button" :aria-pressed="view === 'cards'" :title="t('modelPlaza.toolbar.viewCards')" :aria-label="t('modelPlaza.toolbar.viewCards')" data-testid="plaza-view-cards" @click="view = 'cards'"><Icon name="grid" size="sm" /></button>
        <button type="button" :aria-pressed="view === 'table'" :title="t('modelPlaza.toolbar.viewTable')" :aria-label="t('modelPlaza.toolbar.viewTable')" data-testid="plaza-view-table" @click="view = 'table'"><Icon name="menu" size="sm" /></button>
      </div>
      <button type="button" class="refresh-button" :title="t('modelPlaza.refresh')" :aria-label="t('modelPlaza.refresh')" :disabled="loading" @click="$emit('refresh')"><Icon name="refresh" size="sm" :class="{ 'animate-spin': loading }" /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { SORT_KEYS, type PriceUnit, type SortKey } from './plazaCatalog'
defineProps<{ totalCount: number; compact: boolean; loading: boolean }>()
defineEmits<{ filters: []; refresh: [] }>()
const sort = defineModel<SortKey>('sort', { required: true })
const view = defineModel<'cards' | 'table'>('view', { required: true })
const unit = defineModel<PriceUnit>('unit', { required: true })
const compare = defineModel<boolean>('compare', { required: true })
const { t } = useI18n()
</script>

<style scoped>
.plaza-toolbar { @apply flex min-h-14 flex-wrap items-center justify-between gap-3 border p-3 text-xs; color: var(--plaza-muted-foreground); border-color: var(--plaza-border); border-radius: var(--plaza-radius-xl); background: var(--plaza-background); }
.toolbar-count, .toolbar-actions { @apply flex min-w-0 flex-wrap items-center gap-2; }
.toolbar-count { @apply text-sm; }
.toolbar-count strong { @apply font-semibold; color: var(--plaza-foreground); }
.toolbar-button, .sort-select { @apply inline-flex h-8 max-w-full items-center gap-1.5 border px-3; border-color: var(--plaza-border); border-radius: var(--plaza-radius-md); background: var(--plaza-background); }
.sort-select select { @apply min-w-0 max-w-32 appearance-none border-0 bg-transparent p-0 pr-1 text-xs focus:ring-0; }
.sort-select option { @apply bg-white text-gray-900 dark:bg-neutral-900 dark:text-white; }
.plaza-segmented { @apply inline-flex h-8 shrink-0 items-center border p-0.5; border-color: var(--plaza-border); border-radius: var(--plaza-radius); background: color-mix(in oklch, var(--plaza-muted) 60%, var(--plaza-background)); }
.plaza-segmented button { @apply flex h-full min-w-7 items-center justify-center px-3 text-xs font-medium transition-colors; border-radius: var(--plaza-radius-md); color: var(--plaza-muted-foreground); }
.plaza-segmented button:has(svg) { padding: 0; width: 28px; }
.plaza-segmented button[aria-pressed='true'] { @apply text-white shadow-sm; background: var(--plaza-primary); }
.compare-check { @apply inline-flex cursor-pointer items-center gap-1.5 px-1 text-xs; }
.compare-check input { @apply h-3.5 w-3.5 rounded border-gray-300; accent-color: var(--plaza-primary); }
.refresh-button { @apply flex h-8 w-8 shrink-0 items-center justify-center text-gray-400 disabled:opacity-40; border-radius: var(--plaza-radius-md); }
.refresh-button:hover { background: var(--plaza-muted); }
@media (max-width: 639px) { .plaza-toolbar { @apply gap-2; } .toolbar-count { @apply w-full; } .toolbar-actions { @apply w-full justify-between gap-1; } .compare-check { @apply text-[11px]; } .sort-select select { @apply max-w-24; } }
</style>
