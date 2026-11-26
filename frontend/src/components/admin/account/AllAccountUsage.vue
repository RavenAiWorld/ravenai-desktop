<template>
  <button type="button" class="btn btn-secondary" data-testid="query-all-usage" :disabled="running" @click="start()">
    <Icon name="refresh" size="sm" :class="{ 'animate-spin': running }" />
    {{ running ? t('admin.accounts.allUsage.progress', counts) : t('admin.accounts.allUsage.queryAll') }}
  </button>
  <button v-if="rows.length || running || error" type="button" class="btn btn-secondary" @click="show = true">{{ t('admin.accounts.allUsage.results') }}</button>
  <BaseDialog :show="show" :title="t('admin.accounts.allUsage.title')" width="wide" @close="show = false">
    <p class="mb-4 text-sm text-gray-500 dark:text-dark-400">{{ t('admin.accounts.allUsage.hint') }}</p>
    <div class="mb-3 flex flex-wrap gap-3 text-sm" role="status" aria-live="polite">
      <span v-if="discovering">{{ t('admin.accounts.allUsage.discovering') }}</span>
      <span v-else>{{ t('admin.accounts.allUsage.progress', counts) }}</span>
      <span>{{ t('admin.accounts.allUsage.summary', counts) }}</span>
    </div>
    <progress class="mb-4 h-2 w-full accent-primary-500" :value="counts.completed" :max="counts.total || 1" :aria-label="t('admin.accounts.allUsage.queryAll')" />
    <p v-if="error" role="alert" class="mb-3 text-sm text-red-600">{{ error }}</p>
    <p v-if="!running && !error && !rows.length" class="text-sm text-gray-500">{{ t('admin.accounts.allUsage.empty') }}</p>
    <div v-if="rows.length" class="max-h-96 overflow-auto">
      <table class="w-full text-left text-sm">
        <thead class="sticky top-0 bg-white dark:bg-dark-800"><tr>
          <th class="p-2">{{ t('admin.accounts.columns.name') }}</th>
          <th class="p-2">{{ t('admin.accounts.columns.status') }}</th>
        </tr></thead>
        <tbody><tr v-for="row in visibleRows" :key="row.account.id" class="border-t border-gray-100 dark:border-dark-700">
          <td class="p-2"><span class="font-medium">{{ row.account.name }}</span><span class="ml-2 text-xs text-gray-400">#{{ row.account.id }} · {{ row.account.platform }}</span></td>
          <td class="p-2" :class="row.state === 'failed' ? 'text-red-600' : ''">
            {{ t(`admin.accounts.allUsage.${row.local && row.state === 'success' ? 'local' : row.state}`) }}
            <span v-if="row.message" class="block max-w-md break-words text-xs">{{ row.state === 'skipped' ? t(`admin.accounts.allUsage.${row.message}`) : row.message }}</span>
          </td>
        </tr></tbody>
      </table>
    </div>
    <div v-if="rows.length > pageSize" class="mt-3 flex items-center justify-end gap-3 text-sm">
      <button :disabled="page === 1" class="btn btn-secondary btn-sm" @click="page--">{{ t('admin.accounts.allUsage.previousPage') }}</button>
      <span>{{ page }} / {{ Math.ceil(rows.length / pageSize) }}</span>
      <button :disabled="page * pageSize >= rows.length" class="btn btn-secondary btn-sm" @click="page++">{{ t('admin.accounts.allUsage.nextPage') }}</button>
    </div>
    <template #footer>
      <button v-if="running" type="button" class="btn btn-secondary" :disabled="stopping" @click="stop()">{{ t(stopping ? 'admin.accounts.allUsage.stopping' : 'admin.accounts.allUsage.stop') }}</button>
      <button v-if="!running && counts.failed" type="button" class="btn btn-secondary" data-testid="retry-usage" @click="start(true)">{{ t('admin.accounts.allUsage.retry') }}</button>
      <button v-if="!running" type="button" class="btn btn-primary" @click="start()">{{ t('admin.accounts.allUsage.queryAll') }}</button>
      <button type="button" class="btn btn-secondary" @click="show = false">{{ t('common.close') }}</button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import { useAllAccountUsage } from '@/composables/useAllAccountUsage'
import { queryAccountUsage } from '@/utils/queryAccountUsage'
import type { AccountUsageInfo } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'

const emit = defineEmits<{ 'usage-updated': [id: number, usage: AccountUsageInfo]; completed: []; busy: [value: boolean] }>()
const { t } = useI18n()
const show = ref(false)
const page = ref(1)
const pageSize = 30
let disposed = false
const { rows, counts, running, discovering, stopping, error, run, stop } = useAllAccountUsage({
  list: adminAPI.accounts.list,
  query: queryAccountUsage,
  onUsage: (id, usage) => { if (!disposed) emit('usage-updated', id, usage) }
})
const visibleRows = computed(() => rows.value.slice((page.value - 1) * pageSize, page.value * pageSize))
async function start(retry = false) {
  if (running.value) return
  show.value = true
  page.value = 1
  emit('busy', true)
  await run(retry)
  if (!disposed) { emit('busy', false); emit('completed') }
}
onUnmounted(() => { disposed = true; stop() })
</script>
