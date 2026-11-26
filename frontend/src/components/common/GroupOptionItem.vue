<template>
  <div
    class="flex min-w-0 flex-1 items-start justify-between gap-3"
    :class="{ 'group-option-aligned': aligned }"
    :title="aligned ? description || undefined : undefined"
  >
    <div
      class="group-option-heading flex min-w-0 flex-1 flex-col items-start"
      :title="!aligned ? description || undefined : undefined"
    >
      <GroupBadge
        :name="name"
        :status="aligned ? undefined : status"
        :platform="platform"
        :subscription-type="subscriptionType"
        :show-rate="false"
        :truncate="!aligned"
        class="groupOptionItemBadge"
      />
      <span
        v-if="description"
        class="group-option-description mt-1.5 w-full whitespace-pre-line [overflow-wrap:anywhere] text-left text-xs leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-3"
        data-test="group-option-description"
      >
        {{ description }}
      </span>
    </div>

    <div v-if="aligned && status === 'maintenance'" class="group-option-maintenance" data-test="group-option-maintenance">
      <GroupMaintenanceBadge :status="status" />
    </div>

    <div class="group-option-trailing flex shrink-0 items-center gap-2 pt-0.5">
      <div class="group-option-rates flex shrink-0 flex-col items-end gap-1">
        <span
          v-if="rateMultiplier !== undefined"
          :class="['group-option-rate inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold', ratePillClass]"
          data-test="group-option-rate"
        >
          <template v-if="previousRateMultiplier != null">
            <span class="group-option-rate-change inline-flex items-center gap-1 tabular-nums" data-test="group-rate-change" :aria-label="t('keys.groupPriceDropDetails', { previous: previousRateMultiplier, current: userRateMultiplier ?? rateMultiplier })">
              <span class="line-through opacity-50">{{ previousRateMultiplier }}x</span>
              <span aria-hidden="true">&rarr;</span>
              <span class="font-bold">{{ userRateMultiplier ?? rateMultiplier }}x</span>
            </span>
          </template>
          <template v-else-if="hasCustomRate">
            <span class="mr-1 line-through opacity-50">{{ rateMultiplier }}x</span>
            <span class="font-bold">{{ userRateMultiplier }}x</span>
          </template>
          <template v-else>
            {{ rateMultiplier }}x {{ t('admin.groups.rateLabel') }}
          </template>
        </span>
        <span
          v-if="hasPeakRate"
          class="group-option-peak inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
          :title="peakRateTitle"
          data-test="group-option-peak-rate"
        >
          {{ peakRateText }}
        </span>
      </div>
      <span v-if="showCheckmark && (aligned || selected)" class="group-option-check flex h-4 w-4 shrink-0" data-test="group-option-check-slot" aria-hidden="true">
        <svg
          v-if="selected"
          class="h-4 w-4 text-primary-600 dark:text-primary-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="2"
          data-test="group-option-check-icon"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GroupBadge from './GroupBadge.vue'
import GroupMaintenanceBadge from './GroupMaintenanceBadge.vue'
import type { SubscriptionType, GroupPlatform, GroupStatus } from '@/types'
import { useAppStore } from '@/stores/app'
import { formatPeakRateWindow, serverTimezoneLabel } from '@/utils/peak-rate'

const { t } = useI18n()

interface Props {
  name: string
  status?: GroupStatus
  platform: GroupPlatform
  subscriptionType?: SubscriptionType
  rateMultiplier?: number
  userRateMultiplier?: number | null
  previousRateMultiplier?: number | null
  peakRateEnabled?: boolean
  peakStart?: string
  peakEnd?: string
  peakRateMultiplier?: number
  description?: string | null
  selected?: boolean
  showCheckmark?: boolean
  aligned?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  subscriptionType: 'standard',
  selected: false,
  showCheckmark: true,
  userRateMultiplier: null,
  peakRateEnabled: false
})

// Whether user has a custom rate different from default
const hasCustomRate = computed(() => {
  return (
    props.userRateMultiplier !== null &&
    props.userRateMultiplier !== undefined &&
    props.rateMultiplier !== undefined &&
    props.userRateMultiplier !== props.rateMultiplier
  )
})

const appStore = useAppStore()

const hasPeakRate = computed(() => {
  return Boolean(props.peakRateEnabled && props.peakStart && props.peakEnd)
})

const peakRateText = computed(() => {
  return formatPeakRateWindow(
    {
      peak_rate_enabled: props.peakRateEnabled,
      peak_start: props.peakStart,
      peak_end: props.peakEnd,
      peak_rate_multiplier: props.peakRateMultiplier
    },
    serverTimezoneLabel(appStore.cachedPublicSettings?.server_utc_offset)
  )
})

const peakRateTitle = computed(() => {
  return t('common.peakRateTooltip', { window: peakRateText.value })
})

// Rate pill color matches platform badge color
const ratePillClass = computed(() => {
  switch (props.platform) {
    case 'anthropic':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
    case 'openai':
      return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    case 'gemini':
      return 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400'
    default: // antigravity and others
      return 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400'
  }
})
</script>

<style scoped>
.groupOptionItemBadge :deep(.group-badge-name) {
  font-weight: 600;
}

/* Key dropdowns opt into stable name, status, rate and selection columns. */
.group-option-aligned {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) min(16%, 3.75rem) min(38%, 7.5rem) 1rem;
  gap: 0.375rem;
}
.group-option-aligned .group-option-heading,
.group-option-aligned .group-option-trailing,
.group-option-aligned .group-option-rates {
  display: contents;
}
.group-option-aligned .groupOptionItemBadge {
  grid-area: 1 / 1;
  justify-self: start;
  align-items: flex-start;
  max-width: 100%;
  min-width: 0;
  min-height: 1.25rem;
  column-gap: 0.3rem;
  padding-inline: 0.375rem;
  text-align: left;
}
.group-option-aligned .groupOptionItemBadge :deep(svg) {
  flex: none;
  margin-top: 2px;
}
.group-option-aligned .groupOptionItemBadge :deep(.group-badge-name) {
  line-height: 1.35;
}
.group-option-maintenance {
  grid-area: 1 / 2;
  justify-self: end;
  min-width: 0;
  max-width: 100%;
}
.group-option-maintenance :deep(span) {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}
.group-option-aligned .group-option-rate {
  grid-area: 1 / 3;
  justify-self: end;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
  max-width: 100%;
  padding: 0.125rem 0.375rem;
  column-gap: 0.25rem;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: right;
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
}
.group-option-aligned .group-option-rate-change {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0 0.25rem;
  min-width: 0;
}
.group-option-aligned .group-option-rate span {
  min-width: 0;
}
.group-option-aligned .group-option-rate > .line-through {
  margin: 0;
}
.group-option-aligned .group-option-check {
  grid-area: 1 / 4;
  margin-top: 0.125rem;
}
.group-option-aligned .group-option-description,
.group-option-aligned .group-option-peak {
  grid-column: 1 / -1;
  margin: 0;
}
.group-option-aligned .group-option-peak {
  justify-self: start;
  max-width: 100%;
  padding: 0.125rem 0.5rem;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
