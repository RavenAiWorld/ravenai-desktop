<template>
  <span v-if="status === 'maintenance'" class="inline-flex shrink-0 items-center whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-tight text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{{ t('common.groupMaintenance') }}</span>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { GroupStatus } from '@/types'

defineProps<{ status?: GroupStatus }>()
const { t } = useI18n()
</script>
