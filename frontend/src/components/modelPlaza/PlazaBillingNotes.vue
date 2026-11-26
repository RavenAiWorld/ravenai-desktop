<template>
  <details
    class="group/notes border-t border-gray-200 py-5 dark:border-neutral-700"
    aria-labelledby="plaza-notes-title"
  >
    <summary id="plaza-notes-title" class="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-gray-700 marker:hidden dark:text-neutral-200">
      {{ t('modelPlaza.notes.title') }}
      <Icon name="chevronDown" size="sm" class="text-gray-400 transition-transform group-open/notes:rotate-180" />
    </summary>
    <dl class="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2">
      <div v-for="item in items" :key="item.title">
        <dt class="text-[13px] font-medium text-gray-900 dark:text-neutral-100">{{ item.title }}</dt>
        <dd class="mt-1 text-[13px] leading-6 text-gray-600 dark:text-neutral-300">{{ item.body }}</dd>
      </div>
    </dl>
    <p v-if="anonymous" class="mt-4 text-xs text-gray-500 dark:text-neutral-400">{{ t('modelPlaza.anonymousHint') }}</p>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'

defineProps<{
  /** 未登录时提示登录可见更多分组。 */
  anonymous: boolean
}>()

const { t } = useI18n()

const items = computed(() => [
  { title: t('modelPlaza.notes.rateTitle'), body: t('modelPlaza.notes.rateBody') },
  { title: t('modelPlaza.notes.cacheTitle'), body: t('modelPlaza.notes.cacheBody') },
  { title: t('modelPlaza.notes.contextTitle'), body: t('modelPlaza.notes.contextBody') },
  { title: t('modelPlaza.notes.fastTitle'), body: t('modelPlaza.notes.fastBody') }
])
</script>
