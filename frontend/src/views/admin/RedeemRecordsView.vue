<template>
  <AppLayout>
    <TablePageLayout>
      <template #filters>
        <div class="flex flex-wrap items-center gap-3">
          <input
            v-model="searchQuery"
            type="search"
            maxlength="100"
            class="input min-w-0 flex-1 sm:max-w-80"
            :aria-label="t('admin.redeem.searchCodes')"
            :placeholder="t('admin.redeem.searchCodes')"
            @input="handleSearch"
          />
          <Select
            v-model="codeType"
            :options="typeOptions"
            :aria-label="t('admin.redeem.codeType')"
            class="w-full sm:w-40"
            @change="applyFilters"
          />
        </div>
      </template>
      <template #actions>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-secondary"
            :title="t('common.refresh')"
            :aria-label="t('common.refresh')"
            :disabled="loading"
            @click="loadRecords"
          >
            <Icon name="refresh" size="md" :class="{ 'animate-spin': loading }" />
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            :title="t('admin.redeem.exportCsv')"
            :aria-label="t('admin.redeem.exportCsv')"
            :disabled="exporting"
            @click="exportRecords"
          >
            <Icon name="download" size="md" />
          </button>
        </div>
      </template>
      <template #table>
        <DataTable
          :columns="columns"
          :data="records"
          :loading="loading"
          :server-side-sort="true"
          default-sort-key="used_at"
          default-sort-order="desc"
          @sort="handleSort"
        >
          <template #cell-code="{ value }">
            <code class="break-all font-mono text-sm text-rv-fg">{{ value }}</code>
          </template>
          <template #cell-type="{ value }">
            <span class="badge badge-gray">{{ t('admin.redeem.types.' + value) }}</span>
          </template>
          <template #cell-value="{ value, row }">
            <span class="font-medium text-rv-fg">
              <template v-if="row.type === 'balance'">${{ value.toFixed(2) }}</template>
              <template v-else-if="row.type === 'subscription'">
                {{ row.validity_days ?? 30 }} {{ t('admin.redeem.days') }}
                <span v-if="row.group" class="text-xs text-rv-fg-3">({{ row.group.name }})</span>
              </template>
              <template v-else>{{ value }}</template>
            </span>
            <p v-if="(row.bonus_amount ?? 0) > 0" class="text-xs text-emerald-600 dark:text-emerald-400">
              {{ t('redeem.bonusDetails', { bonus: row.bonus_amount.toFixed(2), total: row.credited_value.toFixed(2) }) }}
            </p>
          </template>
          <template #cell-used_by="{ value, row }">
            <div class="min-w-0 max-w-72 break-all text-rv-fg">
              {{ row.user?.email || row.user?.username || (value ? t('admin.redeem.userPrefix', { id: value }) : '-') }}
            </div>
          </template>
          <template #cell-used_at="{ value }">
            <span class="whitespace-nowrap text-rv-fg-3">{{ value ? formatDateTime(value) : '-' }}</span>
          </template>
          <template #empty>
            <div class="py-10 text-center text-sm text-rv-fg-3">{{ t('admin.redeem.noRecords') }}</div>
          </template>
        </DataTable>
      </template>
      <template #pagination>
        <Pagination
          v-if="pagination.total > 0"
          :page="pagination.page"
          :page-size="pagination.page_size"
          :total="pagination.total"
          @update:page="changePage"
          @update:pageSize="changePageSize"
        />
      </template>
    </TablePageLayout>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { RedeemCode, RedeemCodeType } from '@/types'
import type { Column } from '@/components/common/types'
import { useAppStore } from '@/stores/app'
import { getPersistedPageSize } from '@/composables/usePersistedPageSize'
import { formatDateTime } from '@/utils/format'
import AppLayout from '@/components/layout/AppLayout.vue'
import TablePageLayout from '@/components/layout/TablePageLayout.vue'
import DataTable from '@/components/common/DataTable.vue'
import Pagination from '@/components/common/Pagination.vue'
import Select from '@/components/common/Select.vue'
import Icon from '@/components/icons/Icon.vue'

const { t } = useI18n()
const appStore = useAppStore()
const records = ref<RedeemCode[]>([])
const searchQuery = ref('')
const codeType = ref<RedeemCodeType | ''>('')
const loading = ref(false)
const exporting = ref(false)
const pagination = reactive({ page: 1, page_size: getPersistedPageSize(), total: 0 })
const sort = reactive({ sort_by: 'used_at', sort_order: 'desc' as 'asc' | 'desc' })
let controller: AbortController | null = null
let searchTimeout: ReturnType<typeof setTimeout> | undefined

const columns = computed<Column[]>(() => [
  { key: 'used_at', label: t('admin.redeem.columns.usedAt'), sortable: true },
  { key: 'used_by', label: t('admin.redeem.columns.usedBy') },
  { key: 'code', label: t('admin.redeem.columns.code'), sortable: true },
  { key: 'type', label: t('admin.redeem.columns.type'), sortable: true },
  { key: 'value', label: t('admin.redeem.columns.value'), sortable: true },
])
const typeOptions = computed(() => [
  { value: '', label: t('admin.redeem.allTypes') },
  ...(['balance', 'concurrency', 'subscription', 'invitation'] as const)
    .map(value => ({ value, label: t('admin.redeem.types.' + value) })),
])
const queryFilters = () => ({
  status: 'used' as const,
  records_only: true,
  type: codeType.value || undefined,
  search: searchQuery.value.trim() || undefined,
  ...sort,
})

async function loadRecords() {
  clearTimeout(searchTimeout)
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  try {
    const response = await adminAPI.redeem.list(
      pagination.page, pagination.page_size, queryFilters(), { signal: current.signal }
    )
    if (current.signal.aborted) return
    records.value = response.items
    pagination.total = response.total
  } catch (error: any) {
    if (!current.signal.aborted && error?.code !== 'ERR_CANCELED' && error?.name !== 'AbortError') {
      appStore.showError(t('admin.redeem.failedToLoadRecords'))
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

function handleSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(applyFilters, 300)
}

function changePage(page: number) {
  pagination.page = page
  loadRecords()
}

function changePageSize(size: number) {
  pagination.page_size = size
  applyFilters()
}

function handleSort(key: string, order: 'asc' | 'desc') {
  sort.sort_by = key
  sort.sort_order = order
  applyFilters()
}

async function exportRecords() {
  if (exporting.value) return
  exporting.value = true
  try {
    const blob = await adminAPI.redeem.exportCodes(queryFilters())
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    try {
      link.href = url
      link.download = `redemption-records-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
    } finally {
      link.remove()
      URL.revokeObjectURL(url)
    }
    appStore.showSuccess(t('admin.redeem.recordsExported'))
  } catch {
    appStore.showError(t('admin.redeem.failedToExportRecords'))
  } finally {
    exporting.value = false
  }
}

onMounted(loadRecords)
onUnmounted(() => {
  clearTimeout(searchTimeout)
  controller?.abort()
})
</script>
