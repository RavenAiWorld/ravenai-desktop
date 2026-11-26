<template>
  <BaseDialog
    :show="mode !== null"
    :title="t(mode === 'assign' ? 'admin.accounts.affiliations.assign' : 'admin.accounts.affiliations.manage')"
    width="narrow"
    :close-on-escape="!saving"
    :show-close-button="!saving"
    @close="emit('close')"
  >
    <div v-if="mode === 'assign'" class="space-y-3">
      <label class="block text-sm font-medium text-rv-fg-2" for="account-affiliation-destination">
        {{ t('admin.accounts.affiliations.selected', { count: accountIds.length }) }}
      </label>
      <select id="account-affiliation-destination" v-model="destination" class="input w-full" :disabled="saving">
        <option :value="null" disabled>{{ t('admin.accounts.affiliations.select') }}</option>
        <option value="">{{ t('admin.accounts.affiliations.automatic') }}</option>
        <option value="unassigned">{{ t('admin.accounts.affiliations.unassigned') }}</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
      </select>
    </div>
    <div v-else class="space-y-4">
      <form class="flex min-w-0 flex-wrap gap-2" @submit.prevent="submitName">
        <label for="account-affiliation-name" class="sr-only">{{ t('admin.accounts.affiliations.name') }}</label>
        <input
          id="account-affiliation-name"
          v-model="name"
          :placeholder="t('admin.accounts.affiliations.name')"
          maxlength="40"
          class="input min-w-28 flex-1"
          :disabled="saving"
        />
        <button type="submit" class="btn btn-primary shrink-0 gap-1.5" :disabled="saving || !name.trim()">
          <Icon :name="editing ? 'check' : 'plus'" size="sm" aria-hidden="true" />
          {{ t(editing ? 'common.save' : 'admin.accounts.affiliations.create') }}
        </button>
        <button v-if="editing" type="button" class="btn btn-secondary shrink-0 px-2" :disabled="saving" :title="t('common.cancel')" :aria-label="t('common.cancel')" @click="resetName">
          <Icon name="x" size="sm" />
        </button>
      </form>
      <ul class="divide-y divide-rv-line border-y border-rv-line">
        <li v-for="category in categories" :key="category.id" class="flex min-h-10 items-center justify-between gap-2 py-1 text-sm">
          <span class="min-w-0 break-all text-rv-fg-2">{{ category.name }}</span>
          <span v-if="category.builtin" class="shrink-0 text-xs text-rv-fg-3">{{ t('admin.accounts.affiliations.builtin') }}</span>
          <div v-else class="flex shrink-0 gap-1">
            <button type="button" class="btn btn-secondary px-2 py-1" :disabled="saving" :title="t('common.edit')" :aria-label="`${t('common.edit')} ${category.name}`" @click="edit(category)">
              <Icon name="edit" size="sm" />
            </button>
            <button type="button" class="btn btn-secondary px-2 py-1 text-red-600 dark:text-red-400" :disabled="saving" :title="t('common.delete')" :aria-label="`${t('common.delete')} ${category.name}`" @click="removing = category">
              <Icon name="trash" size="sm" />
            </button>
          </div>
        </li>
      </ul>
      <div v-if="removing" class="space-y-2 rounded-md border border-red-200 p-3 text-sm dark:border-red-900/60">
        <p class="break-words">{{ t('admin.accounts.affiliations.deleteConfirm', { name: removing.name }) }}</p>
        <div class="flex flex-wrap justify-end gap-2">
          <button type="button" class="btn btn-secondary btn-sm" :disabled="saving" @click="removing = null">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn-danger btn-sm" :disabled="saving" @click="deleteCategory">{{ t('common.delete') }}</button>
        </div>
      </div>
    </div>
    <p v-if="error" role="alert" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    <template #footer>
      <button type="button" class="btn btn-secondary" :disabled="saving" @click="emit('close')">{{ t(mode === 'assign' ? 'common.cancel' : 'common.close') }}</button>
      <button v-if="mode === 'assign'" type="button" class="btn btn-primary" :disabled="saving || destination === null" @click="assign">{{ t('common.save') }}</button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AccountAffiliation, AccountAffiliationChange, AccountAffiliationSnapshot } from '@/api/admin/accounts'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import { extractApiErrorMessage } from '@/utils/apiError'

const props = defineProps<{
  mode: 'manage' | 'assign' | null
  categories: AccountAffiliation[]
  accountIds: number[]
}>()
const emit = defineEmits<{
  close: []
  changed: [snapshot: AccountAffiliationSnapshot, change: AccountAffiliationChange]
}>()
const { t } = useI18n()
const saving = ref(false)
const error = ref('')
const name = ref('')
const editing = ref<string | null>(null)
const removing = ref<AccountAffiliation | null>(null)
const destination = ref<string | null>(null)

function resetName() {
  name.value = ''
  editing.value = null
}

watch(() => props.mode, () => {
  resetName()
  removing.value = null
  destination.value = null
  error.value = ''
})

function edit(category: AccountAffiliation) {
  editing.value = category.id
  name.value = category.name
  removing.value = null
}

async function save(change: AccountAffiliationChange) {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    const snapshot = await adminAPI.accounts.changeAffiliations(change)
    emit('changed', snapshot, change)
    if (change.action === 'assign') emit('close')
    else if (change.action === 'delete') {
      if (editing.value === change.affiliation_id) resetName()
      removing.value = null
    } else resetName()
  } catch (e) {
    error.value = extractApiErrorMessage(e, t('admin.accounts.affiliations.saveFailed'))
  } finally {
    saving.value = false
  }
}

function submitName() {
  if (!name.value.trim()) return
  void save(editing.value
    ? { action: 'rename', affiliation_id: editing.value, name: name.value.trim() }
    : { action: 'create', name: name.value.trim() })
}

function deleteCategory() {
  if (removing.value) void save({ action: 'delete', affiliation_id: removing.value.id })
}

function assign() {
  if (destination.value !== null) {
    void save({ action: 'assign', affiliation_id: destination.value, account_ids: props.accountIds })
  }
}
</script>
