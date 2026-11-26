<!-- Copyright (C) 2023-2026 QuantumNous. AGPL-3.0-or-later.
     Layout port of New API 6f23339 pricing/index.tsx; see THIRD_PARTY_NOTICES.md. -->
<template>
  <div ref="plazaRoot" class="model-plaza newapi-plaza" :class="{ 'is-compact': compact }">
    <PlazaHeader v-model:query="query" :embedded="embedded" :model-count="allModels.length" :vendor-count="new Set(allModels.map(entry => entry.vendor)).size" :group-count="groups.length" />
    <div v-if="descriptionHtml" class="plaza-description mb-6 border-l-2 border-primary-500 pl-4 text-sm" v-html="descriptionHtml"></div>

    <div v-if="loading && !response" class="plaza-grid" aria-busy="true" data-testid="plaza-loading"><div v-for="n in 6" :key="n" class="h-60 animate-pulse rounded-lg bg-gray-100 dark:bg-neutral-800"></div></div>
    <div v-else-if="error && !response" role="alert" class="plaza-message text-red-600 dark:text-red-300"><p>{{ t('modelPlaza.loadFailed') }}</p><button type="button" @click="$emit('refresh')"><Icon name="refresh" size="sm" />{{ t('modelPlaza.retry') }}</button></div>
    <template v-else-if="response">
      <p v-if="error" role="status" class="mb-5 flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">{{ t('modelPlaza.staleData') }}<button type="button" class="underline" @click="$emit('refresh')">{{ t('modelPlaza.retry') }}</button></p>
      <div class="plaza-layout">
        <div class="plaza-filter-column">
          <PlazaFilters v-model:open="filtersOpen" v-model:vendor="vendor" v-model:selected-features="selectedFeatures" v-model:billing="billing" :groups="groups" :group-id="selectedGroup?.id ?? null" :vendor-options="vendorOptions" :total-count="entries.length" :visible-count="visibleEntries.length" :features="features" :entries="entries" :active="filtersActive" :compact="compact" @group="selectGroup" @reset="resetFilters" />
        </div>
        <section class="plaza-results" :aria-label="t('modelPlaza.title')">
          <PlazaToolbar v-model:sort="sort" v-model:view="view" v-model:unit="unit" v-model:compare="compare" :total-count="visibleEntries.length" :compact="compact" :loading="loading" @filters="filtersOpen = true" @refresh="$emit('refresh')" />
          <div v-if="selectedGroup" class="plaza-active-group">
            <span data-testid="plaza-group-title">{{ selectedGroup.name }}</span><span class="font-mono" data-testid="plaza-group-rate">{{ selectedGroup.rate_multiplier }}×</span>
            <GroupMaintenanceBadge :status="selectedGroup.status" />
            <button type="button" :title="t('modelPlaza.filters.allGroups')" :aria-label="t('modelPlaza.filters.allGroups')" @click="selectGroup(null)"><Icon name="x" size="xs" /></button>
          </div>
          <template v-if="visibleEntries.length">
            <div v-if="showCards" class="plaza-grid" data-testid="plaza-model-grid"><PlazaModelCard v-for="entry in pagedEntries" :key="entry.key" :entry="entry" :unit="unit" :compare="compare" @open="openEntry" @copy="copyText" /></div>
            <PlazaModelTable v-else :entries="pagedEntries" :unit="unit" :compare="compare" :workload="workload" @open="openEntry" @copy="copyText" />
            <nav class="plaza-pagination" :aria-label="t('modelPlaza.pagination.label')">
              <span>{{ t('modelPlaza.pagination.page', { page, total: pageCount }) }}</span>
              <div><button type="button" :disabled="page <= 1" data-testid="plaza-previous" @click="changePage(page - 1)"><Icon name="chevronLeft" size="xs" />{{ t('modelPlaza.pagination.previous') }}</button><button type="button" :disabled="page >= pageCount" data-testid="plaza-next" @click="changePage(page + 1)">{{ t('modelPlaza.pagination.next') }}<Icon name="chevronRight" size="xs" /></button></div>
            </nav>
          </template>
          <div v-else class="plaza-message" data-testid="plaza-empty"><Icon name="search" size="xl" class="mx-auto mb-4 text-gray-300" /><p>{{ selectedGroup?.status === 'maintenance' && !selectedGroup.models.length ? t('modelPlaza.maintenanceEmpty') : filtersActive ? t('modelPlaza.noResult') : t('modelPlaza.empty') }}</p><button v-if="filtersActive" type="button" @click="resetFilters">{{ t('modelPlaza.clearFilters') }}</button></div>
          <footer class="plaza-footer"><span>{{ t(`modelPlaza.unit.${unit}`) }}</span><span v-if="updatedText">{{ updatedText }}</span></footer>
        </section>
      </div>
    </template>
    <footer class="plaza-source"><span>New API · QuantumNous</span><a href="/model-plaza-source.tar.gz" download>{{ t('modelPlaza.sourceCode') }}</a><a href="/licenses/new-api-AGPL-3.0.txt" target="_blank" rel="noopener">AGPL-3.0</a></footer>
    <PlazaModelDrawer :entry="activeEntry" :group-entries="relatedEntries" :unit="unit" :compare="compare" :workload="workload" :api-base-url="apiBaseUrl" :is-authenticated="isAuthenticated" :peak-window="peakWindow" @close="closeEntry" @copy="copyText" @select="openEntry" />
  </div>
</template>

<script setup lang="ts">
import { desktopStorage as localStorage } from '@/desktop/storage'

import './newapiPlaza.css'
import { computed, ref, watch } from 'vue'
import { useElementSize, useMediaQuery } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import Icon from '@/components/icons/Icon.vue'
import GroupMaintenanceBadge from '@/components/common/GroupMaintenanceBadge.vue'
import PlazaHeader from './PlazaHeader.vue'
import PlazaFilters from './PlazaFilters.vue'
import PlazaToolbar from './PlazaToolbar.vue'
import PlazaModelCard from './PlazaModelCard.vue'
import PlazaModelTable from './PlazaModelTable.vue'
import PlazaModelDrawer from './PlazaModelDrawer.vue'
import type { ModelPlazaResponse } from '@/api/modelPlaza'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useClipboard } from '@/composables/useClipboard'
import { hasPeakRate, serverTimezoneLabel } from '@/utils/peak-rate'
import { FEATURE_KEYS, SCENARIO_PRESETS, SORT_KEYS, VENDORS, billingMode, buildEntries, catalogModels, entryFeatures, entryModelIds, filterEntries, isPlazaGroupVisible, matchesQuery, sortEntries, vendorSummaries, type FeatureKey, type PlazaEntry, type PriceUnit, type SortKey, type VendorId } from './plazaCatalog'

const props = defineProps<{ response: ModelPlazaResponse | null; loading: boolean; error?: boolean; embedded?: boolean; fetchedAt?: Date | null }>()
defineEmits<{ refresh: [] }>()
const { t, locale } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()
const { copyToClipboard } = useClipboard()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const apiBaseUrl = computed(() => appStore.cachedPublicSettings?.api_base_url?.trim() || '')
const descriptionHtml = computed(() => props.response?.description?.trim() ? DOMPurify.sanitize(marked.parse(props.response.description) as string) : '')
const updatedText = computed(() => props.fetchedAt ? t('modelPlaza.updatedAt', { time: props.fetchedAt.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' }) }) : '')
const PREFS_KEY = 'model-plaza:catalog-prefs:v2'
interface Prefs { view: 'cards' | 'table'; unit: PriceUnit; compare: boolean; sort: SortKey }
function readPrefs(): Partial<Prefs> {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') ?? {} } catch { return {} }
}
const saved = readPrefs()
const view = ref<'cards' | 'table'>(saved.view === 'table' ? 'table' : 'cards')
const unit = ref<PriceUnit>(saved.unit === 'K' ? 'K' : 'M')
const compare = ref(saved.compare === true)
const sort = ref<SortKey>(SORT_KEYS.includes(saved.sort as SortKey) ? saved.sort as SortKey : 'name')
watch([view, unit, compare, sort], () => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ view: view.value, unit: unit.value, compare: compare.value, sort: sort.value } satisfies Prefs)) } catch { /* Browser storage can be unavailable. */ }
})
const plazaRoot = ref<HTMLElement | null>(null)
const { width } = useElementSize(plazaRoot)
const compactViewport = useMediaQuery('(max-width: 1279px)')
const compact = computed(() => compactViewport.value || (width.value > 0 && width.value < 1152))
const showCards = computed(() => view.value === 'cards' || compact.value)
const filtersOpen = ref(false)
const workload = SCENARIO_PRESETS.agent
function readParam(name: string) { return new URLSearchParams(window.location.search).get(name)?.trim() ?? '' }
const query = ref(readParam('q'))
const initialVendor = readParam('vendor') as VendorId
const vendor = ref<VendorId | 'all'>(VENDORS.some(item => item.id === initialVendor) ? initialVendor : 'all')
const selectedFeatures = ref<FeatureKey[]>([])
const billing = ref('all')
let pendingModel = readParam('model')
const initialGroup = Number(readParam('group'))
const selectedGroupId = ref<number | null>(Number.isSafeInteger(initialGroup) && initialGroup > 0 ? initialGroup : null)
const groups = computed(() => (props.response?.groups ?? []).filter(isPlazaGroupVisible))
const allEntries = computed(() => groups.value.flatMap(buildEntries))
const allModels = computed(() => catalogModels(allEntries.value))
const selectedGroup = computed(() => groups.value.find(group => group.id === selectedGroupId.value) ?? null)
const entries = computed(() => selectedGroup.value ? allEntries.value.filter(entry => entry.group.id === selectedGroup.value?.id) : allModels.value)
const vendorOptions = computed(() => vendorSummaries(entries.value))
const features = computed(() => FEATURE_KEYS.filter(feature => entries.value.some(entry => entryFeatures(entry).has(feature))))
watch(vendorOptions, options => { if (vendor.value !== 'all' && entries.value.length && !options.some(option => option.vendor === vendor.value)) vendor.value = 'all' })
watch(features, list => { selectedFeatures.value = selectedFeatures.value.filter(feature => list.includes(feature)) })
const visibleEntries = computed(() => {
  const matching = entries.value.filter(entry => matchesQuery(entry, query.value) || [...entryFeatures(entry)].some(feature => t(`modelPlaza.features.${feature}`).toLowerCase().includes(query.value.trim().toLowerCase())))
  return sortEntries(filterEntries(matching, { query: '', vendor: vendor.value, features: selectedFeatures.value }).filter(entry => billing.value === 'all' || billingMode(entry.model) === billing.value), sort.value, workload)
})
const filtersActive = computed(() => !!query.value.trim() || vendor.value !== 'all' || selectedFeatures.value.length > 0 || billing.value !== 'all' || selectedGroup.value !== null)
const page = ref(1)
const pageSize = 20
const pageCount = computed(() => Math.max(1, Math.ceil(visibleEntries.value.length / pageSize)))
const pagedEntries = computed(() => visibleEntries.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([query, vendor, selectedFeatures, billing, sort, selectedGroupId], () => { page.value = 1 })
watch(pageCount, count => { page.value = Math.min(page.value, count) })
function changePage(next: number) {
  page.value = Math.max(1, Math.min(next, pageCount.value))
  plazaRoot.value?.querySelector('.plaza-results')?.scrollIntoView?.({ block: 'start' })
}
function clearFilters() { query.value = ''; vendor.value = 'all'; selectedFeatures.value = []; billing.value = 'all' }
function resetFilters() { selectGroup(null) }
function selectGroup(id: number | null) {
  if (id !== null && !groups.value.some(group => group.id === id)) return
  selectedGroupId.value = id
  clearFilters()
  activeKey.value = ''
  writeModelParam('', id, true)
}
function writeModelParam(model: string, groupId: number | null = selectedGroup.value?.id ?? null, resetFilters = false) {
  try {
    const url = new URL(window.location.href)
    if (groupId !== null) url.searchParams.set('group', String(groupId)); else url.searchParams.delete('group')
    if (model) url.searchParams.set('model', model); else url.searchParams.delete('model')
    if (resetFilters) { url.searchParams.delete('q'); url.searchParams.delete('vendor') }
    window.history.replaceState(window.history.state, '', url.toString())
  } catch { /* Details remain usable without history access. */ }
}
const activeKey = ref('')
const activeEntry = computed(() => allEntries.value.find(entry => entry.key === activeKey.value) ?? null)
const relatedEntries = computed(() => activeEntry.value ? allEntries.value.filter(entry => entry.model.platform === activeEntry.value!.model.platform && entry.model.name.toLowerCase() === activeEntry.value!.model.name.toLowerCase()) : [])
function openEntry(entry: PlazaEntry) { activeKey.value = entry.key; writeModelParam(entry.model.name, entry.group.id) }
function closeEntry() { activeKey.value = ''; writeModelParam('') }
watch(allEntries, list => {
  if (!pendingModel || !list.length) return
  const wanted = pendingModel.toLowerCase()
  const inGroup = list.filter(entry => !selectedGroup.value || entry.group.id === selectedGroup.value.id)
  const match = inGroup.find(entry => entry.model.name.toLowerCase() === wanted) ?? inGroup.find(entry => entryModelIds(entry).some(id => id.toLowerCase() === wanted))
  pendingModel = ''
  if (match) activeKey.value = match.key
}, { immediate: true })
const peakWindow = computed(() => {
  const group = activeEntry.value?.group
  if (!group || !hasPeakRate(group)) return ''
  const timezone = serverTimezoneLabel(appStore.cachedPublicSettings?.server_utc_offset)
  const span = `${group.peak_start}–${group.peak_end}`
  return timezone ? `${span} (${timezone})` : span
})
function copyText(text: string) { void copyToClipboard(text, t('modelPlaza.card.copied', { id: text })) }
</script>

<style scoped>
.model-plaza { letter-spacing: 0; container: model-plaza / inline-size; }
.plaza-layout { display: grid; grid-template-columns: 330px minmax(0, 1fr); gap: 16px; align-items: start; }
.plaza-filter-column { position: sticky; top: 80px; max-height: calc(100dvh - 96px); overflow-y: auto; scrollbar-width: thin; scrollbar-color: transparent transparent; border: 1px solid var(--plaza-border); border-radius: var(--plaza-radius-xl); }
.plaza-filter-column:hover { scrollbar-color: var(--plaza-border) transparent; }
.plaza-results { @apply min-w-0 space-y-4; scroll-margin-top: 88px; }
.plaza-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.plaza-active-group { @apply flex w-fit max-w-full items-center gap-2 rounded-md bg-primary-50 px-2 py-1 text-xs text-primary-700 dark:bg-primary-950/50 dark:text-primary-300; }
.plaza-active-group > span:first-child { overflow-wrap: anywhere; }
.plaza-active-group button { @apply flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-primary-100 dark:hover:bg-primary-900; }
.plaza-message { @apply py-16 text-center text-sm text-gray-500 dark:text-neutral-400; }
.plaza-message button { @apply mx-auto mt-4 inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-gray-200 px-3 font-medium hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-800; }
.plaza-pagination { @apply flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm; border-color: var(--plaza-border); color: var(--plaza-muted-foreground); }
.plaza-pagination > div { @apply flex gap-2; }
.plaza-pagination button { @apply inline-flex h-7 items-center justify-center gap-1 border px-2.5 text-xs disabled:cursor-default disabled:opacity-40; border-radius: var(--plaza-radius-md); border-color: var(--plaza-border); }
.plaza-pagination button:not(:disabled):hover { background: var(--plaza-muted); }
.plaza-footer { @apply flex flex-wrap items-center justify-between gap-2 pb-5 pt-2 text-[11px] text-gray-400 dark:text-neutral-500; }
.plaza-source { @apply flex flex-wrap justify-center gap-x-4 gap-y-2 pb-2 pt-8 text-[11px]; color: var(--plaza-muted-foreground); }
.plaza-source a:hover { color: var(--plaza-foreground); text-decoration: underline; }
.is-compact .plaza-layout { grid-template-columns: minmax(0, 1fr); }
.is-compact .plaza-filter-column { display: none; }
@container model-plaza (max-width: 1151px) { .plaza-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container model-plaza (max-width: 720px) { .plaza-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; } .plaza-pagination { justify-content: center; } }
</style>
