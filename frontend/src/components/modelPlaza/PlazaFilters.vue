<!-- Copyright (C) 2023-2026 QuantumNous. AGPL-3.0-or-later.
     Vue port of New API 6f23339 pricing/components/pricing-sidebar.tsx; see THIRD_PARTY_NOTICES.md. -->
<template>
  <Teleport to="body" :disabled="!compact">
    <div v-show="!compact || open" :class="{ 'plaza-filter-overlay': compact }">
      <div v-if="compact" class="plaza-filter-backdrop" aria-hidden="true" @click="open = false"></div>
      <aside ref="panel" class="plaza-filters" :class="{ 'is-mobile': compact }" :role="compact ? 'dialog' : undefined" :aria-modal="compact ? true : undefined" :aria-label="t('modelPlaza.filters.title')" data-testid="plaza-filters">
        <header class="filter-heading">
          <h2>{{ t('modelPlaza.filters.title') }}</h2>
          <button type="button" class="reset-button" :disabled="!active" data-testid="plaza-reset" @click="$emit('reset')"><Icon name="refresh" size="xs" />{{ t('modelPlaza.filters.reset') }}</button>
          <button v-if="compact" ref="closeButton" type="button" class="filter-close" :title="t('modelPlaza.detail.close')" :aria-label="t('modelPlaza.detail.close')" @click="open = false"><Icon name="x" size="sm" /></button>
        </header>
        <div class="filter-sections">
          <details open>
            <summary>{{ t('modelPlaza.group') }}<Icon name="chevronDown" size="xs" /></summary>
            <div class="filter-options" role="group" :aria-label="t('modelPlaza.group')">
              <button type="button" :aria-pressed="groupId === null" data-testid="plaza-group-all" @click="$emit('group', null)"><PlazaVendorIcon model="" size="xs" bare neutral-icon="grid" data-group-icon="all" /><span class="group-option-label">{{ t('modelPlaza.filters.allGroups') }}</span></button>
              <button v-for="item in groupItems" :key="item.group.id" type="button" :aria-pressed="groupId === item.group.id" :title="item.group.name" :data-testid="`plaza-group-${item.group.id}`" @click="$emit('group', item.group.id)"><PlazaVendorIcon :model="item.iconModel" size="xs" bare neutral-icon="cube" :data-group-icon="item.iconKind" /><span class="group-option-label">{{ item.group.name }}</span><GroupMaintenanceBadge :status="item.group.status" /><small>{{ item.group.rate_multiplier }}×</small></button>
            </div>
          </details>
          <details open>
            <summary>{{ t('modelPlaza.toolbar.allVendors') }}<Icon name="chevronDown" size="xs" /></summary>
            <div class="filter-options" role="group" :aria-label="t('modelPlaza.toolbar.vendors')">
              <button type="button" :aria-pressed="vendor === 'all'" data-testid="plaza-vendor-all" @click="vendor = 'all'">{{ t('modelPlaza.toolbar.allVendors') }}<small>{{ totalCount }}</small></button>
              <button v-for="option in vendorOptions" :key="option.vendor" type="button" :aria-pressed="vendor === option.vendor" :data-testid="`plaza-vendor-${option.vendor}`" @click="vendor = option.vendor"><PlazaVendorIcon :model="vendorMeta(option.vendor).iconModel" size="xs" bare />{{ option.vendor === 'other' ? t('modelPlaza.toolbar.otherVendor') : vendorMeta(option.vendor).label }}<small>{{ option.count }}</small></button>
            </div>
          </details>
          <details v-if="features.length" open>
            <summary>{{ t('modelPlaza.filters.tags') }}<Icon name="chevronDown" size="xs" /></summary>
            <div class="filter-options">
              <button type="button" :aria-pressed="!selectedFeatures.length" @click="selectedFeatures = []">{{ t('modelPlaza.filters.all') }}<small>{{ totalCount }}</small></button>
              <label v-for="feature in features" :key="feature" class="filter-check" :class="{ selected: selectedFeatures.includes(feature) }"><input type="checkbox" :checked="selectedFeatures.includes(feature)" :data-testid="`plaza-feature-${feature}`" @change="toggleFeature(feature)" />{{ t(`modelPlaza.features.${feature}`) }}<small>{{ entries.filter(entry => entryFeatures(entry).has(feature)).length }}</small></label>
            </div>
          </details>
          <details open>
            <summary>{{ t('modelPlaza.filters.billing') }}<Icon name="chevronDown" size="xs" /></summary>
            <div class="filter-options" role="group" :aria-label="t('modelPlaza.filters.billing')"><button v-for="mode in billingModes" :key="mode" type="button" :aria-pressed="billing === mode" :data-testid="`plaza-billing-${mode}`" @click="billing = mode">{{ t(`modelPlaza.filters.${mode}`) }}<small>{{ mode === 'all' ? totalCount : entries.filter(entry => billingMode(entry.model) === mode).length }}</small></button></div>
          </details>
        </div>
        <button v-if="compact" type="button" class="filter-apply" data-testid="plaza-filter-apply" @click="open = false">{{ t('modelPlaza.filters.apply', { count: visibleCount }) }}</button>
      </aside>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import GroupMaintenanceBadge from '@/components/common/GroupMaintenanceBadge.vue'
import type { ModelPlazaGroup } from '@/api/modelPlaza'
import PlazaVendorIcon from './PlazaVendorIcon.vue'
import { billingMode, detectGroupVendor, entryFeatures, vendorMeta, type FeatureKey, type PlazaEntry, type VendorId, type VendorSummary } from './plazaCatalog'
const props = defineProps<{ groups: ModelPlazaGroup[]; groupId: number | null; vendorOptions: VendorSummary[]; totalCount: number; visibleCount: number; features: FeatureKey[]; entries: PlazaEntry[]; active: boolean; compact: boolean }>()
defineEmits<{ group: [id: number | null]; reset: [] }>()
const open = defineModel<boolean>('open', { required: true })
const vendor = defineModel<VendorId | 'all'>('vendor', { required: true })
const selectedFeatures = defineModel<FeatureKey[]>('selectedFeatures', { required: true })
const billing = defineModel<string>('billing', { required: true })
const { t } = useI18n()
const billingModes = ['all', 'token', 'per_request', 'image', 'video']
const groupItems = computed(() =>
  props.groups.map(group => {
    const brand = detectGroupVendor(group)
    return {
      group,
      iconModel: brand === 'other' ? '' : vendorMeta(brand).iconModel,
      iconKind: brand === 'other' ? 'neutral' : brand
    }
  })
)
const panel = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
let locked = false
function toggleFeature(feature: FeatureKey) {
  selectedFeatures.value = selectedFeatures.value.includes(feature) ? selectedFeatures.value.filter(item => item !== feature) : [...selectedFeatures.value, feature]
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
  if (event.key !== 'Tab' || !panel.value) return
  const elements = Array.from(panel.value.querySelectorAll<HTMLElement>('button:not([disabled]), input, summary')).filter(element => element.getClientRects().length)
  const first = elements[0]
  const last = elements[elements.length - 1]
  if (!first) return
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
function unlock() {
  if (!locked) return
  document.body.style.overflow = previousOverflow
  window.removeEventListener('keydown', onKeydown)
  previousFocus?.focus()
  locked = false
}
watch(() => props.compact && open.value, async active => {
  if (!active) { unlock(); return }
  previousFocus = document.activeElement as HTMLElement | null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  locked = true
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  closeButton.value?.focus()
})
onBeforeUnmount(unlock)
</script>

<style scoped>
.plaza-filters { @apply min-w-0 p-3 text-sm; color: var(--plaza-foreground); background: var(--plaza-background); }
.filter-heading { @apply mb-2.5 flex min-h-7 items-center gap-2; }
.filter-heading h2 { @apply mr-auto text-sm font-bold; }
.reset-button { @apply inline-flex h-7 items-center gap-1.5 px-2 text-xs disabled:opacity-40; color: var(--plaza-muted-foreground); border-radius: var(--plaza-radius-md); }
.reset-button:not(:disabled):hover { background: var(--plaza-muted); }
.filter-sections { @apply space-y-1; }
details { @apply border-b pb-3 last:border-b-0; border-color: var(--plaza-border); }
summary { @apply flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 text-sm font-semibold marker:hidden; }
summary::-webkit-details-marker { display: none; }
details[open] > summary > svg { transform: rotate(180deg); }
.filter-options { @apply flex flex-wrap gap-1.5; }
.filter-options button, .filter-check { @apply inline-flex min-h-7 max-w-full items-center gap-1.5 border px-2 py-1 text-left text-xs font-medium transition-colors; border-radius: var(--plaza-radius-md); border-color: var(--plaza-border); color: var(--plaza-muted-foreground); background: var(--plaza-background); }
.filter-options button:hover, .filter-check:hover { background: var(--plaza-muted); color: var(--plaza-foreground); }
.filter-options button > span { overflow-wrap: anywhere; }
.filter-options button > .group-option-label { @apply min-w-0 leading-snug; }
.filter-options button[aria-pressed='true'], .filter-check.selected { border-color: color-mix(in oklch, var(--plaza-foreground) 30%, transparent); background: color-mix(in oklch, var(--plaza-foreground) 5%, var(--plaza-background)); color: var(--plaza-foreground); box-shadow: 0 1px 2px rgb(0 0 0 / 5%); }
.filter-options button[aria-pressed='true'] > :is([data-group-icon='all'], [data-group-icon='neutral']) { background: var(--plaza-background); box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--plaza-foreground) 14%, transparent); }
.filter-options small { @apply shrink-0 px-1.5 py-0.5 text-xs; border-radius: var(--plaza-radius-md); color: var(--plaza-muted-foreground); background: var(--plaza-muted); }
.filter-options button[aria-pressed='true'] small { background: var(--plaza-background); color: var(--plaza-foreground); }
.filter-check { @apply cursor-pointer; }
.filter-check input { @apply h-3 w-3 rounded border-gray-300; accent-color: var(--plaza-primary); }
.plaza-filter-overlay { @apply fixed inset-0 z-50; }
.plaza-filter-backdrop { @apply absolute inset-0 bg-black/25 backdrop-blur-sm; }
.plaza-filters.is-mobile { @apply absolute inset-y-0 left-0 flex w-full max-w-md flex-col p-5 shadow-xl; }
.is-mobile .filter-sections { @apply min-h-0 flex-1 overflow-y-auto; }
.filter-close { @apply flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800; }
.filter-apply { @apply mt-4 min-h-10 px-3 py-2 font-medium text-white; border-radius: var(--plaza-radius); background: var(--plaza-primary); }
</style>
