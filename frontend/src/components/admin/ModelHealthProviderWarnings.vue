<template>
  <span v-if="!fresh" class="warning-unknown" :title="t('admin.modelHealth.badgesUnknown')">-</span>
  <span v-else-if="warnings.length" @mouseenter="show" @mouseleave="scheduleClose" @focusout="leaveFocus">
    <button ref="trigger" type="button" class="warning-badge" :data-testid="`provider-warning-${group?.group_id ?? 'local'}`" :aria-label="t('admin.modelHealth.activeWarnings', { count: warnings.length })" :aria-expanded="open" aria-haspopup="dialog" :aria-controls="popupId" @focus="show" @click.stop="pin" @keydown.esc="close(true)">
      <Icon name="exclamationTriangle" size="xs" /><span>{{ warnings.length }}</span>
    </button>
    <Teleport to="body">
      <div v-if="open" :id="popupId" ref="popup" role="dialog" :aria-label="t('admin.modelHealth.warningTitle')" class="provider-warning-popup" :style="position" data-testid="provider-warning-popup" :data-metrics-source="local ? 'local' : 'aihub'" @mouseenter="cancelClose" @mouseleave="scheduleClose" @keydown.esc.stop="close(true)" @focusout="leaveFocus">
        <div class="warning-heading">
          <strong>{{ t('admin.modelHealth.warningTitle') }} · {{ warnings.length }}</strong>
          <span>{{ updatedLabel }}</span>
          <button type="button" :aria-label="t('common.close')" :title="t('common.close')" @click="close(true)"><Icon name="x" size="sm" /></button>
        </div>
        <p v-if="local" class="warning-hint">{{ t('admin.modelHealth.localRequests') }}</p>
        <p class="warning-hint">{{ t('admin.modelHealth.warningHint') }}</p>
        <p v-if="partial" class="warning-hint" data-testid="provider-warning-partial"><strong>{{ t('admin.modelHealth.headerPartial') }}</strong> · {{ t('admin.modelHealth.warningPartialHint') }}</p>
        <details v-for="warning in warnings" :key="warning.id" class="warning-detail" :data-testid="`provider-warning-detail-${warning.id}`" @toggle="place">
          <summary>
            <span class="warning-name">{{ name(warning.id) }}</span>
            <span v-if="worst(warning.triggers)" class="warning-value">{{ value(worst(warning.triggers)!, warning.id) }} <small>{{ windowLabel(worst(warning.triggers)!) }}</small></span>
          </summary>
          <div class="warning-causes">
            <p class="warning-hint">{{ t('admin.modelHealth.triggeredWindows') }}: {{ windows(warning).join(' · ') }}</p>
            <p v-if="warning.partial || warning.triggers.some(isPartial)" class="warning-hint">{{ t('admin.modelHealth.warningPartialWindow') }}</p>
            <div v-for="cause in causes(warning)" :key="cause.classification" class="warning-cause">
              <strong>{{ causeName(cause.classification) }}</strong><span>{{ value(cause, warning.id) }} · {{ windowLabel(cause) }}</span>
              <small>{{ number(cause.numerator) }} / {{ number(cause.denominator) }} {{ t(warning.id === 'low_tps' ? 'admin.modelHealth.warningTokensSeconds' : warning.id === 'low_cache' ? 'admin.modelHealth.warningInputTokens' : 'admin.modelHealth.warningCounts') }}</small>
              <small v-if="isPartial(cause)">{{ t('admin.modelHealth.warningObserved') }}: {{ observed(cause.observed_seconds) }}</small>
            </div>
          </div>
        </details>
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { ModelHealthProviderGroup, ModelHealthProviders, ModelHealthProviderTrigger, ModelHealthProviderWarning } from '@/api/admin/modelHealth'

const props = defineProps<{
  group?: ModelHealthProviderGroup
  source?: Pick<ModelHealthProviders, 'stale' | 'error'>
  local?: { generated_at: string; expires_at: string; warnings: ModelHealthProviderWarning[]; cause_labels: Record<string, string> }
  now: number
}>()
const { t, te } = useI18n()
const popupId = useId()
const trigger = ref<HTMLButtonElement>(), popup = ref<HTMLDivElement>()
const open = ref(false), pinned = ref(false)
const position = ref({ left: '8px', top: '8px' })
let timer: ReturnType<typeof setTimeout> | undefined
let observer: ResizeObserver | undefined
const fresh = computed(() => props.local
  ? Date.parse(props.local.generated_at) <= props.now + 30000 && Date.parse(props.local.expires_at) > props.now
  : !!props.group && !props.source?.stale && !props.source?.error &&
    Date.parse(props.group.warnings_at) <= props.now + 30000 && Date.parse(props.group.warnings_expires_at) > props.now)
const published = computed(() => (props.local?.warnings ?? props.group?.warnings ?? []).map(warning => {
  const triggers = warning.triggers.filter(item => !item.expires_at || Date.parse(item.expires_at) > props.now)
  return { ...warning, triggers, status: warning.status === 'active' && !triggers.length ? 'unknown' : warning.status }
}))
const warnings = computed(() => fresh.value ? published.value.filter(item => item.status === 'active') : [])
const isPartial = (item: ModelHealthProviderTrigger) => item.complete === false && item.available === true
const partial = computed(() => published.value.some(item => item.partial || item.status === 'partial' || item.triggers.some(isPartial)))
const updatedLabel = computed(() => {
  const minutes = Math.floor((props.now - Date.parse(props.local?.generated_at ?? props.group?.warnings_at ?? '')) / 60000)
  return !Number.isFinite(minutes) || minutes < 1 ? t('admin.modelHealth.updatedNow') : t('admin.modelHealth.updatedMinutes', { count: minutes })
})
const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 })
const name = (id: string) => te(`admin.modelHealth.providerWarningNames.${id}`) ? t(`admin.modelHealth.providerWarningNames.${id}`) : id
const causeName = (id: string) => props.local?.cause_labels[id] ?? (te(`admin.modelHealth.providerWarningCauses.${id}`) ? t(`admin.modelHealth.providerWarningCauses.${id}`) : id)
const windowLabel = (item: ModelHealthProviderTrigger) => item.window + (isPartial(item) ? ` ${t('admin.modelHealth.partialShort')}` : '')
const value = (item: ModelHealthProviderTrigger, id: string) => `${number(item.value)}${id === 'low_tps' ? ' t/s' : '%'} ${item.operator === '>=' ? '≥' : item.operator} ${number(item.threshold)}${id === 'low_tps' ? ' t/s' : '%'}`
const observed = (seconds: number) => seconds >= 3600 ? `${number(seconds / 3600)}${t('admin.modelHealth.hoursUnit')}` : `${number(seconds / 60)}${t('admin.modelHealth.minutesUnit')}`
const worst = (items: ModelHealthProviderTrigger[]) => items.reduce<ModelHealthProviderTrigger | undefined>((selected, item) =>
  !selected || (item.operator === '<' ? item.value < selected.value : item.value > selected.value) ? item : selected, undefined)
const causes = (warning: ModelHealthProviderWarning) => [...new Set(warning.triggers.map(item => item.classification))].map(id => worst(warning.triggers.filter(item => item.classification === id))!)
const windows = (warning: ModelHealthProviderWarning) => ['5m', '1h', '6h', '24h', '7d'].filter(window => warning.triggers.some(item => item.window === window)).map(window => window + (warning.triggers.some(item => item.window === window && isPartial(item)) ? ` ${t('admin.modelHealth.partialShort')}` : ''))
function cancelClose() { if (timer) clearTimeout(timer) }
function scheduleClose() { cancelClose(); if (!pinned.value) timer = setTimeout(() => close(), 180) }
async function place() {
  await nextTick()
  if (!trigger.value || !popup.value) return
  const anchor = trigger.value.getBoundingClientRect(), box = popup.value.getBoundingClientRect()
  const top = anchor.top - box.height - 10
  position.value = {
    left: `${Math.max(8, Math.min(anchor.left, window.innerWidth - box.width - 8))}px`,
    top: `${Math.max(8, Math.min(top >= 8 ? top : anchor.bottom + 10, window.innerHeight - box.height - 8))}px`
  }
}
async function show() {
  cancelClose()
  open.value = true
  await place()
  if (typeof ResizeObserver !== 'undefined' && popup.value && !observer) {
    observer = new ResizeObserver(() => { void place() })
    observer.observe(popup.value)
  }
}
function close(focus = false) {
  cancelClose()
  open.value = false
  pinned.value = false
  observer?.disconnect()
  observer = undefined
  if (focus) { trigger.value?.focus({ preventScroll: true }); open.value = false }
}
function pin() { pinned.value = !pinned.value; if (pinned.value) void show(); else close() }
function outside(event: PointerEvent) {
  const target = event.target as Node
  if (!trigger.value?.contains(target) && !popup.value?.contains(target)) close()
}
function leaveFocus(event: FocusEvent) { if (!popup.value?.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.value) scheduleClose() }
watch(() => warnings.value.length, count => { if (!count) close() })
onMounted(() => { document.addEventListener('pointerdown', outside); window.addEventListener('resize', place); window.addEventListener('scroll', place, true) })
onBeforeUnmount(() => { cancelClose(); observer?.disconnect(); document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) })
</script>

<style scoped>
.warning-badge { display: inline-flex; align-items: center; gap: 3px; border: 1px solid #f5db9c; border-radius: 5px; padding: 2px 5px; color: #a46b13; background: #fff4d6; font-size: 12px; line-height: 18px; }
.warning-badge:hover, .warning-badge:focus-visible { border-color: #c89735; outline-offset: 3px; }
.warning-unknown { color: #94a3b8; font-size: 12px; }
.provider-warning-popup { position: fixed; z-index: 90; width: 400px; max-width: calc(100vw - 16px); max-height: calc(100dvh - 16px); overflow-y: auto; border: 1px solid #263244; border-radius: 8px; background: #111827; box-shadow: 0 12px 36px #0003; padding: 16px; color: #f8fafc; font-size: 12px; line-height: 1.6; letter-spacing: 0; }
.warning-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.warning-heading strong { font-size: 14px; }
.warning-heading > span { margin-left: auto; font-size: 11px; color: #9caabb; }
.warning-heading button { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 3px; color: #cbd5e1; }
.warning-heading button:hover { background: #ffffff15; }
.warning-hint { margin: 5px 0; color: #aebdce; }
.warning-detail { border-top: 1px solid #ffffff14; margin-top: 6px; }
.warning-detail summary { display: flex; align-items: baseline; gap: 8px; padding: 6px 0; cursor: pointer; }
.warning-detail summary::before { content: '\25b8'; color: #aebdce; }
.warning-detail[open] summary::before { content: '\25be'; }
.warning-name { min-width: 0; flex: 1; font-weight: 600; }
.warning-value { flex-shrink: 0; font-variant-numeric: tabular-nums; white-space: nowrap; }
.warning-value small { margin-left: 5px; color: #aebdce; font-size: 10px; font-weight: 400; }
.warning-causes { padding: 0 0 6px 12px; }
.warning-cause { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 3px 8px; padding-top: 7px; font-variant-numeric: tabular-nums; }
.warning-cause strong { font-size: 12px; font-weight: 600; }
.warning-cause small { width: 100%; text-align: right; color: #aebdce; font-size: 11px; }
@media (max-width: 420px) { .provider-warning-popup { padding: 12px; } .warning-detail summary { flex-wrap: wrap; } .warning-value { margin-left: auto; } }
</style>
