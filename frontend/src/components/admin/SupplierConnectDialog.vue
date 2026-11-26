<template>
  <BaseDialog :show="!!provider" :title="`${t('admin.supplierHall.connect')} · ${provider?.code ?? ''}`" width="wide" :close-on-escape="!saving" :show-close-button="!saving" @close="emit('close')">
    <form v-if="provider && draft" :id="formId" class="space-y-4" @submit.prevent="submit">
      <p v-if="error" role="alert" class="break-words border-l-2 border-red-500 px-3 py-2 text-sm text-red-600">{{ error }}</p>
      <p v-if="loading" role="status" class="text-sm text-gray-500">{{ t('admin.supplierHall.loading') }}</p>
      <div v-if="operation && !loading" class="flex flex-wrap gap-2 text-xs font-medium text-primary-700 dark:text-primary-300">
        <span>{{ t('admin.supplierHall.pending') }}</span><span v-if="operation.key_id">· Key #{{ operation.key_id }}</span><span v-if="operation.account_id">· {{ t('admin.supplierHall.connected') }} #{{ operation.account_id }}</span>
      </div>
      <button v-if="loadFailed" type="button" class="btn btn-secondary" @click="load()">{{ t('admin.supplierHall.retry') }}</button>

      <fieldset v-if="!loading && !loadFailed" :disabled="saving || !!operation" class="min-w-0 space-y-5 disabled:opacity-70">
        <div class="min-w-0">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <h3 class="font-semibold">{{ t('admin.supplierHall.chooseModels') }} <span class="ml-1 text-xs font-normal tabular-nums text-gray-500">{{ draft.models.length }} / {{ choices.length }}</span></h3>
            <div v-if="!operation && offered.length > 1" class="flex flex-wrap gap-2 text-xs">
              <button type="button" class="btn btn-secondary min-h-8 px-2 py-1" @click="draft.models = offered.slice(0, 128)">{{ t('admin.supplierHall.selectAll') }}</button>
              <button type="button" class="btn btn-secondary min-h-8 px-2 py-1" @click="draft.models = []">{{ t('admin.supplierHall.clearAll') }}</button>
            </div>
          </div>
          <div class="grid max-h-64 gap-1 overflow-auto border-y border-gray-200 py-2 sm:grid-cols-2 dark:border-dark-700">
            <label v-for="item in choices" :key="item" class="flex min-w-0 cursor-pointer items-start gap-2 rounded px-2 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-700" :class="draft.models.includes(item) ? 'bg-cyan-50 dark:bg-cyan-950/40' : ''">
              <input v-model="draft.models" type="checkbox" :value="item" class="mt-0.5 h-4 w-4 shrink-0 rounded" :disabled="draft.models.length >= 128 && !draft.models.includes(item)" />
              <span class="min-w-0 [overflow-wrap:anywhere]">{{ item }}<span v-if="!offered.includes(item)" class="ml-1 text-xs text-amber-700 dark:text-amber-300">{{ t('admin.supplierHall.knownDelisted') }}</span></span>
            </label>
          </div>
        </div>
        <div class="grid gap-3 border-b border-gray-200 pb-4 sm:grid-cols-2 dark:border-dark-700">
          <label class="min-w-0 sm:col-span-2">
            <span class="mb-1 block text-sm font-medium">{{ t('admin.supplierHall.groupMode') }}</span>
            <select v-model="mode" class="input w-full">
              <option value="existing">{{ t('admin.supplierHall.existingGroup') }}</option>
              <option value="new">{{ t('admin.supplierHall.newGroup') }}</option>
            </select>
          </label>
          <label v-if="mode === 'existing'" class="min-w-0 sm:col-span-2">
            <span class="mb-1 block text-sm font-medium">{{ t('admin.supplierHall.chooseGroup') }}</span>
            <select v-model.number="draft.group_id" class="input w-full" required>
              <option :value="0" disabled>{{ t('admin.supplierHall.chooseGroup') }}</option>
              <option v-if="operation && draft.group_id && !selectedGroup" :value="draft.group_id">#{{ draft.group_id }}</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }} #{{ g.id }} · {{ g.rate_multiplier }}×</option>
            </select>
            <span v-if="selectedGroup" class="mt-1.5 block text-xs text-gray-500">{{ selectedGroup.account_count == null ? t('admin.supplierHall.startOnExisting') : t('admin.supplierHall.existingGroupImpact', { accounts: selectedGroup.account_count }) }}</span>
          </label>
          <template v-else>
            <label class="min-w-0"><span class="mb-1 block text-sm font-medium">{{ t('admin.supplierHall.groupName') }}</span><input v-model.trim="draft.group_name" class="input w-full" maxlength="100" required /></label>
            <label class="min-w-0"><span class="mb-1 block text-sm font-medium">{{ t('admin.supplierHall.sellRate') }}</span><input v-model.number="draft.sell_rate" class="input w-full" type="number" step="any" min="0.000001" max="1000000" required /></label>
          </template>
          <label v-if="mode === 'new' || draft.group_id" class="min-w-0 sm:col-span-2">
            <span class="mb-1 block text-sm font-medium">{{ t('admin.modelHealth.groupDescription') }}</span>
            <textarea v-model="description" class="input w-full" rows="2" maxlength="4000" data-testid="connect-group-description" />
          </label>
          <label class="min-w-0">
            <span class="mb-1 block text-sm font-medium">{{ t('admin.supplierHall.maxRate') }}</span>
            <input v-model.number="draft.max_rate" class="input w-full" type="number" step="any" :min="Math.max(0.000001, provider.rate_multiplier)" max="1000000" required />
          </label>
        </div>
        <p v-if="provider.platform !== 'openai'" class="text-xs text-gray-500">{{ t('admin.supplierHall.nonOpenAI') }}</p>
      </fieldset>
    </form>
    <template #footer>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="btn btn-secondary" :disabled="saving" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button type="submit" :form="formId" class="btn btn-primary gap-1.5" :disabled="!canSubmit || loading || saving || loadFailed">
          <Icon :name="saving ? 'refresh' : 'plus'" size="sm" :class="{ 'animate-spin': saving }" />
          {{ t(operation ? 'admin.supplierHall.pending' : 'admin.supplierHall.confirmConnect', { count: draft?.models.length ?? 0 }) }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModelHealthProviderGroup } from '@/api/admin/modelHealth'
import type { AdminGroup, GroupPlatform } from '@/types'
import { getAll } from '@/api/admin/groups'
import { connectSupplier, getSupplierConnection, supplierErrorText, type SupplierConnectInput, type SupplierConnection } from '@/api/admin/supplierHall'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'

const props = defineProps<{ provider: ModelHealthProviderGroup | null; model: string }>()
const emit = defineEmits<{ close: []; connected: [SupplierConnection] }>()
const { t } = useI18n()
const formId = useId()
const draft = ref<SupplierConnectInput>()
const groups = ref<AdminGroup[]>([])
const mode = ref<'existing' | 'new'>('existing')
const operation = ref<SupplierConnection | null>(null)
const loading = ref(false)
const loadFailed = ref(false)
const saving = ref(false)
const error = ref('')
let loadVersion = 0
const selectedGroup = computed(() => groups.value.find(g => g.id === draft.value?.group_id))
const newDescription = ref(''), existingDescription = ref('')
const description = computed({
  get: () => mode.value === 'new' ? newDescription.value : existingDescription.value,
  set: (text: string) => { if (mode.value === 'new') newDescription.value = text; else existingDescription.value = text },
})
watch(() => selectedGroup.value?.id, () => { existingDescription.value = selectedGroup.value?.description ?? '' }, { flush: 'sync' })
const offered = computed(() => [...new Set(props.provider?.supported_models?.map(p => p.model) ?? [])].sort())
const choices = computed(() => operation.value ? [...new Set([...offered.value, ...operation.value.input.models])].sort() : offered.value)
const canSubmit = computed(() => {
  const value = draft.value
  return !!value?.models.length && value.models.every(item => offered.value.includes(item)) && value.max_rate > 0 &&
    (mode.value === 'existing' ? value.group_id > 0 : !!value.group_name && value.sell_rate > 0)
})
watch(() => props.provider?.group_id, () => { void load() }, { immediate: true })

async function load(preserveDraft = false) {
  const id = ++loadVersion
  const provider = props.provider
  if (!provider) return
  if (!preserveDraft) {
    draft.value = {
      provider_id: provider.group_id, group_id: 0, group_name: provider.code,
      sell_rate: 1, max_rate: provider.rate_multiplier,
      models: offered.value.includes(props.model) ? [props.model] : offered.value.length === 1 ? [offered.value[0]!] : [],
    }
    groups.value = []
    newDescription.value = `AIHub ${provider.code}`
    existingDescription.value = ''
    operation.value = null
    error.value = ''
  }
  loading.value = true
  loadFailed.value = false
  try {
    const [compatible, pending] = await Promise.all([
      getAll(provider.platform as GroupPlatform), getSupplierConnection(provider.group_id)
    ])
    if (id !== loadVersion) return
    groups.value = compatible.filter(g => g.platform === provider.platform && !g.require_oauth_only)
    if (pending?.phase === 'connected') { emit('connected', pending); return }
    operation.value = pending
    if (pending) {
      draft.value = { ...pending.input, models: [...pending.input.models] }
      mode.value = pending.input.group_id > 0 ? 'existing' : 'new'
      description.value = pending.input.group_description ?? (mode.value === 'existing' ? selectedGroup.value?.description ?? '' : '')
    } else if (!preserveDraft) {
      mode.value = groups.value.length ? 'existing' : 'new'
    }
  } catch (cause) {
    if (id === loadVersion) {
      error.value = supplierErrorText(cause) ?? t('admin.supplierHall.failed')
      loadFailed.value = true
    }
  } finally {
    if (id === loadVersion) loading.value = false
  }
}
async function submit() {
  if (!draft.value || !canSubmit.value || saving.value) return
  saving.value = true
  error.value = ''
  const body = operation.value?.input ?? {
    ...draft.value,
    group_id: mode.value === 'existing' ? draft.value.group_id : 0,
    group_name: mode.value === 'existing' ? '' : draft.value.group_name,
    sell_rate: mode.value === 'existing' ? 0 : draft.value.sell_rate,
    ...(mode.value === 'new' || description.value !== (selectedGroup.value?.description ?? '') ? { group_description: description.value } : {}),
  }
  try {
    emit('connected', await connectSupplier(body))
  } catch (cause) {
    error.value = supplierErrorText(cause) ?? t('admin.supplierHall.failed')
    await load(true)
  } finally {
    saving.value = false
  }
}
</script>
