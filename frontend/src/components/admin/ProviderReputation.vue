<template>
  <div class="provider-reputation">
    <button type="button" class="review-link" :title="t('admin.supplierHall.viewReviews')" :aria-label="t('admin.supplierHall.viewReviews') + ' · ' + name" @click="emit('reviews')"><Icon name="chat" size="xs" aria-hidden="true" />{{ t('admin.supplierHall.reviews') }}<span v-if="group?.review_count != null">{{ group.review_count }}</span></button>
    <span v-if="rating != null" class="provider-rating" :title="t('admin.supplierHall.rating')">
      <span class="rating-stars" aria-hidden="true">{{ stars }}<span :style="{ width: (rating * 20) + '%' }">{{ stars }}</span></span>
      <span>{{ rating.toLocaleString(locale, { maximumFractionDigits: 2 }) }} / 5</span>
    </span>
    <slot />
    <span v-if="warning" class="input-warning" :title="warningHint" :aria-label="warningHint"><Icon name="exclamationTriangle" size="xs" aria-hidden="true" />{{ t('admin.supplierHall.inputWarning', { excess }) }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { ModelHealthProviderGroup, ModelHealthProviderMetrics } from '@/api/admin/modelHealth'

const props = defineProps<{ group?: ModelHealthProviderGroup; name: string; warning?: ModelHealthProviderMetrics['input_warning'] }>()
const emit = defineEmits<{ reviews: [] }>()
const { t, locale } = useI18n()
const stars = '\u2605'.repeat(5)
const rating = computed(() => props.group?.stars != null && props.group.stars >= 0 && props.group.stars <= 5 ? props.group.stars : null)
const excess = computed(() => props.warning?.excess_percent.toLocaleString(locale?.value, { maximumFractionDigits: 1, signDisplay: 'always' }))
const warningHint = computed(() => props.warning && t('admin.supplierHall.inputWarningHint', {
  window: props.warning.window, multiplier: props.warning.multiplier.toFixed(2), threshold: props.warning.threshold,
}))
</script>

<style scoped>
.provider-reputation, .provider-rating, .review-link, .input-warning { display: inline-flex; align-items: center; }
.provider-reputation { flex-wrap: wrap; gap: 4px 8px; font-size: 11px; font-variant-numeric: tabular-nums; }
.review-link { gap: 4px; min-height: 24px; @apply rounded-sm text-cyan-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700 dark:text-cyan-300; }
.provider-rating { gap: 4px; white-space: nowrap; @apply text-gray-700 dark:text-gray-300; }
.rating-stars { position: relative; font-size: 14px; line-height: 1; @apply text-gray-300 dark:text-gray-600; }
.rating-stars > span { position: absolute; inset: 0 auto 0 0; overflow: hidden; color: #e6a51b; }
.input-warning { gap: 4px; padding: 2px 6px; border-radius: 4px; font-weight: 600; @apply border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300; }
</style>
