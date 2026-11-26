<template>
  <button
    ref="triggerRef"
    type="button"
    class="-mx-2 -my-1 flex max-w-64 items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-dark-700"
    :title="t('keys.clickToChangeGroup')"
    :aria-label="`${t('keys.clickToChangeGroup')}: ${apiKey.name}`"
    aria-haspopup="listbox"
    :aria-controls="menuId"
    :aria-expanded="isOpen"
    :aria-busy="saving"
    :aria-disabled="saving"
    data-test="key-inline-group-trigger"
    @click="toggleMenu"
    @keydown.down.prevent="openMenu"
    @keydown.up.prevent="openMenu"
  >
    <span v-if="currentGroup?.name" class="flex min-w-0 flex-col items-start gap-1">
      <GroupBadge
        :name="currentGroup.name"
        :status="listedGroup?.status ?? currentGroup.status"
        :platform="currentGroup.platform"
        :subscription-type="currentGroup.subscription_type"
        :rate-multiplier="currentGroup.rate_multiplier"
        :user-rate-multiplier="userGroupRates[currentGroup.id] ?? null"
        :previous-rate-multiplier="getGroupPreviousRate(currentGroup, userGroupRates[currentGroup.id], showPriceDrop)"
        :peak-rate-enabled="currentGroup.peak_rate_enabled"
        :peak-start="currentGroup.peak_start"
        :peak-end="currentGroup.peak_end"
        :peak-rate-multiplier="currentGroup.peak_rate_multiplier"
        always-show-rate
        :truncate="false"
        class="min-w-0 flex-wrap"
      />
    </span>
    <span v-else class="min-w-0 text-sm text-gray-500 [overflow-wrap:anywhere] dark:text-gray-400">
      {{ currentGroupName }}
    </span>
    <Icon
      :name="saving ? 'refresh' : 'chevronDown'"
      size="sm"
      :class="['shrink-0 text-gray-400', saving && 'animate-spin']"
    />
    <span v-if="saving" class="sr-only" data-test="key-inline-group-saving">{{ t('keys.saving') }}</span>
  </button>

  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="menuRef"
      class="fixed z-[100000020] flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-dark-700 dark:bg-dark-800"
      :style="menuStyle"
      data-test="key-inline-group-menu"
      @click.stop
      @keydown="onMenuKeydown"
    >
      <div class="flex shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-dark-700">
        <Icon name="search" size="sm" class="shrink-0 text-gray-400" />
        <input
          ref="searchRef"
          v-model="query"
          type="search"
          class="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
          role="combobox"
          aria-autocomplete="list"
          :aria-label="t('keys.searchGroup')"
          :aria-controls="menuId"
          :aria-expanded="isOpen"
          :aria-activedescendant="focusedIndex >= 0 ? optionId(focusedIndex) : undefined"
          :placeholder="t('keys.searchGroup')"
          :readonly="saving"
        />
        <button
          type="button"
          class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-dark-700 dark:hover:text-gray-200"
          :title="t('common.cancel')"
          :aria-label="t('common.cancel')"
          data-test="key-inline-group-cancel"
          @click="closeMenu(true)"
        >
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div
        :id="menuId"
        ref="listRef"
        role="listbox"
        :aria-label="t('keys.selectGroup')"
        :aria-busy="saving"
        class="min-h-0 overflow-y-auto p-1.5"
      >
        <button
          v-for="(option, index) in filteredOptions"
          :id="optionId(index)"
          :key="String(option.value)"
          type="button"
          role="option"
          tabindex="-1"
          :aria-selected="option.value === apiKey.group_id"
          :aria-disabled="Boolean(option.disabled || saving)"
          :disabled="Boolean(option.disabled || saving)"
          :data-test="`key-inline-group-option-${option.value ?? 'none'}`"
          :class="[
            'flex w-full min-w-0 items-start rounded-md px-3 py-2.5 text-left text-sm transition-colors',
            option.value === apiKey.group_id && 'bg-primary-50 dark:bg-primary-900/20',
            focusedIndex === index && 'ring-1 ring-inset ring-primary-500',
            option.disabled || saving
              ? 'cursor-not-allowed opacity-50'
              : 'hover:bg-gray-100 dark:hover:bg-dark-700'
          ]"
          @mouseenter="!option.disabled && (focusedIndex = index)"
          @click="selectGroup(option)"
        >
          <GroupOptionItem
            v-if="option.group"
            :name="option.group.name"
            :status="option.group.status"
            :platform="option.group.platform"
            :subscription-type="option.group.subscription_type"
            :rate-multiplier="option.group.rate_multiplier"
            :user-rate-multiplier="userGroupRates[option.group.id] ?? null"
            :previous-rate-multiplier="getGroupPreviousRate(option.group, userGroupRates[option.group.id], showPriceDrop)"
            :peak-rate-enabled="option.group.peak_rate_enabled"
            :peak-start="option.group.peak_start"
            :peak-end="option.group.peak_end"
            :peak-rate-multiplier="option.group.peak_rate_multiplier"
            :description="option.group.description"
            :selected="option.value === apiKey.group_id"
            aligned
          />
          <div v-else class="flex w-full min-w-0 items-center justify-between gap-3">
            <span class="min-w-0 flex-1 text-left text-gray-500 [overflow-wrap:anywhere] dark:text-gray-400">
              {{ option.label }}
            </span>
            <span
              class="flex h-4 w-4 shrink-0 items-center justify-center"
              data-test="group-option-check-slot"
              aria-hidden="true"
            >
              <svg
                v-if="option.value === apiKey.group_id"
                class="h-4 w-4 text-primary-600 dark:text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </div>
        </button>
        <div v-if="!filteredOptions.length || (!hasPermittedGroup && !query.trim())" class="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {{ t(query ? 'keys.noGroupFound' : 'common.noGroupsAvailable') }}
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import type { ApiKey, Group } from '@/types'
import GroupBadge from '@/components/common/GroupBadge.vue'
import GroupOptionItem from '@/components/common/GroupOptionItem.vue'
import { getGroupPreviousRate } from './groupPriceHistory'
import { getAllowedGroupsForKey, getCurrentKeyGroup, getKeyGroupOptionsForKey, type KeyGroupOption } from '@/utils/keyGroupPlatform'
import Icon from '@/components/icons/Icon.vue'

const props = withDefaults(defineProps<{
  apiKey: ApiKey
  groups: Group[]
  userGroupRates?: Record<number, number>
  showPriceDrop?: boolean
  saving?: boolean
  saveGroup: (keyId: number, groupId: number) => Promise<ApiKey>
}>(), {
  userGroupRates: () => ({}),
  showPriceDrop: true
})
const emit = defineEmits<{ updated: [key: ApiKey] }>()
const { t } = useI18n()
const appStore = useAppStore()
const isOpen = ref(false)
const submitting = ref(false)
const saving = computed(() => Boolean(props.saving || submitting.value))
const query = ref('')
const focusedIndex = ref(-1)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})
let identity = 0
let disposed = false

const menuId = computed(() => `key-group-menu-${props.apiKey.id}`)
const optionId = (index: number) => `${menuId.value}-${index}`
const listedGroup = computed(() => props.groups.find((group) => group.id === props.apiKey.group_id))
const currentGroup = computed(() => getCurrentKeyGroup(props.apiKey, props.groups))
const currentGroupName = computed(() =>
  currentGroup.value?.name || (props.apiKey.group_id == null ? t('keys.noGroup') : `#${props.apiKey.group_id}`)
)
const options = computed(() => getKeyGroupOptionsForKey(props.apiKey, props.groups, t('keys.noGroup')))
const hasPermittedGroup = computed(() => getAllowedGroupsForKey(props.apiKey, props.groups).length > 0)
const filteredOptions = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return options.value.filter((option) =>
    !search || `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(search)
  )
})

const closeMenu = (restoreFocus = false) => {
  isOpen.value = false
  query.value = ''
  if (restoreFocus) nextTick(() => triggerRef.value?.focus())
}

const updatePosition = () => {
  const rect = triggerRef.value?.getBoundingClientRect()
  if (!isOpen.value || !rect) return
  const padding = 8
  const width = Math.max(0, Math.min(384, window.innerWidth - padding * 2))
  const left = Math.max(padding, Math.min(rect.left, window.innerWidth - width - padding))
  const below = Math.max(0, window.innerHeight - rect.bottom - padding - 4)
  const above = Math.max(0, rect.top - padding - 4)
  const height = menuRef.value?.offsetHeight || Math.min(400, 52 + filteredOptions.value.length * 64)
  const opensAbove = below < height && above > below
  const availableHeight = opensAbove ? above : below
  menuStyle.value = {
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${availableHeight}px`,
    ...(opensAbove
      ? { bottom: `${Math.max(padding, window.innerHeight - rect.top + 4)}px` }
      : { top: `${Math.max(padding, rect.bottom + 4)}px` })
  }
}

const firstEnabledIndex = (start: number, direction = 1) => {
  const count = filteredOptions.value.length
  for (let offset = 0; offset < count; offset++) {
    const index = ((start + offset * direction) % count + count) % count
    if (!filteredOptions.value[index]?.disabled) return index
  }
  return -1
}

const openMenu = () => {
  if (saving.value) return
  query.value = ''
  isOpen.value = true
  const selected = filteredOptions.value.findIndex((option) =>
    !option.disabled && option.value === props.apiKey.group_id
  )
  focusedIndex.value = selected >= 0 ? selected : firstEnabledIndex(0)
  nextTick(() => {
    updatePosition()
    searchRef.value?.focus()
  })
}
const toggleMenu = () => {
  if (saving.value) return
  isOpen.value ? closeMenu() : openMenu()
}

const extractApiError = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') return undefined
  const err = error as {
    response?: { data?: { detail?: string; message?: string } }
    status?: number
    message?: string
  }
  if (err.response?.data?.detail) return err.response.data.detail
  if (err.response?.data?.message) return err.response.data.message
  if (typeof err.status === 'number' && err.status > 0 && typeof err.message === 'string' && err.message) {
    return err.message
  }
  return undefined
}

const selectGroup = async (option: KeyGroupOption) => {
  if (saving.value || option.disabled) return
  if (option.value === props.apiKey.group_id) {
    closeMenu(isOpen.value)
    return
  }
  const groupId = option.value
  if (typeof groupId !== 'number' || !options.value.some((current) => current.value === groupId && !current.disabled)) {
    appStore.showError(t('keys.groupRequired'))
    return
  }
  const keyId = props.apiKey.id
  const requestIdentity = identity
  submitting.value = true
  // A mouse-selected option becomes disabled during saving; keep keyboard focus in the menu.
  nextTick(() => {
    if (!disposed && requestIdentity === identity && isOpen.value) searchRef.value?.focus()
  })
  try {
    const updated = await props.saveGroup(keyId, groupId)
    if (disposed || requestIdentity !== identity) return
    emit('updated', updated)
    appStore.showSuccess(t('keys.groupChangedSuccess'))
    closeMenu(isOpen.value)
  } catch (error: unknown) {
    if (disposed || requestIdentity !== identity) return
    appStore.showError(extractApiError(error) || t('keys.failedToChangeGroup'))
    if (isOpen.value) nextTick(() => searchRef.value?.focus())
  } finally {
    if (!disposed && requestIdentity === identity) submitting.value = false
  }
}

const onMenuKeydown = (event: KeyboardEvent) => {
  if (event.isComposing) return
  if (
    event.target instanceof Element &&
    event.target.closest('[data-test="key-inline-group-cancel"]') &&
    event.key !== 'Escape' &&
    event.key !== 'Tab'
  ) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeMenu(true)
  } else if (event.key === 'Tab') {
    triggerRef.value?.focus()
    closeMenu()
  } else if (!saving.value && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault()
    const direction = event.key === 'ArrowDown' ? 1 : -1
    focusedIndex.value = firstEnabledIndex(focusedIndex.value + direction, direction)
  } else if (!saving.value && event.key === 'Enter') {
    event.preventDefault()
    const option = filteredOptions.value[focusedIndex.value]
    if (option) void selectGroup(option)
  }
}

const onOutsideClick = (event: MouseEvent) => {
  const target = event.target as Node | null
  if (target && !triggerRef.value?.contains(target) && !menuRef.value?.contains(target)) closeMenu()
}

watch(query, () => {
  focusedIndex.value = firstEnabledIndex(0)
  nextTick(updatePosition)
})
watch(focusedIndex, () => {
  nextTick(() => {
    const list = listRef.value
    const option = list?.children[focusedIndex.value] as HTMLElement | undefined
    if (!list || !option) return
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop
    if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight
    }
  })
})
watch(() => props.apiKey.id, () => {
  identity++
  submitting.value = false
  closeMenu()
})
watch(options, () => {
  focusedIndex.value = firstEnabledIndex(0)
  nextTick(updatePosition)
})

onMounted(() => {
  document.addEventListener('click', onOutsideClick)
  window.addEventListener('scroll', updatePosition, { capture: true, passive: true })
  window.addEventListener('resize', updatePosition)
})
onUnmounted(() => {
  disposed = true
  document.removeEventListener('click', onOutsideClick)
  window.removeEventListener('scroll', updatePosition, { capture: true })
  window.removeEventListener('resize', updatePosition)
})
</script>
