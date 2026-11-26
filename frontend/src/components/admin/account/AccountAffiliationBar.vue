<template>
  <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-rv-line pb-2">
    <span class="flex shrink-0 items-center gap-1.5 text-xs font-medium text-rv-fg-3">
      <Icon name="grid" size="xs" aria-hidden="true" />
      {{ t('admin.accounts.affiliations.title') }}
    </span>
    <div
      class="col-span-3 row-start-2 flex min-w-0 items-center gap-1 overflow-x-auto py-1 sm:col-span-1 sm:col-start-2 sm:row-start-1"
      role="group"
      :aria-label="t('admin.accounts.affiliations.title')"
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
        :class="active === item.id ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'text-rv-fg-2 hover:bg-rv-surface-2'"
        :aria-pressed="active === item.id"
        :data-affiliation="item.id"
        @click="emit('select', item.id)"
      >
        <span class="max-w-44 truncate" :title="item.name">{{ item.name }}</span>
        <span class="text-xs tabular-nums opacity-70">{{ item.count }}</span>
      </button>
    </div>
    <button
      type="button"
      class="btn btn-secondary col-start-3 row-start-1 gap-1.5 px-2 py-1 text-xs"
      :title="t('admin.accounts.affiliations.manage')"
      @click="emit('manage')"
    >
      <Icon name="cog" size="sm" aria-hidden="true" />
      {{ t('admin.accounts.affiliations.manage') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AccountAffiliationSnapshot } from '@/api/admin/accounts'
import Icon from '@/components/icons/Icon.vue'

const props = defineProps<{ snapshot: AccountAffiliationSnapshot; active: string }>()
const emit = defineEmits<{ select: [id: string]; manage: [] }>()
const { t } = useI18n()

const items = computed(() => {
  const members = Object.values(props.snapshot.members)
  const counts = new Map<string, number>()
  for (const id of members) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [
    { id: '', name: t('admin.accounts.affiliations.all'), count: props.snapshot.total },
    ...props.snapshot.categories.map(category => ({ ...category, count: counts.get(category.id) ?? 0 })),
    { id: 'unassigned', name: t('admin.accounts.affiliations.unassigned'), count: props.snapshot.total - members.length }
  ]
})
</script>
