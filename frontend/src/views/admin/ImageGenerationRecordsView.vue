<template>
  <AppLayout>
    <TablePageLayout>
      <template #filters>
        <div class="flex flex-wrap items-center gap-3">
          <input
            v-model="search" type="search" maxlength="128"
            class="input min-w-0 flex-1 sm:max-w-72"
            :placeholder="t('admin.imageRecords.search')"
            :aria-label="t('admin.imageRecords.search')"
            @input="debounceSearch"
          />
          <input
            v-model="userId" type="number" min="1" step="1"
            class="input w-full sm:w-32"
            :placeholder="t('admin.imageRecords.userId')"
            :aria-label="t('admin.imageRecords.userId')"
            @change="applyFilters"
          />
          <Select v-model="source" :options="sourceOptions" :aria-label="t('admin.imageRecords.allSources')" class="w-full sm:w-44" @change="applyFilters" />
          <Select v-model="status" :options="statusOptions" :aria-label="t('admin.imageRecords.allStatuses')" class="w-full sm:w-36" @change="applyFilters" />
          <DateRangePicker v-model:start-date="startDate" v-model:end-date="endDate" @change="applyFilters" />
        </div>
      </template>
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="loading" :title="t('common.refresh')" :aria-label="t('common.refresh')" @click="loadRecords">
          <Icon name="refresh" size="md" :class="{ 'animate-spin': loading }" />
        </button>
      </template>
      <template #table>
        <DataTable :columns="columns" :data="records" :loading="loading">
          <template #cell-created_at="{ value }">
            <span class="whitespace-nowrap text-rv-fg-3">{{ formatDateTime(value) }}</span>
          </template>
          <template #cell-user="{ row }">
            <div class="max-w-56 break-all text-rv-fg">{{ row.user_email || row.user_name || `#${row.user_id}` }}</div>
            <div class="text-xs text-rv-fg-3">ID {{ row.user_id }}</div>
          </template>
          <template #cell-model="{ row }">
            <div class="max-w-52 break-all font-medium text-rv-fg">{{ row.model || '-' }}</div>
            <div class="max-w-52 truncate text-xs text-rv-fg-3" :title="row.request_id">{{ row.request_id }}</div>
          </template>
          <template #cell-source="{ value }">
            <span class="badge badge-gray whitespace-nowrap">{{ t(`admin.imageRecords.sources.${value}`) }}</span>
          </template>
          <template #cell-images="{ row }">
            <span class="whitespace-nowrap">{{ row.actual_images }} / {{ row.requested_images }}</span>
          </template>
          <template #cell-total_cost="{ value }">
            <span class="whitespace-nowrap">${{ formatCostFixed(value || 0) }}</span>
          </template>
          <template #cell-status="{ row }">
            <span :class="['badge whitespace-nowrap', row.status === 'success' ? 'badge-success' : 'badge-danger']">
              {{ t(`admin.imageRecords.${row.status}`) }}
            </span>
          </template>
          <template #cell-actions="{ row }">
            <button type="button" class="btn-icon" :title="t('admin.imageRecords.detail')" :aria-label="t('admin.imageRecords.detail')" @click="selected = row">
              <Icon name="eye" size="md" />
            </button>
          </template>
          <template #empty>
            <div class="py-10 text-center text-sm text-rv-fg-3">{{ t('admin.imageRecords.empty') }}</div>
          </template>
        </DataTable>
      </template>
      <template #pagination>
        <Pagination v-if="pagination.total > 0" :page="pagination.page" :page-size="pagination.page_size" :total="pagination.total" @update:page="changePage" @update:pageSize="changePageSize" />
      </template>
    </TablePageLayout>

    <BaseDialog :show="selected !== null" :title="t('admin.imageRecords.detail')" width="wide" @close="selected = null">
      <dl v-if="selected" class="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
        <div v-for="item in detailRows" :key="item.label" :class="{ 'sm:col-span-2': item.wide }">
          <dt class="mb-1 text-xs text-rv-fg-3">{{ item.label }}</dt>
          <dd class="break-all text-rv-fg">{{ item.value }}</dd>
        </div>
      </dl>
    </BaseDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import TablePageLayout from '@/components/layout/TablePageLayout.vue'
import DataTable from '@/components/common/DataTable.vue'
import Pagination from '@/components/common/Pagination.vue'
import Select from '@/components/common/Select.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import type { Column } from '@/components/common/types'
import { listImageRecords } from '@/api/admin/usage'
import type { ImageGenerationRecord, ImageGenerationSource } from '@/api/admin/usage'
import { useAppStore } from '@/stores/app'
import { getPersistedPageSize } from '@/composables/usePersistedPageSize'
import { formatCostFixed, formatBusinessDateTime as formatDateTime } from '@/utils/format'

const { t } = useI18n()
const appStore = useAppStore()
const records = ref<ImageGenerationRecord[]>([])
const selected = ref<ImageGenerationRecord | null>(null)
const search = ref('')
const userId = ref('')
const source = ref<ImageGenerationSource | ''>('')
const status = ref<'success' | 'failed' | ''>('')
const startDate = ref('')
const endDate = ref('')
const loading = ref(false)
const pagination = reactive({ page: 1, page_size: getPersistedPageSize(), total: 0 })
let controller: AbortController | null = null
let searchTimer: ReturnType<typeof setTimeout> | undefined

const columns = computed<Column[]>(() => [
  { key: 'created_at', label: t('admin.imageRecords.columns.time') },
  { key: 'user', label: t('admin.imageRecords.columns.user') },
  { key: 'model', label: t('admin.imageRecords.columns.model') },
  { key: 'source', label: t('admin.imageRecords.columns.source') },
  { key: 'images', label: t('admin.imageRecords.columns.images') },
  { key: 'total_cost', label: t('admin.imageRecords.columns.cost') },
  { key: 'status', label: t('admin.imageRecords.columns.status') },
  { key: 'actions', label: t('admin.imageRecords.columns.actions') },
])
const sourceOptions = computed(() => [
  { value: '', label: t('admin.imageRecords.allSources') },
  ...(['image_studio', 'nova_studio', 'external_api', 'historical_unknown'] as const).map(value => ({
    value, label: t(`admin.imageRecords.sources.${value}`),
  })),
])
const statusOptions = computed(() => [
  { value: '', label: t('admin.imageRecords.allStatuses') },
  { value: 'success', label: t('admin.imageRecords.success') },
  { value: 'failed', label: t('admin.imageRecords.failed') },
])
const detailRows = computed(() => {
  if (!selected.value) return []
  const row = selected.value
  return [
    { label: t('admin.imageRecords.requestId'), value: row.request_id, wide: true },
    { label: t('admin.imageRecords.user'), value: `${row.user_email || row.user_name || t('admin.imageRecords.deletedUser')} (#${row.user_id})` },
    { label: t('admin.imageRecords.apiKey'), value: `${row.api_key_name || '-'} (#${row.api_key_id})` },
    { label: t('admin.imageRecords.group'), value: `${row.group_name || '-'} (#${row.group_id})` },
    { label: t('admin.imageRecords.account'), value: row.account_id ? `${row.account_name || '-'} (#${row.account_id})` : '-' },
    { label: t('admin.imageRecords.columns.model'), value: row.model || '-' },
    { label: t('admin.imageRecords.columns.source'), value: t(`admin.imageRecords.sources.${row.source}`) },
    { label: t('admin.imageRecords.endpoint'), value: row.endpoint || '-', wide: true },
    { label: t('admin.imageRecords.requested'), value: String(row.requested_images) },
    { label: t('admin.imageRecords.generated'), value: String(row.actual_images) },
    { label: t('admin.imageRecords.references'), value: String(row.reference_count) },
    { label: t('admin.imageRecords.size'), value: row.requested_size || '-' },
    { label: t('admin.imageRecords.quality'), value: row.quality || '-' },
    { label: t('admin.imageRecords.columns.cost'), value: `$${formatCostFixed(row.total_cost || 0)}` },
    { label: t('admin.imageRecords.actualCost'), value: `$${formatCostFixed(row.actual_cost || 0)}` },
    { label: t('admin.imageRecords.httpStatus'), value: row.http_status ? String(row.http_status) : '-' },
    { label: t('admin.imageRecords.duration'), value: `${(row.duration_ms / 1000).toFixed(1)}s` },
    { label: t('admin.imageRecords.completedAt'), value: formatDateTime(row.completed_at) },
  ]
})

async function loadRecords() {
  clearTimeout(searchTimer)
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  try {
    const id = Number(userId.value)
    const result = await listImageRecords({
      page: pagination.page, page_size: pagination.page_size,
      user_id: id > 0 ? id : undefined,
      source: source.value || undefined, status: status.value || undefined,
      search: search.value.trim() || undefined,
      start_date: startDate.value || undefined, end_date: endDate.value || undefined,
    }, { signal: current.signal })
    if (current.signal.aborted) return
    records.value = result.items
    pagination.total = result.total
  } catch (error: any) {
    if (!current.signal.aborted && error?.code !== 'ERR_CANCELED' && error?.name !== 'AbortError') {
      appStore.showError(t('admin.imageRecords.loadFailed'))
    }
  } finally {
    if (controller === current) {
      loading.value = false
      controller = null
    }
  }
}

function applyFilters() {
  pagination.page = 1
  loadRecords()
}
function debounceSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(applyFilters, 300)
}
function changePage(page: number) {
  pagination.page = page
  loadRecords()
}
function changePageSize(size: number) {
  pagination.page_size = size
  applyFilters()
}

onMounted(loadRecords)
onUnmounted(() => {
  clearTimeout(searchTimer)
  controller?.abort()
})
</script>
