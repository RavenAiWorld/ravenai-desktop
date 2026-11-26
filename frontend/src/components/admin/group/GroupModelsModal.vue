<template>
  <component :is="inline ? GroupModelsPanel : BaseDialog" :show="show" :title="t('admin.groups.modelManager.title', { name: group?.name || '' })" width="wide"
    :show-close-button="!busy" :close-on-escape="!busy" @close="close">
    <div class="space-y-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('admin.groups.modelManager.hint') }}</p>
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" data-testid="sync-models" class="btn btn-primary" :disabled="busy || !loaded || dirty" @click="sync">
          <Icon name="refresh" size="sm" :class="{ 'animate-spin': syncing }" />
          {{ syncing ? t('admin.groups.modelAllowlist.syncing') : t('admin.groups.modelManager.sync', { name: group?.name || '' }) }}
        </button>
        <span v-if="dirty" class="text-xs text-amber-600 dark:text-amber-400">{{ t('admin.groups.modelManager.saveFirst') }}</span>
      </div>
      <div v-if="report" data-testid="sync-report" class="rounded-lg bg-gray-50 p-3 text-sm dark:bg-dark-700" aria-live="polite">
        <p>{{ t('admin.groups.modelManager.result', {
          total: report.accounts_total, succeeded: report.accounts_succeeded, failed: report.accounts_failed,
          skipped: report.accounts_skipped, discovered: report.discovered.length, added: report.added.length,
        }) }}</p>
        <details v-if="report.failures?.length" class="mt-2">
          <summary class="cursor-pointer text-amber-700 dark:text-amber-400">{{ t('admin.groups.modelManager.failures') }}</summary>
          <ul class="mt-2 space-y-1">
            <li v-for="failure in report.failures" :key="failure.account_id" class="break-words">
              #{{ failure.account_id }} {{ failure.account_name }} — {{ failure.message }}
            </li>
          </ul>
        </details>
      </div>
      <p v-if="loading" role="status" class="py-6 text-center text-sm text-gray-500">{{ t('admin.groups.modelAllowlist.loading') }}</p>
      <div v-else-if="loadError" class="space-y-2 text-sm text-red-600" role="alert">
        <p>{{ loadError }}</p>
        <button type="button" class="btn btn-secondary" @click="load">{{ t('common.refresh') }}</button>
      </div>
      <fieldset v-else-if="loaded" :disabled="busy" class="space-y-3">
        <label class="flex items-center gap-2 text-sm">
          <input v-model="state.enabled" type="checkbox" data-testid="policy-enabled" class="rounded border-gray-300 text-primary-600" />
          {{ t('admin.groups.modelManager.enforce') }}
        </label>
        <p v-if="!state.enabled" class="text-xs text-amber-600 dark:text-amber-400">{{ t('admin.groups.modelManager.unrestricted') }}</p>
        <div class="flex flex-wrap items-center gap-2">
          <input v-model="search" type="search" class="input min-w-0 flex-1" :aria-label="t('admin.groups.modelManager.search')" :placeholder="t('admin.groups.modelManager.search')" />
          <select v-model="filter" class="input w-auto" :aria-label="t('admin.groups.modelManager.filter')">
            <option value="all">{{ t('admin.groups.modelManager.all') }}</option>
            <option value="selected">{{ t('admin.groups.modelManager.selected') }}</option>
            <option value="unselected">{{ t('admin.groups.modelManager.unselected') }}</option>
          </select>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>{{ t('admin.groups.modelAllowlist.selectedSummary', { selected: selectedCount, total: state.items.length }) }}</span>
          <div class="flex gap-3">
            <button type="button" data-testid="select-visible" class="text-primary-600 dark:text-primary-400" @click="selectVisible(true)">{{ t('admin.groups.modelManager.selectVisible') }}</button>
            <button type="button" data-testid="remove-visible" class="text-red-600 dark:text-red-400" @click="selectVisible(false)">{{ t('admin.groups.modelManager.removeVisible') }}</button>
          </div>
        </div>
        <div class="overflow-auto rounded-lg border border-gray-200 dark:border-dark-600" :class="inline ? 'max-h-[60vh]' : 'max-h-80'">
          <div v-for="item in visibleItems" :key="item.id" class="flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-0 dark:border-dark-700" :data-model="item.id">
            <label class="flex min-w-0 flex-1 items-center gap-3 text-sm">
              <input type="checkbox" :checked="item.selected" :aria-label="item.id" class="rounded border-gray-300 text-primary-600" @change="selectItem(item, ($event.target as HTMLInputElement).checked)" />
              <span class="break-all" :class="item.selected ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400'">{{ item.id }}</span>
            </label>
            <button v-if="item.selected" type="button" :aria-label="t('admin.groups.modelManager.remove', { model: item.id })" class="rounded p-1 text-gray-400 hover:text-red-600" @click="selectItem(item, false)">
              <Icon name="trash" size="sm" />
            </button>
          </div>
          <p v-if="!visibleItems.length" class="p-5 text-center text-sm text-gray-500">{{ t('admin.groups.modelManager.emptySearch') }}</p>
        </div>
        <form class="flex items-center gap-2" @submit.prevent="addCustom">
          <input v-model="customModel" class="input min-w-0 flex-1" :placeholder="t('admin.groups.modelAllowlist.customPlaceholder')" :aria-label="t('admin.groups.modelAllowlist.customPlaceholder')" />
          <button type="submit" class="btn btn-secondary">{{ t('admin.groups.modelAllowlist.addCustom') }}</button>
        </form>
        <p v-if="customError" role="alert" class="text-xs text-red-600">{{ customError }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('admin.groups.modelManager.removeHint') }}</p>
      </fieldset>
    </div>
    <template #footer>
      <div class="flex justify-end gap-3">
        <button v-if="!inline" type="button" class="btn btn-secondary" :disabled="busy" @click="close">{{ t('common.close') }}</button>
        <button type="button" data-testid="save-models" class="btn btn-primary" :disabled="busy || !loaded || !dirty || (state.enabled && selectedCount === 0)" @click="save">
          {{ saving ? t('common.saving') : t('common.save') }}
        </button>
      </div>
      <p v-if="loaded && state.enabled && selectedCount === 0" class="mt-2 text-xs text-red-600">{{ t('admin.groups.modelAllowlist.emptySelectionError') }}</p>
    </template>
  </component>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import GroupModelsPanel from './GroupModelsPanel.vue'
import Icon from '@/components/icons/Icon.vue'
import { adminAPI } from '@/api/admin'
import type { GroupUpstreamModelSyncResult } from '@/api/admin/groups'
import type { AdminGroup, ModelAllowlist } from '@/types'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { addCustomModelAllowlistItem, type ModelAllowlistItem } from '@/views/admin/groupModelAllowlist'
import { buildGroupModelPolicy, hydrateGroupModelPolicy, matchesGroupModelPattern } from './groupModelPolicy'

const props = withDefaults(defineProps<{ show: boolean; group: AdminGroup | null; inline?: boolean }>(), { inline: false })
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated'): void
  (e: 'state-change', state: { busy: boolean; dirty: boolean }): void
}>()
const { t } = useI18n()
const app = useAppStore()
const state = reactive(hydrateGroupModelPolicy(undefined, []))
const loading = ref(false)
const syncing = ref(false)
const saving = ref(false)
const loaded = ref(false)
const loadError = ref('')
const search = ref('')
const filter = ref('all')
const customModel = ref('')
const customError = ref('')
const revision = ref('')
const baseline = ref('')
const report = ref<GroupUpstreamModelSyncResult | null>(null)
let candidates: string[] = []
let epoch = 0
const busy = computed(() => loading.value || syncing.value || saving.value)
const selection = computed(() => buildGroupModelPolicy(state))
const dirty = computed(() => loaded.value && JSON.stringify(selection.value) !== baseline.value)
const selectedCount = computed(() => state.items.filter(item => item.selected).length)
const visibleItems = computed(() => state.items.filter(item =>
  item.id.toLowerCase().includes(search.value.trim().toLowerCase()) &&
  (filter.value === 'all' || item.selected === (filter.value === 'selected')),
))
const isCurrent = (request: number, id: number) => request === epoch && props.show && props.group?.id === id

function applyPolicy(policy: ModelAllowlist | undefined, updatedAt: string) {
  Object.assign(state, hydrateGroupModelPolicy(policy, candidates))
  revision.value = updatedAt
  baseline.value = JSON.stringify(buildGroupModelPolicy(state))
}

async function load() {
  if (!props.show || !props.group) return
  const request = ++epoch
  const id = props.group.id
  loading.value = true
  loaded.value = false
  loadError.value = ''
  report.value = null
  search.value = ''
  filter.value = 'all'
  customError.value = ''
  customModel.value = ''
  try {
    const [fresh, models] = await Promise.all([adminAPI.groups.getById(id), adminAPI.groups.getModelAllowlistCandidates(id)])
    if (!isCurrent(request, id)) return
    candidates = models
    applyPolicy(fresh.model_allowlist, fresh.updated_at)
    loaded.value = true
  } catch (error) {
    if (isCurrent(request, id)) loadError.value = extractApiErrorMessage(error, t('admin.groups.failedToLoad'))
  } finally {
    if (request === epoch) loading.value = false
  }
}

function selectItem(item: ModelAllowlistItem, selected: boolean) {
  item.selected = selected
  if (selected && item.id.includes('*')) {
    state.items.forEach(candidate => {
      if (matchesGroupModelPattern(item.id, candidate.id)) candidate.selected = true
    })
  }
  state.enabled = true
}
function selectVisible(selected: boolean) {
  visibleItems.value.forEach(item => { item.selected = selected })
  state.enabled = true
}
function addCustom() {
  const error = addCustomModelAllowlistItem(state, customModel.value)
  customError.value = error ? t(`admin.groups.modelAllowlist.errors.${error}`) : ''
  if (!error) {
    selectItem(state.items[state.items.length - 1], true)
    customModel.value = ''
  }
}

async function sync() {
  if (!props.group || busy.value || dirty.value || !loaded.value) return
  const request = epoch
  const id = props.group.id
  syncing.value = true
  try {
    const result = await adminAPI.groups.syncUpstreamModels(id)
    emit('updated')
    if (!isCurrent(request, id)) return
    candidates = [...candidates, ...result.discovered]
    applyPolicy(result.model_allowlist, result.updated_at)
    report.value = result
    if (result.accounts_succeeded === 0) app.showWarning(t('admin.groups.modelManager.noSuccess'))
    else app.showSuccess(t('admin.groups.modelAllowlist.syncSuccess', { added: result.added.length, total: result.model_allowlist.models?.length || 0 }))
  } catch (error) {
    if (isCurrent(request, id)) app.showError(extractApiErrorMessage(error, t('admin.groups.modelAllowlist.syncFailed')))
  } finally {
    if (request === epoch) syncing.value = false
  }
}

async function save() {
  if (!props.group || busy.value || !dirty.value || (state.enabled && selectedCount.value === 0)) return
  const request = epoch
  const id = props.group.id
  saving.value = true
  try {
    const fresh = await adminAPI.groups.saveModelAllowlist(id, selection.value, revision.value)
    emit('updated')
    if (!isCurrent(request, id)) return
    applyPolicy(fresh.model_allowlist, fresh.updated_at)
    app.showSuccess(t('admin.groups.modelManager.saved'))
  } catch (error) {
    if (isCurrent(request, id)) app.showError(extractApiErrorMessage(error, t('admin.groups.failedToUpdate')))
  } finally {
    if (request === epoch) saving.value = false
  }
}

function close() { if (!busy.value) emit('close') }
watch(() => [props.show, props.group?.id], () => {
  ++epoch
  loading.value = syncing.value = saving.value = false
  if (props.show) void load()
}, { immediate: true })
onBeforeUnmount(() => { ++epoch })
watch([busy, dirty], ([busy, dirty]) => emit('state-change', { busy, dirty }), { immediate: true })
</script>
