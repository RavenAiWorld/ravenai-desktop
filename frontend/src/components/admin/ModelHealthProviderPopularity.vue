<template>
  <span v-if="fires" class="provider-popularity" @mouseenter="show" @mouseleave="scheduleClose" @focusout="leaveFocus">
    <button ref="trigger" type="button" class="popularity-fires" data-testid="provider-popularity" :aria-label="label" :aria-expanded="open" :aria-describedby="open ? popupId : undefined" @focus="show" @click.stop="pin" @keydown.esc.stop.prevent="close">
      <span aria-hidden="true">{{ '🔥'.repeat(fires) }}</span>
    </button>
    <Teleport to="body">
      <div v-if="open" :id="popupId" ref="popup" role="tooltip" class="provider-popularity-popup" :style="position" data-testid="provider-popularity-popup" @mouseenter="cancelClose" @mouseleave="scheduleClose">
        <strong>{{ t('admin.modelHealth.popularityTitle') }} · {{ group?.platform }}</strong>
        <p>{{ rankLabel }}</p>
        <p v-if="group?.popularity?.history_partial" class="popularity-note" data-testid="provider-popularity-partial">{{ t('admin.modelHealth.popularityPartial') }}</p>
        <p v-if="bandLabel" data-testid="provider-popularity-band">{{ bandLabel }}</p>
        <p class="popularity-note">{{ t('admin.modelHealth.popularityHint') }}</p>
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModelHealthProviderGroup } from '@/api/admin/modelHealth'

const props = defineProps<{ group?: ModelHealthProviderGroup; now: number }>()
const { t } = useI18n()
const popupId = useId()
const trigger = ref<HTMLButtonElement>(), popup = ref<HTMLDivElement>()
const open = ref(false), pinned = ref(false)
const position = ref({ left: '8px', top: '8px' })
let timer: ReturnType<typeof setTimeout> | undefined

const fires = computed(() => {
  const popularity = props.group?.popularity
  return popularity?.status === 'measured' && Date.parse(popularity.expires_at) > props.now &&
    Number.isInteger(popularity.fires) && popularity.fires > 0 && popularity.fires <= 5 ? popularity.fires : 0
})
const rankLabel = computed(() => t('admin.modelHealth.popularityRank', {
  rank: props.group?.popularity?.rank ?? '-', groups: props.group?.popularity?.groups ?? '-',
  window: props.group?.popularity?.window ?? ''
}))
const label = computed(() => `${t('admin.modelHealth.popularityTitle')} · ${props.group?.platform} · ${rankLabel.value} · ${fires.value}/5`)
const bandLabel = computed(() => {
  const increment = props.group?.popularity?.increment
  if (!fires.value || increment == null || !Number.isFinite(increment) || increment <= 0 || increment > 20) return ''
  const percent = (value: number) => Number(value.toFixed(6)).toLocaleString(undefined, { maximumFractionDigits: 6 })
  return t('admin.modelHealth.popularityBand', {
    from: percent((5 - fires.value) * increment), to: percent((6 - fires.value) * increment), fires: fires.value
  })
})
function cancelClose() { if (timer) clearTimeout(timer); timer = undefined }
function scheduleClose() { cancelClose(); if (!pinned.value) timer = setTimeout(close, 180) }
async function place() {
  await nextTick()
  if (!open.value || !trigger.value || !popup.value) return
  const anchor = trigger.value.getBoundingClientRect(), box = popup.value.getBoundingClientRect()
  const top = anchor.top - box.height - 8
  position.value = {
    left: `${Math.max(8, Math.min(anchor.left + anchor.width / 2 - box.width / 2, window.innerWidth - box.width - 8))}px`,
    top: `${Math.max(8, Math.min(top >= 8 ? top : anchor.bottom + 8, window.innerHeight - box.height - 8))}px`
  }
}
function show() { cancelClose(); if (fires.value) { open.value = true; void place() } }
function close() { cancelClose(); open.value = false; pinned.value = false }
function pin() { pinned.value = !pinned.value; if (pinned.value) show(); else close() }
function outside(event: PointerEvent) {
  const target = event.target as Node
  if (!trigger.value?.contains(target) && !popup.value?.contains(target)) close()
}
function escape(event: KeyboardEvent) { if (event.key === 'Escape') close() }
function leaveFocus(event: FocusEvent) {
  if (!popup.value?.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.value) scheduleClose()
}
watch([fires, () => props.group?.popularity], () => { if (!fires.value) close(); else if (open.value) void place() }, { deep: true })
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', escape)
  window.addEventListener('resize', place)
  window.addEventListener('scroll', place, true)
})
onBeforeUnmount(() => {
  cancelClose()
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape)
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', place, true)
})
</script>

<style scoped>
.provider-popularity { display: inline-flex; flex-shrink: 0; }
.popularity-fires { display: inline-flex; align-items: center; min-height: 24px; padding: 2px 0; border-radius: 3px; white-space: nowrap; cursor: help; }
.popularity-fires > span { font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; font-size: 13px; line-height: 20px; letter-spacing: 0; }
.popularity-fires:focus-visible { outline: 2px solid #229cbd; outline-offset: 3px; }
.provider-popularity-popup { position: fixed; z-index: 90; width: 320px; max-width: calc(100vw - 16px); max-height: calc(100dvh - 16px); overflow-y: auto; border: 1px solid #263244; border-radius: 8px; background: #111827; box-shadow: 0 12px 36px #0003; padding: 12px; color: #f8fafc; font-size: 12px; line-height: 1.6; letter-spacing: 0; overflow-wrap: anywhere; }
.provider-popularity-popup strong { font-weight: 700; }
.provider-popularity-popup p { margin-top: 4px; }
.provider-popularity-popup .popularity-note { color: #cbd5e1; font-size: 11px; }
</style>
