<template>
  <BaseDialog :show="!!account" :title="t('admin.supplierHall.retireFor', { name: account?.name ?? '' })" width="normal" :close-on-escape="!saving" :show-close-button="!saving" @close="emit('close')">
    <div class="space-y-3 text-sm" :aria-busy="saving || loading">
      <p v-if="error" role="alert" class="break-words border-l-2 border-red-500 px-3 py-2 text-red-600">{{ error }}</p>
      <p v-if="loading" role="status" class="py-2 text-gray-500">{{ t('admin.supplierHall.loading') }}</p>
      <button v-if="error && !plan && !loading" type="button" class="btn btn-secondary" @click="preview()">{{ t('admin.supplierHall.retry') }}</button>
      <template v-if="plan">
        <p v-if="plan.phase !== 'preview'" class="font-medium text-amber-700 dark:text-amber-300">{{ t('admin.supplierHall.resumeRetire') }}</p>
        <p class="break-words font-medium">{{ t('admin.supplierHall.retireKey', { name: plan.key_name, id: plan.key_id }) }}</p>
        <dl class="space-y-3 border-y border-gray-200 py-3 dark:border-dark-700">
          <div>
            <dt class="text-xs text-gray-500">{{ t('admin.supplierHall.retireModels') }}</dt>
            <dd class="mt-1 break-words">{{ plan.models.join(', ') || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500">{{ t('admin.supplierHall.retireGroups') }}</dt>
            <dd class="mt-1" v-if="!plan.groups.length">—</dd>
            <dd v-for="g in plan.groups" :key="g.id" class="mt-1 break-words">
              {{ g.name }} #{{ g.id }} <span class="text-xs text-gray-500">· {{ t('admin.supplierHall.groupImpact', { accounts: g.accounts, keys: g.customer_keys }) }}</span>
              <span v-if="!g.can_delete" class="block text-xs text-gray-500">{{ t('admin.supplierHall.groupKept') }}</span>
            </dd>
          </div>
        </dl>
        <fieldset v-if="plan.groups.length" class="space-y-2" :disabled="saving || plan.phase !== 'preview'">
          <legend class="mb-1 font-medium">{{ t('admin.supplierHall.retireScope') }}</legend>
          <label class="flex items-start gap-2">
            <input v-model="deleteGroups" :value="false" type="radio" name="retire-scope" class="mt-0.5 h-4 w-4 shrink-0" />
            <span>{{ t('admin.supplierHall.keepGroups') }}</span>
          </label>
          <label v-if="plan.groups.some(group => group.can_delete)" class="flex items-start gap-2">
            <input v-model="deleteGroups" :value="true" type="radio" name="retire-scope" class="mt-0.5 h-4 w-4 shrink-0" />
            <span>{{ t('admin.supplierHall.deleteEmpty') }}</span>
          </label>
          <p v-if="!deleteGroups && plan.groups.some(group => group.accounts === 1)" class="text-xs text-amber-700 dark:text-amber-300">{{ t('admin.supplierHall.lastChannelKept') }}</p>
        </fieldset>
      </template>
    </div>
    <template #footer>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="btn btn-secondary" :disabled="saving" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button type="button" class="btn btn-danger gap-1.5" :disabled="!plan || loading || saving" @click="confirm">
          <Icon :name="saving ? 'refresh' : 'trash'" size="sm" :class="{ 'animate-spin': saving }" />
          {{ t(plan && plan.phase !== 'preview' ? 'admin.supplierHall.resumeRetire' : deleteGroups ? 'admin.supplierHall.confirmRetireGroups' : 'admin.supplierHall.confirmRetire') }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import { getRetirement, retireSupplier, supplierErrorText, type SupplierRetirement } from '@/api/admin/supplierHall'

const props = defineProps<{ account: { id: number; name: string } | null }>()
const emit = defineEmits<{ close: []; retired: [SupplierRetirement] }>()
const { t } = useI18n()
const loading = ref(false), saving = ref(false), error = ref(''), deleteGroups = ref(false)
const plan = ref<SupplierRetirement | null>(null)
let previewVersion = 0
watch(() => props.account?.id, () => { void preview() }, { immediate: true })

function retirementError(cause: unknown) {
  const reason = (cause as { reason?: string } | null)?.reason
  if (reason === 'SUPPLIER_OWNER_KEY') return t('admin.supplierHall.retireOwnerKeyMissing')
  if (reason === 'SUPPLIER_SHARED_KEY') return t('admin.supplierHall.retireSharedKey')
  return supplierErrorText(cause) ?? t('admin.supplierHall.failed')
}

async function preview(preserveError = false) {
  const version = ++previewVersion
  const id = props.account?.id
  plan.value = null
  deleteGroups.value = false
  if (!preserveError) error.value = ''
  if (!id) { loading.value = false; return }
  loading.value = true
  try {
    const result = await getRetirement(id)
    if (version !== previewVersion) return
    if (result.phase === 'retired') { emit('retired', result); return }
    plan.value = result
    deleteGroups.value = result.phase !== 'preview' && result.delete_groups
  } catch (cause) {
    if (version === previewVersion) error.value = retirementError(cause)
  } finally {
    if (version === previewVersion) loading.value = false
  }
}
async function confirm() {
  if (!plan.value || !props.account || saving.value) return
  saving.value = true
  error.value = ''
  try {
    emit('retired', await retireSupplier(props.account.id, plan.value, deleteGroups.value))
  } catch (cause) {
    error.value = retirementError(cause)
    await preview(true)
  } finally {
    saving.value = false
  }
}
</script>
