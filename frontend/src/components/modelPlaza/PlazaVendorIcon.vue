<template>
  <span
    class="inline-flex shrink-0 items-center justify-center"
    :class="tileClass"
    aria-hidden="true"
  >
    <ModelIcon v-if="model" :model="model" :size="ICON[size]" />
    <Icon v-else-if="neutralIcon" :name="neutralIcon" :size="NEUTRAL_ICON_SIZE[size]" :stroke-width="1.75" />
    <ModelIcon v-else :model="model" :size="ICON[size]" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ModelIcon from '@/components/common/ModelIcon.vue'
import Icon from '@/components/icons/Icon.vue'

/**
 * 厂商图标底座。多数品牌图标是黑色，深色模式下底座保持浅色，图标才看得见。
 * 未识别品牌或「所有分组」可指定站内中性图标，随按钮文字色适配明暗与选中态。
 */
const props = withDefaults(
  defineProps<{
    /** 交给 ModelIcon 识别品牌的模型名；空串且指定 neutralIcon 时渲染中性图标。 */
    model: string
    size?: 'xs' | 'sm' | 'md' | 'lg'
    /** 浅色模式下不画底座（用在筛选按钮里）。 */
    bare?: boolean
    /** 无品牌时使用的站内中性图标（如所有分组 grid、未知/混合分组 cube）。 */
    neutralIcon?: 'grid' | 'cube'
  }>(),
  { size: 'md', bare: false }
)

const TILE = {
  xs: 'h-5 w-5 rounded-full',
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-lg',
  lg: 'h-11 w-11 rounded-lg'
} as const

const ICON = { xs: '13px', sm: '18px', md: '28px', lg: '28px' } as const

const NEUTRAL_ICON_SIZE = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'md'
} as const

const isNeutral = computed(() => !props.model && !!props.neutralIcon)

const tileClass = computed(() => [
  TILE[props.size],
  isNeutral.value
    ? 'bg-black/[0.04] ring-1 ring-inset ring-black/[0.06] dark:bg-white/[0.08] dark:ring-white/10'
    : props.bare
      ? 'bg-transparent dark:bg-white/95'
      : 'bg-gray-50 ring-1 ring-inset ring-gray-200/70 dark:bg-white/95 dark:ring-white/10'
])
</script>
