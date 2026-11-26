<!-- Copyright (C) 2023-2026 QuantumNous. AGPL-3.0-or-later.
     Shell, tabs and base-price layout ported from New API 6f23339 model-details.tsx.
     Local billing rules, price tables and calculator retained; see THIRD_PARTY_NOTICES.md. -->
<template>
  <Teleport to="body">
    <Transition name="plaza-drawer">
      <div v-if="entry" class="fixed inset-0 z-50" data-plaza-drawer>
        <div class="absolute inset-0 bg-gray-950/40 backdrop-blur-[2px] dark:bg-black/60" aria-hidden="true" @click="$emit('close')"></div>

        <section
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          class="plaza-drawer-panel absolute inset-y-0 right-0 flex w-full flex-col shadow-2xl sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl"
        >
          <!-- 头部 -->
          <header class="plaza-detail-header flex items-start gap-3 px-4 pb-4 pt-11 sm:px-6 sm:pt-12">
            <PlazaVendorIcon :model="iconModel" size="lg" />
            <div class="min-w-0 flex-1">
              <p class="mb-1 break-words text-xs font-medium text-primary-700 dark:text-primary-300">{{ entry.group.name }} <GroupMaintenanceBadge :status="entry.group.status" /></p>
              <h2 :id="titleId" class="break-words text-lg font-semibold leading-7 text-gray-950 dark:text-white">{{ title }}</h2>
              <p class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-neutral-400">
                <span>{{ vendorName }}</span>
                <span v-if="upstream" aria-hidden="true">·</span>
                <span v-if="upstream">{{ t('modelPlaza.detail.upstream', { name: upstream }) }}</span>
              </p>
            </div>
            <button
              ref="closeButton"
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
              :aria-label="t('modelPlaza.detail.close')"
              :title="t('modelPlaza.detail.close')"
              @click="$emit('close')"
            >
              <Icon name="x" size="md" />
            </button>
          </header>

          <nav class="plaza-detail-tabs" role="tablist" :aria-label="t('modelPlaza.table.details')">
            <button v-for="tab in tabs" :id="`plaza-tab-${tab.id}`" :key="tab.id" type="button" role="tab" :aria-selected="activeTab === tab.id" :aria-controls="`plaza-panel-${tab.id}`" :tabindex="activeTab === tab.id ? 0 : -1" :data-testid="`plaza-tab-${tab.id}`" @click="activeTab = tab.id" @keydown="onTabKeydown($event, tab.id)"><Icon :name="tab.icon" size="sm" />{{ tab.label }}</button>
          </nav>

          <div class="flex-1 space-y-7 overflow-y-auto px-5 py-5 sm:px-6">
            <div v-show="activeTab === 'overview'" id="plaza-panel-overview" role="tabpanel" aria-labelledby="plaza-tab-overview" class="space-y-6">
            <!-- 模型 ID 与简介 -->
            <div class="space-y-3">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="id in modelIds"
                  :key="id.name"
                  type="button"
                  class="group/id inline-flex max-w-full items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 font-mono text-[13px] text-gray-800 ring-1 ring-inset ring-gray-200 transition hover:bg-white hover:ring-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-700 dark:hover:bg-neutral-700"
                  :title="t('modelPlaza.card.copyId', { id: id.name })"
                  :aria-label="t('modelPlaza.card.copyId', { id: id.name })"
                  @click="$emit('copy', id.name)"
                >
                  <Icon v-if="id.fast" name="bolt" size="xs" class="h-3.5 w-3.5 text-amber-500" />
                  <span class="truncate">{{ id.name }}</span>
                  <Icon name="copy" size="xs" class="h-3.5 w-3.5 text-gray-400 group-hover/id:text-gray-700 dark:group-hover/id:text-white" />
                </button>
              </div>
              <p v-if="entry.aliases.length > 0" class="text-xs text-gray-500 dark:text-neutral-400">
                {{ t('modelPlaza.detail.aliases', { ids: entry.aliases.join(', ') }) }}
              </p>
              <p v-if="entry.info?.description" class="text-sm leading-6 text-gray-600 dark:text-neutral-300" lang="en">
                {{ entry.info.description }}
              </p>
            </div>

            <!-- 规格 -->
            <dl v-if="specs.length > 0" class="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-gray-200/70 ring-1 ring-gray-200/70 sm:grid-cols-4 dark:bg-neutral-700 dark:ring-neutral-700">
              <div v-for="spec in specs" :key="spec.key" class="bg-white px-3 py-2.5 dark:bg-neutral-900">
                <dt class="text-[11px] text-gray-500 dark:text-neutral-400">{{ spec.label }}</dt>
                <dd class="mt-0.5 font-mono text-sm font-semibold text-gray-900 dark:text-white">{{ spec.value }}</dd>
                <dd v-if="spec.note" class="text-[11px] text-gray-500 dark:text-neutral-400">{{ spec.note }}</dd>
              </div>
            </dl>

            <!-- 实付价格 -->
            <section class="space-y-4">
              <div v-if="baseTier" class="plaza-base-prices">
                <div v-for="field in ['input', 'output'] as const" :key="field"><span>{{ t('modelPlaza.price.' + field) }} · {{ t('modelPlaza.detail.basePrice') }}</span><strong>{{ formatUnitPrice(baseTier[field], unit) }} <small>/ 1{{ unit }}</small></strong></div>
              </div>
              <div v-if="groupPrices.some(row => row.tier)" class="space-y-3">
                <h3 class="text-sm font-semibold text-gray-950 dark:text-white">{{ t('modelPlaza.detail.groupPricing') }}</h3>
                <div class="overflow-x-auto" data-testid="plaza-group-prices"><table class="group-price-table"><thead><tr><th>{{ t('modelPlaza.group') }}</th><th>{{ t('modelPlaza.groupRate') }}</th><th v-for="field in groupPriceFields" :key="field">{{ t(`modelPlaza.price.${field}`) }}</th></tr></thead><tbody><tr v-for="row in groupPrices" :key="row.entry.key" :class="{ selected: row.entry.key === entry.key }"><th><button type="button" @click="$emit('select', row.entry)">{{ row.entry.group.name }} <GroupMaintenanceBadge :status="row.entry.group.status" /></button><small class="mobile-group-rate">{{ row.rate }}×</small></th><td class="group-rate">{{ row.rate }}×</td><td v-for="field in groupPriceFields" :key="field" :data-label="t(`modelPlaza.price.${field}`)">{{ formatUnitPrice(row.tier?.[field] ?? null, unit) }}</td></tr></tbody></table></div>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <h3 class="text-sm font-semibold text-gray-950 dark:text-white">{{ t('modelPlaza.detail.pricing') }}</h3>
                <span class="text-xs text-gray-500 dark:text-neutral-400">{{ t(`modelPlaza.unit.${unit}`) }}</span>
              </div>
              <PriceTierTable v-if="paidRows.length > 0" :rows="paidRows" :unit="unit" :cache-write-retention="cacheWriteRetention" data-testid="plaza-paid-table" />
              <ul v-else-if="requestPrices.length > 0" class="space-y-1 font-mono text-sm tabular-nums">
                <li v-for="item in requestPrices" :key="item.label" class="flex justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-neutral-800">
                  <span class="font-sans text-gray-500 dark:text-neutral-400">{{ item.label || t('modelPlaza.detail.allLengths') }}</span>
                  <span class="font-semibold text-gray-950 dark:text-white">{{ requestPriceText(item.price) }}</span>
                </li>
              </ul>
              <p v-else class="text-sm text-gray-400">{{ t('modelPlaza.price.noPrice') }}</p>

              <details class="group/official rounded-lg ring-1 ring-inset ring-gray-200 dark:ring-neutral-700" :open="compare">
                <summary
                  class="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-200"
                >
                  {{ t('modelPlaza.detail.official') }}
                  <Icon name="chevronDown" size="sm" class="text-gray-400 transition-transform group-open/official:rotate-180" />
                </summary>
                <div class="space-y-2 border-t border-gray-100 px-3 py-3 dark:border-neutral-800">
                  <PriceTierTable v-if="officialRows.length > 0" :rows="officialRows" :unit="unit" :cache-write-retention="cacheWriteRetention" muted />
                  <p v-else class="text-xs text-gray-500 dark:text-neutral-400">{{ t('modelPlaza.detail.noOfficial') }}</p>
                  <p class="text-xs text-gray-500 dark:text-neutral-400">{{ t('modelPlaza.detail.officialHint') }}</p>
                  <p v-if="entry.model.pricing_source === 'group'" class="text-xs text-gray-500 dark:text-neutral-400">
                    {{ t('modelPlaza.detail.customPriceNote') }}
                  </p>
                </div>
              </details>
            </section>

            <!-- 计费规则 -->
            <section class="space-y-2.5">
              <h3 class="text-sm font-semibold text-gray-950 dark:text-white">{{ t('modelPlaza.detail.rules') }}</h3>
              <ul class="space-y-1.5 text-[13px] leading-6 text-gray-600 dark:text-neutral-300" data-testid="plaza-rules">
                <li v-for="rule in rules" :key="rule" class="flex gap-2">
                  <span class="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-gray-400 dark:bg-neutral-500" aria-hidden="true"></span>
                  <span>{{ rule }}</span>
                </li>
              </ul>
            </section>

            </div>

            <!-- 费用估算 -->
            <section v-show="activeTab === 'calculator'" id="plaza-panel-calculator" role="tabpanel" aria-labelledby="plaza-tab-calculator" class="space-y-3" data-testid="plaza-calculator">
              <h3 class="text-sm font-semibold text-gray-950 dark:text-white">{{ t('modelPlaza.detail.calculator') }}</h3>
              <template v-if="paidRows.length > 0">
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label class="plaza-calc-field">
                    <span>{{ t('modelPlaza.detail.calcInput') }}</span>
                    <input v-model.number="calcInput" type="number" min="0" step="1000" inputmode="numeric" data-testid="plaza-calc-input" />
                  </label>
                  <label class="plaza-calc-field">
                    <span>{{ t('modelPlaza.detail.calcCacheHit') }} %</span>
                    <input v-model.number="calcCacheHit" type="number" min="0" max="100" step="5" inputmode="numeric" data-testid="plaza-calc-cache" />
                  </label>
                  <label class="plaza-calc-field">
                    <span>{{ t('modelPlaza.detail.calcOutput') }}</span>
                    <input v-model.number="calcOutput" type="number" min="0" step="100" inputmode="numeric" data-testid="plaza-calc-output" />
                  </label>
                  <label class="plaza-calc-field">
                    <span>{{ t('modelPlaza.detail.calcRequests') }}</span>
                    <input v-model.number="calcRequests" type="number" min="1" step="1" inputmode="numeric" data-testid="plaza-calc-requests" />
                  </label>
                </div>

                <div v-if="entry.fast" class="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium dark:bg-neutral-800" role="group">
                  <button
                    type="button"
                    class="rounded-md px-3 py-1"
                    :class="calcVariant === 'standard' ? 'bg-white text-gray-900 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-gray-500 dark:text-neutral-400'"
                    :aria-pressed="calcVariant === 'standard'"
                    @click="calcVariant = 'standard'"
                  >
                    {{ t('modelPlaza.price.standard') }}
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-md px-3 py-1"
                    :class="calcVariant === 'fast' ? 'bg-white text-amber-700 shadow-sm dark:bg-neutral-700 dark:text-amber-300' : 'text-gray-500 dark:text-neutral-400'"
                    :aria-pressed="calcVariant === 'fast'"
                    data-testid="plaza-calc-fast"
                    @click="calcVariant = 'fast'"
                  >
                    <Icon name="bolt" size="xs" class="h-3 w-3" />{{ t('modelPlaza.price.fast') }}
                  </button>
                </div>

                <div v-if="calcResult" class="rounded-lg bg-gray-50 p-4 dark:bg-neutral-800/60">
                  <dl class="space-y-1.5 text-[13px]">
                    <div v-for="line in calcLines" :key="line.label" class="flex items-baseline justify-between gap-3">
                      <dt class="text-gray-500 dark:text-neutral-400">
                        {{ line.label }}
                        <span class="ml-1 font-mono text-[11px] text-gray-400 dark:text-neutral-500">{{ line.detail }}</span>
                      </dt>
                      <dd class="font-mono tabular-nums text-gray-800 dark:text-neutral-100">{{ formatUsd(line.cost) }}</dd>
                    </div>
                  </dl>
                  <div class="mt-3 flex items-end justify-between gap-3 border-t border-dashed border-gray-300 pt-3 dark:border-neutral-600">
                    <div class="text-xs text-gray-500 dark:text-neutral-400">
                      <div>{{ t('modelPlaza.detail.calcPerRequest') }} <span class="font-mono text-gray-800 dark:text-neutral-100">{{ formatUsd(calcResult.total) }}</span></div>
                      <div v-if="calcResult.tier.label" class="mt-0.5">{{ t('modelPlaza.detail.calcTier', { tier: calcResult.tier.label }) }}</div>
                    </div>
                    <div class="text-right">
                      <div class="text-[11px] text-gray-500 dark:text-neutral-400">{{ t('modelPlaza.detail.calcTotal', { count: requestCount }) }}</div>
                      <div class="font-mono text-2xl font-semibold tracking-normal text-gray-950 tabular-nums dark:text-white" data-testid="plaza-calc-total">
                        {{ formatUsd(calcResult.total * requestCount) }}
                      </div>
                    </div>
                  </div>
                </div>
                <p class="text-xs text-gray-500 dark:text-neutral-400">{{ t('modelPlaza.detail.calcNote') }}</p>
              </template>
              <p v-else class="text-sm text-gray-500 dark:text-neutral-400">{{ t('modelPlaza.detail.calcUnavailable') }}</p>
            </section>

            <!-- 调用方式 -->
            <section v-show="activeTab === 'api'" id="plaza-panel-api" role="tabpanel" aria-labelledby="plaza-tab-api" class="space-y-3">
              <h3 class="text-sm font-semibold text-gray-950 dark:text-white">{{ t('modelPlaza.detail.usage') }}</h3>
              <dl class="divide-y divide-gray-100 rounded-lg ring-1 ring-inset ring-gray-200 dark:divide-neutral-800 dark:ring-neutral-700">
                <div v-if="apiBaseUrl" class="flex items-center justify-between gap-3 px-3 py-2.5">
                  <dt class="shrink-0 text-xs text-gray-500 dark:text-neutral-400">{{ t('modelPlaza.detail.baseUrl') }}</dt>
                  <dd class="flex min-w-0 items-center gap-1">
                    <code class="truncate font-mono text-[13px] text-gray-900 dark:text-white">{{ apiBaseUrl }}</code>
                    <button type="button" class="plaza-copy-btn" :aria-label="t('modelPlaza.detail.copy')" :title="t('modelPlaza.detail.copy')" @click="$emit('copy', apiBaseUrl)">
                      <Icon name="copy" size="xs" />
                    </button>
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3 px-3 py-2.5">
                  <dt class="shrink-0 text-xs text-gray-500 dark:text-neutral-400">{{ t('modelPlaza.detail.modelId') }}</dt>
                  <dd class="flex min-w-0 items-center gap-1">
                    <code class="truncate font-mono text-[13px] text-gray-900 dark:text-white">{{ entry.model.name }}</code>
                    <button type="button" class="plaza-copy-btn" :aria-label="t('modelPlaza.detail.copy')" :title="t('modelPlaza.detail.copy')" @click="$emit('copy', entry.model.name)">
                      <Icon name="copy" size="xs" />
                    </button>
                  </dd>
                </div>
              </dl>
              <RouterLink
                :to="isAuthenticated ? '/keys' : { path: '/login', query: { redirect: '/keys' } }"
                class="inline-flex h-10 items-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
              >
                <Icon name="key" size="sm" />
                {{ isAuthenticated ? t('modelPlaza.detail.createKey') : t('modelPlaza.detail.loginToCreateKey') }}
              </RouterLink>
            </section>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import GroupMaintenanceBadge from '@/components/common/GroupMaintenanceBadge.vue'
import PlazaVendorIcon from './PlazaVendorIcon.vue'
import { BILLING_MODE_IMAGE, BILLING_MODE_VIDEO } from '@/constants/channel'
import PriceTierTable from './PlazaPriceTierTable.vue'
import {
  billingMode,
  combineRates,
  entryEstimate,
  entryFeatures,
  entryTitle,
  estimateCost,
  formatContextSize,
  formatTokenCount,
  formatUnitPrice,
  formatUsd,
  officialTokenTiers,
  paidRate,
  paidRequestPrices,
  paidTokenTiers,
  reasoningMultipliers,
  upstreamModelName,
  vendorMeta,
  type PlazaEntry,
  type PriceTierRow,
  type PriceUnit,
  type Workload
} from './plazaCatalog'

const props = defineProps<{
  entry: PlazaEntry | null
  groupEntries?: PlazaEntry[]
  unit: PriceUnit
  /** 估算器的初始用量（当前估价场景）。 */
  workload: Workload
  apiBaseUrl: string
  isAuthenticated: boolean
  /** 分组高峰时段说明（含时区），未启用高峰为空串。 */
  peakWindow: string
  compare: boolean
}>()

const emit = defineEmits<{
  close: []
  copy: [text: string]
  select: [entry: PlazaEntry]
}>()

const { t } = useI18n()
type DetailTab = 'overview' | 'calculator' | 'api'
const activeTab = ref<DetailTab>('overview')
const tabs = computed(() => [
  { id: 'overview' as const, icon: 'eye' as const, label: t('modelPlaza.detail.overview') },
  { id: 'calculator' as const, icon: 'calculator' as const, label: t('modelPlaza.detail.calculator') },
  { id: 'api' as const, icon: 'terminal' as const, label: 'API' }
])
function onTabKeydown(event: KeyboardEvent, current: DetailTab) {
  const index = tabs.value.findIndex(tab => tab.id === current)
  const next = event.key === 'ArrowRight' ? (index + 1) % tabs.value.length : event.key === 'ArrowLeft' ? (index + tabs.value.length - 1) % tabs.value.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.value.length - 1 : -1
  if (next < 0) return
  event.preventDefault()
  activeTab.value = tabs.value[next].id
  void nextTick(() => document.getElementById(`plaza-tab-${activeTab.value}`)?.focus())
}

const titleId = 'plaza-drawer-title'

const panel = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
let restoreFocus: HTMLElement | null = null

const entry = computed(() => props.entry)
const cacheWriteRetention = computed(() =>
  /^gpt-6\.1-terra(?:-fast)?$/.test(entry.value?.model.name ?? '') ? '30m-12h' as const : undefined
)

const title = computed(() => (entry.value ? entryTitle(entry.value) : ''))
const iconModel = computed(() =>
  entry.value ? vendorMeta(entry.value.vendor).iconModel || entry.value.model.name : ''
)
const vendorName = computed(() => {
  if (!entry.value) return ''
  return entry.value.vendor === 'other' ? t('modelPlaza.toolbar.otherVendor') : vendorMeta(entry.value.vendor).label
})
const upstream = computed(() => (entry.value ? upstreamModelName(entry.value.model) : ''))

const modelIds = computed(() => {
  if (!entry.value) return []
  const ids = [{ name: entry.value.model.name, fast: entry.value.alwaysFast }]
  if (entry.value.fast) ids.push({ name: entry.value.fast.name, fast: true })
  return ids
})

const MODALITY_KEYS = ['text', 'image', 'audio', 'video', 'pdf'] as const

const specs = computed(() => {
  const info = entry.value?.info
  if (!info) return []
  const list: Array<{ key: string; label: string; value: string; note?: string }> = []
  const base = info.context_window ?? 0
  const max = info.max_context_window ?? 0
  if (base > 0 || max > 0) {
    list.push({
      key: 'context',
      label: t('modelPlaza.detail.contextWindow'),
      value: formatContextSize(base > 0 ? base : max),
      note: base > 0 && max > base ? t('modelPlaza.detail.contextExtended', { size: formatContextSize(max) }) : undefined
    })
  }
  if (info.max_output_tokens) {
    list.push({ key: 'output', label: t('modelPlaza.detail.maxOutput'), value: formatContextSize(info.max_output_tokens) })
  }
  if (info.reasoning) {
    list.push({ key: 'reasoning', label: t('modelPlaza.detail.reasoning'), value: t('modelPlaza.detail.supported') })
  }
  const modalities = (info.input_modalities ?? []).filter((m): m is (typeof MODALITY_KEYS)[number] =>
    (MODALITY_KEYS as readonly string[]).includes(m)
  )
  if (modalities.length > 0) {
    list.push({
      key: 'modalities',
      label: t('modelPlaza.detail.inputTypes'),
      value: modalities.map((m) => t(`modelPlaza.detail.modalities.${m}`)).join(' · ')
    })
  }
  return list
})

function variantLabel(kind: 'standard' | 'fast'): string {
  return kind === 'fast' ? t('modelPlaza.price.fast') : t('modelPlaza.price.standard')
}

/** 标准 / Fast × 上下文档位，展开成价格表的行。 */
function tierRows(official: boolean): PriceTierRow[] {
  if (!entry.value) return []
  const { model, fast, alwaysFast, group } = entry.value
  const variants: Array<{ kind: 'standard' | 'fast'; model: typeof model }> = [
    { kind: alwaysFast ? 'fast' : 'standard', model }
  ]
  if (fast) variants.push({ kind: 'fast', model: fast })
  const labelled = variants.length > 1 || alwaysFast
  return variants.flatMap(({ kind, model: m }) => {
    const tiers = official ? officialTokenTiers(m) : paidTokenTiers(m, paidRate(m, group))
    return tiers.map((tier, index) => ({
      key: `${kind}-${index}`,
      variant: labelled ? variantLabel(kind) : '',
      fast: kind === 'fast',
      tierLabel: tier.label || t('modelPlaza.detail.allLengths'),
      tier
    }))
  })
}

const paidRows = computed(() => tierRows(false))
const officialRows = computed(() => tierRows(true))
const baseTier = computed(() => entry.value ? paidTokenTiers(entry.value.model, 1)[0] : null)
const groupPriceFields = ['input', 'output', 'cacheRead', 'cacheWrite'] as const
const groupPrices = computed(() => (props.groupEntries?.length ? props.groupEntries : entry.value ? [entry.value] : []).map(item => ({ entry: item, rate: paidRate(item.model, item.group), tier: paidTokenTiers(item.model, paidRate(item.model, item.group))[0] })))

const requestPrices = computed(() =>
  entry.value ? paidRequestPrices(entry.value.model, paidRate(entry.value.model, entry.value.group)) : []
)

function requestPriceText(price: number): string {
  if (!entry.value) return ''
  const mode = billingMode(entry.value.model)
  const key = mode === BILLING_MODE_IMAGE ? 'perImage' : mode === BILLING_MODE_VIDEO ? 'perVideo' : 'perRequest'
  return t(`modelPlaza.price.${key}`, { price: formatUsd(price) })
}

function formatWindow(start: string, end: string): string {
  const clock = (v: string) => v.replace(/^(\d{2}:\d{2}):00$/, '$1')
  return `${clock(start)}–${clock(end)}`
}

const rules = computed(() => {
  if (!entry.value) return []
  const { model, fast, alwaysFast, group } = entry.value
  const list: string[] = [t('modelPlaza.detail.ruleRate', { rate: paidRate(model, group) })]
  const tiers = paidTokenTiers(model, 1)
  if (tiers.length > 1 && tiers[0].maxTokens != null) {
    const threshold = formatContextSize(tiers[0].maxTokens)
    list.push(
      model.long_context_basis === 'marginal'
        ? t('modelPlaza.detail.ruleMarginal', { threshold })
        : t('modelPlaza.detail.ruleWholeRequest', { threshold })
    )
  }
  if (entryFeatures(entry.value).has('flatContext')) list.push(t('modelPlaza.detail.ruleFlat'))
  if (alwaysFast) list.push(t('modelPlaza.detail.ruleAlwaysFast'))
  if (fast) list.push(t('modelPlaza.detail.ruleFast', { id: fast.name }))
  if (model.pricing_note === 'route_dependent') list.push(t('modelPlaza.detail.ruleRoute'))
  if (props.peakWindow) {
    list.push(t('modelPlaza.detail.rulePeak', { window: props.peakWindow, multiplier: group.peak_rate_multiplier }))
  }
  const schedule = model.time_pricing
  for (const period of schedule?.periods ?? []) {
    list.push(
      t(schedule?.weekdays_only ? 'modelPlaza.detail.ruleTimePricingWeekdays' : 'modelPlaza.detail.ruleTimePricing', {
        timezone: schedule?.timezone ?? '',
        window: formatWindow(period.start_time, period.end_time),
        multiplier: combineRates(paidRate(model, group), period.multiplier)
      })
    )
  }
  for (const [effort, multiplier] of reasoningMultipliers(model)) {
    list.push(t('modelPlaza.detail.ruleReasoning', { effort, multiplier }))
  }
  return list
})

// ── 估算器 ──

const calcInput = ref(0)
const calcCacheHit = ref(0)
const calcOutput = ref(0)
const calcRequests = ref(1)
const calcVariant = ref<'standard' | 'fast'>('standard')

const requestCount = computed(() => Math.max(1, Math.round(Number(calcRequests.value) || 1)))

const calcResult = computed(() => {
  if (!entry.value) return null
  const workload: Workload = {
    input: Number(calcInput.value) || 0,
    cacheHit: Math.min(100, Math.max(0, Number(calcCacheHit.value) || 0)) / 100,
    output: Number(calcOutput.value) || 0
  }
  if (calcVariant.value === 'fast' && entry.value.fast) return entryEstimate(entry.value, workload, true)
  const model = entry.value.model
  return estimateCost(paidTokenTiers(model, paidRate(model, entry.value.group)), workload, model.long_context_basis)
})

const calcLines = computed(() => {
  const result = calcResult.value
  if (!result) return []
  const lines = [
    {
      label: t('modelPlaza.detail.calcUncached'),
      detail: formatTokenCount(Math.round(result.uncachedTokens)),
      cost: result.uncachedCost
    },
    {
      label: t('modelPlaza.detail.calcOutputLine'),
      detail: formatTokenCount(Math.round(result.outputTokens)),
      cost: result.outputCost
    }
  ]
  if (result.cachedTokens > 0) {
    lines.splice(1, 0, {
      label: t('modelPlaza.detail.calcCached'),
      detail: formatTokenCount(Math.round(result.cachedTokens)),
      cost: result.cachedCost
    })
  }
  return lines
})

function resetCalculator() {
  calcInput.value = props.workload.input
  calcCacheHit.value = Math.round(props.workload.cacheHit * 100)
  calcOutput.value = props.workload.output
  calcRequests.value = 1
  calcVariant.value = 'standard'
}

// ── 打开 / 关闭 ──

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary'

/** Esc 关闭；Tab 在面板内循环，焦点不落到背后的页面。 */
function onKeydown(event: KeyboardEvent) {
  if (!props.entry) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !panel.value) return
  const focusables = Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(element => element.getClientRects().length > 0)
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement
  if (!panel.value.contains(active)) {
    event.preventDefault()
    first.focus()
  } else if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function setOpen(open: boolean) {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
}

watch(
  () => props.entry?.key,
  async (key, previous) => {
    if (key) {
      resetCalculator()
      if (!previous) {
        activeTab.value = 'overview'
        restoreFocus = (document.activeElement as HTMLElement | null) ?? null
        setOpen(true)
      }
      await nextTick()
      closeButton.value?.focus()
      panel.value?.querySelector('.overflow-y-auto')?.scrollTo?.({ top: 0 })
    } else if (previous) {
      setOpen(false)
      restoreFocus?.focus?.()
      restoreFocus = null
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (props.entry) setOpen(false)
})
</script>

<style scoped>
.plaza-drawer-panel { background: var(--plaza-background); }
.plaza-detail-header > button { position: absolute; top: 8px; right: 8px; }
.plaza-detail-tabs { @apply mx-5 flex shrink-0 gap-1 p-1 sm:mx-6; background: var(--plaza-muted); border-radius: var(--plaza-radius); }
.plaza-detail-tabs button { @apply flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 px-3 text-xs sm:text-sm; color: var(--plaza-muted-foreground); border-radius: var(--plaza-radius-md); }
.plaza-detail-tabs button[aria-selected='true'] { @apply font-medium shadow-sm; color: var(--plaza-foreground); background: var(--plaza-background); }
.plaza-base-prices { @apply grid grid-cols-2 gap-3; }
.plaza-base-prices > div { @apply flex min-w-0 flex-col gap-2 border p-4; border-color: var(--plaza-border); border-radius: var(--plaza-radius); background: color-mix(in oklch, var(--plaza-muted) 30%, var(--plaza-background)); }
.plaza-base-prices span { @apply text-xs text-gray-500 dark:text-neutral-400; }
.plaza-base-prices strong { @apply flex flex-wrap items-baseline gap-x-1 font-mono text-lg font-semibold text-gray-950 dark:text-white; }
.plaza-base-prices small { @apply text-[10px] font-normal text-gray-400; }
.group-price-table { @apply w-full border-collapse whitespace-nowrap text-left text-xs; }
.group-price-table th, .group-price-table td { @apply border-b border-gray-100 px-3 py-4 dark:border-neutral-800; }
.group-price-table th { @apply font-medium text-gray-500 dark:text-neutral-400; }
.group-price-table td { @apply text-right font-mono text-gray-900 dark:text-neutral-200; }
.group-price-table th:not(:first-child) { @apply text-right; }
.group-price-table tbody th { @apply text-primary-700 dark:text-primary-500; }
.group-price-table .selected { @apply bg-primary-50/70 dark:bg-primary-950/30; }
.group-price-table button { @apply rounded-sm text-left focus-visible:ring-2 focus-visible:ring-primary-500; }
.mobile-group-rate { display: none; }
@media (max-width: 639px) {
  .group-price-table { @apply whitespace-normal; }
  .group-price-table thead, .group-price-table .group-rate { display: none; }
  .group-price-table tbody { display: grid; }
  .group-price-table tr { @apply grid grid-cols-2 border-b border-gray-100 px-3 pb-3 dark:border-neutral-800; }
  .group-price-table th { @apply col-span-2 flex items-center justify-between gap-2 border-0 px-0 py-3; }
  .group-price-table button { overflow-wrap: anywhere; }
  .group-price-table td { @apply flex flex-col gap-1 border-0 px-0 py-2 text-left; }
  .group-price-table td::before { @apply font-sans text-[11px] text-gray-500 dark:text-neutral-400; content: attr(data-label); }
  .mobile-group-rate { @apply inline shrink-0 font-mono text-[11px] text-gray-500 dark:text-neutral-400; }
}
.plaza-drawer-enter-active,
.plaza-drawer-leave-active {
  transition: opacity 200ms ease;
}

.plaza-drawer-enter-active .plaza-drawer-panel,
.plaza-drawer-leave-active .plaza-drawer-panel {
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.plaza-drawer-enter-from,
.plaza-drawer-leave-to {
  opacity: 0;
}

.plaza-drawer-enter-from .plaza-drawer-panel,
.plaza-drawer-leave-to .plaza-drawer-panel {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .plaza-drawer-enter-active,
  .plaza-drawer-leave-active,
  .plaza-drawer-enter-active .plaza-drawer-panel,
  .plaza-drawer-leave-active .plaza-drawer-panel {
    transition: none;
  }
}

.plaza-calc-field {
  @apply flex flex-col gap-1 rounded-lg bg-white px-3 py-2 ring-1 ring-inset ring-gray-200 focus-within:ring-2 focus-within:ring-primary-500 dark:bg-neutral-900 dark:ring-neutral-700;
}

.plaza-calc-field span {
  @apply text-[11px] text-gray-500 dark:text-neutral-400;
}

.plaza-calc-field input {
  @apply w-full border-0 bg-transparent p-0 font-mono text-sm font-semibold text-gray-900 focus:outline-none focus:ring-0 dark:text-white;
}

.plaza-copy-btn {
  @apply flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800 dark:hover:text-white;
}

summary::-webkit-details-marker {
  display: none;
}
</style>
