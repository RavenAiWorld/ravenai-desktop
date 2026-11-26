<template>
  <AppLayout>
    <div class="space-y-5">
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-full sm:w-72">
          <label for="model-manager-group" class="input-label">{{ t('admin.groups.modelManager.groupLabel') }}</label>
          <select id="model-manager-group" v-model="selectedGroupId" class="input" :disabled="loading || editorState.busy || editorState.dirty || !groups.length">
            <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
        </div>
        <button v-if="error || (!loading && !groups.length)" type="button" class="btn btn-secondary" :disabled="loading || editorState.busy || editorState.dirty" @click="loadGroups">
          <Icon name="refresh" size="sm" :class="{ 'animate-spin': loading }" />
          {{ t('common.refresh') }}
        </button>
        <p v-if="editorState.dirty" class="pb-2 text-xs text-amber-600 dark:text-amber-400">{{ t('admin.groups.modelManager.saveBeforeSwitch') }}</p>
      </div>
      <div v-if="error" role="alert" class="card p-5 text-sm text-red-600 dark:text-red-400">{{ error }}</div>
      <p v-if="loading && !groups.length" role="status" class="card p-8 text-center text-sm text-gray-500">{{ t('common.loading') }}</p>
      <GroupModelsModal v-else-if="selectedGroup" :key="selectedGroup.id" :show="true" :group="selectedGroup" inline @state-change="editorState = $event" />
      <div v-else-if="!loading && !error" class="card p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>{{ t('admin.groups.modelManager.noGroups') }}</p>
        <router-link to="/admin/groups" class="mt-4 inline-block text-primary-600 dark:text-primary-400">{{ t('nav.groups') }}</router-link>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import GroupModelsModal from '@/components/admin/group/GroupModelsModal.vue'
import Icon from '@/components/icons/Icon.vue'
import { adminAPI } from '@/api/admin'
import type { AdminGroup } from '@/types'
import { extractApiErrorMessage } from '@/utils/apiError'

const { t } = useI18n()
const groups = ref<AdminGroup[]>([])
const selectedGroupId = ref<number | null>(null)
const selectedGroup = computed(() => groups.value.find(group => group.id === selectedGroupId.value))
const loading = ref(false)
const error = ref('')
const editorState = ref({ busy: false, dirty: false })
let epoch = 0

async function loadGroups() {
  if (loading.value || editorState.value.busy || editorState.value.dirty) return
  const request = ++epoch
  loading.value = true
  error.value = ''
  try {
    const result = await adminAPI.groups.getAllIncludingInactive()
    if (request !== epoch) return
    groups.value = result
    if (!result.some(group => group.id === selectedGroupId.value)) {
      const preferred = result.find(group => group.name.trim().toLowerCase() === 'all')
        ?? result.find(group => group.platform === 'composite')
        ?? result[0]
      selectedGroupId.value = preferred?.id ?? null
    }
  } catch (cause) {
    if (request === epoch) error.value = extractApiErrorMessage(cause, t('admin.groups.failedToLoad'))
  } finally {
    if (request === epoch) loading.value = false
  }
}

onMounted(loadGroups)
onBeforeUnmount(() => { ++epoch })
</script>
