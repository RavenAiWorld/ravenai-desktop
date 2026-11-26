<template>
  <div data-testid="model-whitelist-selector">
    <!-- Multi-select Dropdown -->
    <div class="relative mb-3">
      <div
        @click="toggleDropdown"
        class="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-dark-500 dark:bg-dark-700"
      >
        <div class="grid grid-cols-2 gap-1.5">
          <span v-for="model in enabledHealthModels" :key="'health-' + model" data-testid="health-model" class="inline-flex min-w-0 items-center justify-between gap-1 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
            <span class="flex min-w-0 items-center gap-1"><ModelIcon :model="model" size="14px" /><span class="truncate" :title="model">{{ model }}</span></span>
            <span class="shrink-0">{{ t('admin.modelHealth.controlBadge') }}</span>
          </span>
          <span
            v-for="model in automaticOnlyModels"
            :key="'automatic-' + model"
            data-testid="automatic-model"
            class="inline-flex min-w-0 items-center justify-between gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-dark-600 dark:text-gray-300"
          >
            <span class="flex min-w-0 items-center gap-1 truncate">
              <ModelIcon :model="model" size="14px" />
              <span class="truncate" :title="model">{{ model }}</span>
            </span>
            <span class="shrink-0 text-gray-500">{{ t('admin.accounts.automaticModelBadge') }}</span>
            <button
              type="button"
              data-testid="remove-model"
              :aria-label="`${t('common.remove')} ${model}`"
              :title="`${t('common.remove')} ${model}`"
              class="shrink-0 rounded-full hover:bg-gray-200 dark:hover:bg-dark-500"
              @click.stop="removeModel(model)"
            >
              <Icon name="x" size="xs" class="h-3.5 w-3.5" :stroke-width="2" />
            </button>
          </span>
          <span
            v-for="model in visibleManualModels"
            :key="model"
            class="inline-flex items-center justify-between gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-dark-600 dark:text-gray-300"
          >
            <span class="flex items-center gap-1 truncate">
              <ModelIcon :model="model" size="14px" />
              <span class="truncate">{{ model }}</span>
            </span>
            <button
              type="button"
              data-testid="remove-model"
              :aria-label="`${t('common.remove')} ${model}`"
              :title="`${t('common.remove')} ${model}`"
              @click.stop="removeModel(model)"
              class="shrink-0 rounded-full hover:bg-gray-200 dark:hover:bg-dark-500"
            >
              <Icon name="x" size="xs" class="h-3.5 w-3.5" :stroke-width="2" />
            </button>
          </span>
        </div>
        <div v-if="inactiveUpstreamModels.length" :class="{ 'mt-2': selectedModelIds.size }">
          <p class="mb-1.5 text-xs text-gray-500 dark:text-gray-400">
            {{ t('admin.accounts.inactiveUpstreamModelCount', { count: inactiveUpstreamModels.length }) }}
          </p>
          <ul class="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
            <li
              v-for="model in inactiveUpstreamModels"
              :key="model"
              data-testid="inactive-upstream-model"
              class="flex min-w-0 items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600 dark:bg-dark-800 dark:text-gray-300"
            >
              <span class="truncate" :title="model">{{ model }}</span>
              <span class="shrink-0 text-gray-500 dark:text-gray-400">
                {{ t(managedModelIDs.has(model) ? 'admin.modelHealth.controlDisabled' : 'admin.accounts.upstreamModelExcluded') }}
              </span>
            </li>
          </ul>
        </div>
        <div class="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 dark:border-dark-600">
          <span class="text-xs text-gray-400" data-testid="model-selection-count">
            {{ managedModelIDs.size
              ? t('admin.modelHealth.effectiveCount', { count: selectedModelIds.size })
              : automaticCatalogActive
              ? t('admin.accounts.automaticModelSelectionCount', { automatic: effectiveAutomaticModelIds.length, manual: visibleManualModels.length })
              : t('admin.accounts.modelCount', { count: modelValue.length }) }}
          </span>
          <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      <!-- Dropdown List -->
      <div
        v-if="showDropdown"
        class="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-dark-600 dark:bg-dark-700"
      >
        <div class="sticky top-0 border-b border-gray-200 bg-white p-2 dark:border-dark-600 dark:bg-dark-700">
          <input
            v-model="searchQuery"
            type="text"
            class="input w-full text-sm"
            :placeholder="t('admin.accounts.searchModels')"
            @click.stop
          />
        </div>
        <div class="max-h-52 overflow-auto">
          <div
            v-for="model in filteredModels"
            :key="model.value"
            data-testid="model-option"
            class="group flex items-center hover:bg-gray-100 dark:hover:bg-dark-600"
          >
            <button
              type="button"
              data-testid="select-model"
              :disabled="managedModelIDs.has(model.value)"
              :title="managedModelIDs.has(model.value) ? t('admin.modelHealth.controlHint') : undefined"
              class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
              @click="toggleModel(model.value)"
            >
              <span
                :class="[
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                  selectedModelIds.has(model.value)
                    ? 'border-primary-500 bg-primary-500 text-white'
                    : 'border-gray-300 dark:border-dark-500'
                ]"
              >
                <svg v-if="selectedModelIds.has(model.value)" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <ModelIcon :model="model.value" size="18px" />
              <span class="truncate text-gray-900 dark:text-white">{{ model.value }}</span>
              <span v-if="managedModelIDs.has(model.value)" class="ml-auto shrink-0 text-xs text-gray-500">{{ t(props.healthControls?.[model.value]?.enabled ? 'admin.modelHealth.controlEnabled' : 'admin.modelHealth.controlDisabled') }}</span>
              <span v-else-if="excludedModelIds.has(model.value)" class="ml-auto shrink-0 text-xs text-gray-500">{{ t('admin.accounts.upstreamModelExcluded') }}</span>
            </button>
            <button
              type="button"
              data-testid="copy-model-id"
              class="mr-2 rounded p-1.5 text-gray-400 opacity-70 transition-colors hover:bg-gray-200 hover:text-primary-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 group-hover:opacity-100 dark:text-gray-500 dark:hover:bg-dark-500 dark:hover:text-primary-400"
              :title="`${t('common.copy')} ${model.value}`"
              :aria-label="`${t('common.copy')} ${model.value}`"
              @click="copyModelId(model.value)"
            >
              <Icon name="copy" size="sm" />
            </button>
          </div>
          <div v-if="filteredModels.length === 0" class="px-3 py-4 text-center text-sm text-gray-500">
            {{ t('admin.accounts.noMatchingModels') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        @click="fillRelated"
        class="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30"
      >
        {{ t(automaticCatalogActive ? 'admin.accounts.fillManualModelsFromCatalog' : 'admin.accounts.fillRelatedModels') }}
      </button>
      <button
        v-if="canSyncUpstream && showSyncButton"
        type="button"
        data-testid="sync-upstream-models"
        @click="syncUpstreamModels"
        :disabled="isSyncingUpstream"
        class="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
      >
        {{ isSyncingUpstream ? t('admin.accounts.syncUpstreamModelsLoading') : t('admin.accounts.syncUpstreamModels') }}
      </button>
      <button
        type="button"
        @click="clearAll"
        class="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
      >
        {{ t('admin.accounts.clearAllModels') }}
      </button>
    </div>
    <p
      v-if="capabilityStatusKey"
      class="mb-3 text-xs text-gray-500 dark:text-gray-400"
      data-testid="model-capability-status"
      role="status"
    >
      {{ t(capabilityStatusKey) }}
    </p>

    <!-- Custom Model Input -->
    <div class="mb-3">
      <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('admin.accounts.customModelName') }}</label>
      <div class="flex gap-2">
        <input
          v-model="customModel"
          type="text"
          class="input flex-1"
          :placeholder="t('admin.accounts.enterCustomModelName')"
          @keydown.enter.prevent="handleEnter"
          @compositionstart="isComposing = true"
          @compositionend="isComposing = false"
        />
        <button
          type="button"
          @click="addCustom"
          class="rounded-lg bg-primary-50 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400 dark:hover:bg-primary-900/50"
        >
          {{ t('admin.accounts.addModel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { accountsAPI } from '@/api/admin/accounts'
import type { ModelHealthControl } from '@/api/admin/modelHealth'
import type { SyncUpstreamModelsResult, SyncUpstreamPreviewParams } from '@/api/admin/accounts'
import { useClipboard } from '@/composables/useClipboard'
import ModelIcon from '@/components/common/ModelIcon.vue'
import Icon from '@/components/icons/Icon.vue'
import { allModels, getModelsByPlatform } from '@/composables/useModelWhitelist'
import { supportsUpstreamModelSync } from '@/constants/platformCatalog'
import { extractApiErrorMessage } from '@/utils/apiError'
import { modelSyncWarningKey } from './modelSyncFeedback'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  modelValue: string[]
  modelMappings?: { from: string; to: string }[]
  platform?: string
  platforms?: string[]
  accountId?: number
  upstreamModels?: string[]
  excludedModels?: string[]
  upstreamWarnings?: SyncUpstreamModelsResult['warnings']
  syncCredentials?: {
    platform: string
    type: string
    base_url?: string
    api_key: string
  }
  showSyncButton?: boolean
  automaticCatalog?: boolean
  healthControls?: Record<string, ModelHealthControl>
}>(), { showSyncButton: true })

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'update:excludedModels': [value: string[]]
  'upstream-synced': []
  'catalog-updated': [catalog: SyncUpstreamModelsResult]
  'upstream-sync-finished': []
}>()

const appStore = useAppStore()
const { copyToClipboard } = useClipboard()

const showDropdown = ref(false)
const searchQuery = ref('')
const customModel = ref('')
const isComposing = ref(false)
const isSyncingUpstream = ref(false)
const syncedModels = ref<string[] | undefined>()
const localSyncWarnings = ref<SyncUpstreamModelsResult['warnings']>()
watch(() => [props.accountId, props.upstreamModels] as const, ([, models]) => {
  syncedModels.value = models ? [...models] : undefined
}, { immediate: true })
let upstreamSyncVersion = 0

watch(
  () => props.accountId,
  () => {
    upstreamSyncVersion += 1
    isSyncingUpstream.value = false
    localSyncWarnings.value = undefined
  }
)

onUnmounted(() => {
  upstreamSyncVersion += 1
})

const normalizedPlatforms = computed(() => {
  const rawPlatforms =
    props.platforms && props.platforms.length > 0
      ? props.platforms
      : props.platform
        ? [props.platform]
        : []

  return Array.from(
    new Set(
      rawPlatforms
        .map(platform => platform?.trim())
        .filter((platform): platform is string => Boolean(platform))
    )
  )
})

const publicModelName = (model: string) =>
  normalizedPlatforms.value.length === 1 && normalizedPlatforms.value[0] === 'opencode_go' && !model.startsWith('oc-')
    ? `oc-${model}`
    : model

const canSyncUpstream = computed(() => {
  if (props.accountId) {
    if (normalizedPlatforms.value.length === 0) return true
    return normalizedPlatforms.value.some(supportsUpstreamModelSync)
  }
  if (props.syncCredentials) {
    return supportsUpstreamModelSync(props.syncCredentials.platform)
  }
  return false
})

const presetOptions = computed(() => {
  if (normalizedPlatforms.value.length === 0) {
    return allModels
  }

  const allowedModels = new Set<string>()
  for (const platform of normalizedPlatforms.value) {
    for (const model of getModelsByPlatform(platform)) {
      allowedModels.add(model)
    }
  }

  return allModels.filter(model => allowedModels.has(model.value))
})

const availableOptions = computed(() => {
  const options = new Map<string, { value: string; label: string }>()
  if (syncedModels.value !== undefined) {
    for (const rawModel of syncedModels.value) {
      const model = rawModel.trim()
      if (!model) continue
      const value = publicModelName(model)
      options.set(value, { value, label: value })
    }
  } else {
    for (const option of presetOptions.value) options.set(option.value, option)
  }
  // Keep excluded IDs visible so an administrator can explicitly restore one.
  for (const value of props.modelValue) {
    if (!options.has(value)) options.set(value, { value, label: value })
  }
  for (const value of excludedModelIds.value) {
    if (!options.has(value)) options.set(value, { value, label: value })
  }
  for (const value of managedModelIDs.value) {
    if (!options.has(value)) options.set(value, { value, label: value })
  }
  return [...options.values()]
})

const automaticCatalogActive = computed(() => props.automaticCatalog && syncedModels.value !== undefined)
const automaticModelIds = computed(() => {
  if (!automaticCatalogActive.value) return []
  return [...new Set((syncedModels.value ?? []).map(model => model.trim()).filter(Boolean)
    .map(publicModelName))]
})
const excludedModelIds = computed(() => new Set(automaticCatalogActive.value ? (props.excludedModels ?? []).map(publicModelName) : []))
const managedModelIDs = computed(() => new Set(Object.keys(props.healthControls ?? {})))
const enabledHealthModels = computed(() => Object.entries(props.healthControls ?? {}).filter(([, control]) => control.enabled).map(([model]) => model))
const effectiveAutomaticModelIds = computed(() => automaticModelIds.value.filter(model => !excludedModelIds.value.has(model) && !managedModelIDs.value.has(model)))
const automaticOnlyModels = computed(() => effectiveAutomaticModelIds.value.filter(model => !props.modelValue.includes(model)))
const visibleManualModels = computed(() => props.modelValue.filter(model => !excludedModelIds.value.has(model) && !managedModelIDs.value.has(model)))
const selectedModelIds = computed(() => new Set([...enabledHealthModels.value, ...effectiveAutomaticModelIds.value, ...visibleManualModels.value]))
const inactiveUpstreamModels = computed(() => automaticModelIds.value.filter(model => !selectedModelIds.value.has(model)))
const capabilityStatusKey = computed(() => modelSyncWarningKey(props.upstreamWarnings ?? localSyncWarnings.value))

const filteredModels = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return availableOptions.value
  return availableOptions.value.filter(
    m => m.value.toLowerCase().includes(query) || m.label.toLowerCase().includes(query)
  )
})

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
  if (!showDropdown.value) searchQuery.value = ''
}

const removeModel = (model: string) => {
  if (managedModelIDs.value.has(model)) return
  if (automaticModelIds.value.includes(model) && !excludedModelIds.value.has(model)) {
    emit('update:excludedModels', [...(props.excludedModels ?? []), model])
  }
  emit('update:modelValue', props.modelValue.filter(m => m !== model))
}

const toggleModel = (model: string) => {
  if (managedModelIDs.value.has(model)) return
  if (excludedModelIds.value.has(model)) {
    emit('update:excludedModels', (props.excludedModels ?? []).filter(m => publicModelName(m) !== model))
    return
  }
  if (automaticModelIds.value.includes(model)) {
    removeModel(model)
    return
  }
  if (props.modelValue.includes(model)) {
    removeModel(model)
  } else {
    emit('update:modelValue', [...props.modelValue, model])
  }
}

const copyModelId = async (model: string) => {
  await copyToClipboard(model)
}

const addCustom = () => {
  const model = customModel.value.trim()
  if (!model) return
  if (model.includes('*')) {
    appStore.showInfo(t('admin.accounts.modelWildcardNotSupported'))
    return
  }
  if (managedModelIDs.value.has(model)) { appStore.showInfo(t('admin.modelHealth.controlHint')); return }
  if (excludedModelIds.value.has(model)) {
    emit('update:excludedModels', (props.excludedModels ?? []).filter(m => publicModelName(m) !== model))
    customModel.value = ''
    return
  }
  if (props.modelValue.includes(model)) {
    appStore.showInfo(t('admin.accounts.modelExists'))
    return
  }
  const conflict = props.modelMappings?.find(mapping => mapping.from.trim() === model && mapping.to.trim() && mapping.to.trim() !== model)
  if (conflict) {
    appStore.showInfo(t('admin.accounts.modelMappingConflict', { from: model, to: conflict.to.trim() }))
    return
  }
  emit('update:modelValue', [...props.modelValue, model])
  customModel.value = ''
}

const handleEnter = () => {
  if (!isComposing.value) addCustom()
}

const fillRelated = () => {
  const newModels = [...props.modelValue]
  const relatedModels = automaticCatalogActive.value
    ? automaticModelIds.value
    : syncedModels.value !== undefined
      ? availableOptions.value.map(model => model.value)
      : normalizedPlatforms.value.flatMap(getModelsByPlatform)
  if (automaticCatalogActive.value) {
    const restoredModels = new Set(relatedModels.filter(model => !managedModelIDs.value.has(model)))
    const remainingExclusions = (props.excludedModels ?? []).filter(model => !restoredModels.has(publicModelName(model)))
    if (remainingExclusions.length !== (props.excludedModels ?? []).length) {
      emit('update:excludedModels', remainingExclusions)
    }
  }
  for (const model of relatedModels) {
    if (!managedModelIDs.value.has(model) && !newModels.includes(model)) newModels.push(model)
  }
  emit('update:modelValue', newModels)
}

const syncUpstreamModels = async () => {
  if (isSyncingUpstream.value || !canSyncUpstream.value) return

  const syncVersion = upstreamSyncVersion
  const accountId = props.accountId
  const previewCredentials = props.syncCredentials
  const isCurrentSync = () => syncVersion === upstreamSyncVersion
  isSyncingUpstream.value = true
  try {
    let result
    if (accountId) {
      result = await accountsAPI.syncUpstreamModels(accountId)
    } else if (previewCredentials) {
      result = await accountsAPI.syncUpstreamModelsPreview(previewCredentials as SyncUpstreamPreviewParams)
    } else {
      return
    }
    if (!isCurrentSync()) return

    if (result.discovery_source === 'configured_fallback') {
      appStore.showWarning(t('admin.accounts.grokModelDiagnostics.configuredFallback'))
      return
    }
    if (result.live === false) {
      appStore.showWarning(t('admin.accounts.autoModelSyncRetained'))
      return
    }

    // Auto-managed accounts have already applied a durable catalog. Do not
    // turn that catalog into manual mappings (or unprefix OpenCode aliases).
    if (result.synced_at) {
      syncedModels.value = [...result.models]
      localSyncWarnings.value = result.warnings
      emit('catalog-updated', result)
      appStore.showSuccess(t('admin.accounts.upstreamCatalogSynced', { count: result.models.length }))
      return
    }
    const upstreamModels = result.models.map(model => model.trim()).filter(Boolean)
    if (upstreamModels.length === 0) {
      appStore.showInfo(t('admin.accounts.syncUpstreamModelsEmpty'))
      return
    }

    if (!accountId) {
      emit('upstream-synced')
    }

    const newModels = [...props.modelValue]
    let addedCount = 0
    for (const model of upstreamModels) {
      if (managedModelIDs.value.has(model)) continue
      if (!newModels.includes(model)) {
        newModels.push(model)
        addedCount += 1
      }
    }

    emit('update:modelValue', newModels)
    const warnings = result.warnings ?? []
    const hasPartialMetadata = warnings.some(
      warning => warning.code === 'upstream_model_metadata_partial'
    )
    const hasIncompleteMetadata = warnings.some(
      warning => warning.code === 'upstream_model_metadata_incomplete'
    )
    if (hasIncompleteMetadata) {
      appStore.showWarning(t('admin.accounts.syncUpstreamModelsMetadataIncomplete'))
      return
    }
    if (addedCount > 0) {
      appStore.showSuccess(t('admin.accounts.syncUpstreamModelsSuccess', { count: addedCount, total: upstreamModels.length }))
    } else {
      appStore.showInfo(t('admin.accounts.syncUpstreamModelsNoChanges', { count: upstreamModels.length }))
    }
    if (hasPartialMetadata) {
      appStore.showWarning(t('admin.accounts.syncUpstreamModelsMetadataPartial'))
    }
  } catch (error) {
    if (!isCurrentSync()) return
    const message = extractApiErrorMessage(error, t('admin.accounts.syncUpstreamModelsFailed'))
    appStore.showError(t('admin.accounts.syncUpstreamModelsError', { message }))
  } finally {
    if (isCurrentSync()) {
      isSyncingUpstream.value = false
      if (accountId) {
        emit('upstream-sync-finished')
      }
    }
  }
}

defineExpose({ syncUpstreamModels, isSyncingUpstream })

const clearAll = () => {
  if (automaticCatalogActive.value) {
    emit('update:excludedModels', [...new Set([...(props.excludedModels ?? []), ...automaticModelIds.value.filter(model => !managedModelIDs.value.has(model))])])
  }
  emit('update:modelValue', props.modelValue.filter(model => managedModelIDs.value.has(model)))
}

</script>
