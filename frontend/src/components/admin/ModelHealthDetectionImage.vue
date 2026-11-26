<template>
  <span ref="container" class="detection-image">
    <img v-if="imageURL && !failed" :src="imageURL" :alt="title" @error="failed = true" />
    <span v-else-if="failed" role="status" class="image-message">{{ t('admin.modelHealth.imageFailed') }}</span>
    <Icon v-else-if="visible" name="refresh" size="sm" class="animate-spin text-gray-400" :aria-label="t('common.loading')" />
  </span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { getModelHealthImage } from '@/api/admin/modelHealth'
import { getSupplierImage } from '@/api/admin/supplierHall'

const props = defineProps<{ accountId?: number; supplierId?: number; source: string; title: string; preview?: boolean; lazy?: boolean }>()
const { t } = useI18n()
const imageURL = ref(''), failed = ref(false)
const container = ref<HTMLElement>()
const visible = ref(!props.lazy)
let observer: IntersectionObserver | undefined
let controller: AbortController | undefined
onMounted(() => {
  if (!props.lazy || typeof IntersectionObserver === 'undefined' || !container.value) {
    visible.value = true
    return
  }
  observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return
    visible.value = true
    observer?.disconnect()
  }, { rootMargin: '180px' })
  observer.observe(container.value)
})
function clearImage() {
  if (imageURL.value) URL.revokeObjectURL(imageURL.value)
  imageURL.value = ''
}
watch(() => [visible.value, props.accountId, props.supplierId, props.source, props.preview] as const, async () => {
  controller?.abort()
  clearImage()
  failed.value = false
  if (!visible.value) return
  const request = new AbortController()
  controller = request
  try {
    const blob = props.supplierId
      ? await getSupplierImage(props.supplierId, !!props.preview, props.source, request.signal)
      : await getModelHealthImage(props.accountId!, !!props.preview, props.source, request.signal)
    if (!request.signal.aborted) imageURL.value = URL.createObjectURL(blob)
  } catch {
    if (!request.signal.aborted) failed.value = true
  }
}, { immediate: true })
onBeforeUnmount(() => { observer?.disconnect(); controller?.abort(); clearImage() })
</script>

<style scoped>
.detection-image { display: grid; width: 100%; height: 100%; min-height: 1rem; place-items: center; }
.detection-image > img { display: block; }
.image-message { display: grid; place-items: center; min-height: 48px; padding: 4px; color: #7890a8; font-size: 11px; }
</style>
