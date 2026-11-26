<template>
  <BaseDialog :show="!!provider" :title="`${provider?.code ?? ''} · ${t('admin.supplierHall.reviews')}`" width="wide" :z-index="110" @close="emit('close')">
    <div class="min-h-36" :aria-busy="loading">
      <p v-if="loading" role="status" class="py-6 text-sm text-gray-500">{{ t('admin.supplierHall.loading') }}</p>
      <div v-else-if="error" class="flex flex-wrap items-center justify-between gap-2" role="alert">
        <p class="break-words text-sm text-red-600">{{ error }}</p>
        <button type="button" class="btn btn-secondary" @click="reload++">{{ t('admin.supplierHall.retry') }}</button>
      </div>
      <p v-else-if="!items.length" class="grid min-h-36 place-content-center justify-items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Icon name="chat" size="lg" aria-hidden="true" />{{ t('admin.supplierHall.noReviews') }}
      </p>
      <ol v-else class="divide-y divide-gray-200 dark:divide-dark-700" data-testid="supplier-reviews">
        <li v-for="review in items" :key="review.public_id || review.floor_number" class="py-4 first:pt-1">
          <p v-if="review.removed" class="text-sm text-gray-500">#{{ review.floor_number }} · {{ t('admin.supplierHall.removedReview') }}</p>
          <template v-else>
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
              <p class="min-w-0 font-semibold [overflow-wrap:anywhere]">{{ review.author_label }} <span class="ml-1 font-normal text-gray-500 dark:text-gray-400">#{{ review.floor_number }}</span></p>
              <p class="min-w-0 text-gray-600 dark:text-gray-400"><span v-if="review.stars" class="mr-2 tabular-nums text-amber-700 dark:text-amber-300">★ {{ review.stars }}/5</span><time :datetime="review.date">{{ showDate(review.date) }}</time><span v-if="review.edited"> · {{ t('admin.supplierHall.edited') }}</span></p>
            </div>
            <p class="mt-2 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{{ review.comment }}</p>
          </template>
        </li>
      </ol>
    </div>
    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span class="text-gray-500">{{ total == null ? '' : t('admin.supplierHall.reviewCount', { count: total }) }}</span>
        <div class="flex items-center gap-2" v-if="pages > 1">
          <button class="btn btn-secondary min-h-9 min-w-9 px-2" type="button" :aria-label="t('pagination.previous')" :title="t('pagination.previous')" :disabled="loading || page <= 1" @click="page--"><Icon name="chevronLeft" size="sm" /></button>
          <span class="tabular-nums">{{ t('admin.supplierHall.reviewPage', { page, pages }) }}</span>
          <button class="btn btn-secondary min-h-9 min-w-9 px-2" type="button" :aria-label="t('pagination.next')" :title="t('pagination.next')" :disabled="loading || page >= pages" @click="page++"><Icon name="chevronRight" size="sm" /></button>
        </div>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getSupplierReviews, supplierErrorText, type SupplierReview } from '@/api/admin/supplierHall'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'

const props = defineProps<{ provider: { id: number; code: string } | null }>()
const emit = defineEmits<{ close: [] }>()
const { t, locale } = useI18n()
const page = ref(1)
const reload = ref(0)
const items = ref<SupplierReview[]>([])
const total = ref<number | null>(null)
const error = ref('')
const loading = ref(false)
const pages = computed(() => Math.max(1, Math.min(10000, Math.ceil((total.value ?? 0) / 20))))
watch(() => props.provider?.id, () => {
  page.value = 1
  total.value = null
  items.value = []
}, { flush: 'sync' })
watch([() => props.provider?.id, page, reload], async ([id, currentPage], _old, onCleanup) => {
  if (!id) return
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  loading.value = true
  error.value = ''
  try {
    const data = await getSupplierReviews(id, currentPage, controller.signal)
    if (controller.signal.aborted) return
    total.value = data.total
    if (currentPage > pages.value) {
      page.value = pages.value
      return
    }
    items.value = data.items ?? []
  } catch (cause) {
    if (!controller.signal.aborted) error.value = supplierErrorText(cause) ?? t('admin.supplierHall.failed')
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}, { immediate: true })
function showDate(raw: string) {
  const stamp = new Date(raw)
  return Number.isFinite(stamp.getTime()) ? stamp.toLocaleDateString(locale.value) : raw
}
</script>
