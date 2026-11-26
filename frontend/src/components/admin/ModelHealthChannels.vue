<template>
  <section :aria-label="t('admin.modelHealth.channels')" :aria-busy="loading" class="min-w-0">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
      <div class="flex flex-wrap items-center gap-3">
        <span>{{ t('admin.modelHealth.channelCount', { count: channels.length }) }}</span>
        <div role="group" :aria-label="t('admin.modelHealth.metricsRange')" class="inline-flex rounded border border-gray-200 p-0.5 dark:border-dark-700">
          <button v-for="window in ranges" :key="window" type="button" :data-testid="`health-range-${window}`" :aria-pressed="range === window" :aria-busy="pendingRange === window" :disabled="saving" class="inline-flex min-w-14 items-center justify-center gap-1 rounded-sm px-3 py-1.5 text-xs font-medium disabled:opacity-50" :class="range === window ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700'" @click="(window !== range || pendingRange && pendingRange !== window) && emit('changeRange', window)"><Icon v-if="pendingRange === window" name="refresh" size="xs" class="animate-spin" />{{ window }}</button>
        </div>
      </div>
      <span>{{ t('admin.modelHealth.metricsUpdated') }} {{ time(state.metrics?.to) }}<template v-if="state.providers?.metrics_updated_at && Object.keys(state.providers.accounts).length"> · AIHub {{ time(state.providers.metrics_updated_at) }}</template></span>
    </div>
    <p v-if="state.metrics?.error" role="status" class="mb-3 text-sm text-amber-600">{{ t('admin.modelHealth.metricsFailed') }}</p>
    <p v-if="state.providers?.metrics_error" role="status" class="mb-3 text-sm text-amber-600">{{ t('admin.modelHealth.providerMetricsFailed') }}</p>
    <p v-else-if="state.providers?.metrics_stale && !state.providers.stale && !state.providers.error" role="status" class="mb-3 text-sm text-amber-600">{{ t('admin.modelHealth.providerMetricsStale') }}</p>
    <p v-if="state.providers?.stale || state.providers?.error" role="status" class="mb-3 text-sm text-amber-600">{{ t(modelHealthProviderNotice(state.providers?.error)) }}</p>
    <div v-if="platforms.length > 1" role="group" :aria-label="t('admin.modelHealth.channelPlatform')" class="mb-3 inline-flex max-w-full flex-wrap gap-1 rounded-md border border-gray-200 p-1 dark:border-dark-600">
      <button v-for="item in platforms" :key="item.id" type="button" :aria-pressed="selectedPlatform === item.id" :class="selectedPlatform === item.id ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700'" class="rounded px-3 py-1.5 text-xs font-semibold" @click="platform = item.id">{{ item.label }} <span class="ml-1 tabular-nums">{{ channelCount(item.id) }}</span></button>
    </div>
    <div class="provider-table provider-board">
      <div v-if="channels.length" class="provider-table-heading board-head">
        <span>{{ t('admin.modelHealth.hallGroup') }}</span><span>{{ t('admin.modelHealth.hallMultiplier') }}</span><span>{{ t('admin.modelHealth.hallPrice') }}</span><span>{{ t('admin.modelHealth.hallStatus') }}</span><span>{{ t('admin.modelHealth.hallAverage') }}</span><span>{{ t('admin.modelHealth.modelDetection') }}</span><span>{{ t('admin.modelHealth.hallImage') }}</span><span class="text-center">{{ t('admin.supplierHall.actions') }}</span>
      </div>
      <ModelHealthProviderRow v-for="channel in channels" :key="channel.id" :channel="channel" :group="provider(channel.id)" :group-id="binding(channel.id)" :state="state" :rules="rules(channel.id)" :saving="saving || loading" :range="range" @edit="emit('edit', $event)" @probe="emit('probe', $event)" @bind-provider="(id, groupID) => emit('bindProvider', id, groupID)" @retire="emit('retire', $event)" />
    </div>
    <p v-if="!channels.length" class="py-12 text-center text-sm text-gray-500">{{ t('admin.modelHealth.noGroupChannels') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import './providerBoard.css'
import ModelHealthProviderRow from './ModelHealthProviderRow.vue'
import Icon from '@/components/icons/Icon.vue'
import { isModelHealthExcludedAccount, modelHealthProviderNotice } from '@/utils/modelHealthProvider'
import { supplierPlatformLabels } from '@/utils/supplierHall'
import type { ModelHealthAccount, ModelHealthMetricsRange, ModelHealthRule, ModelHealthState } from '@/api/admin/modelHealth'

const props = withDefaults(defineProps<{ state: ModelHealthState; search: string; providerId?: number; saving?: boolean; loading?: boolean; range?: ModelHealthMetricsRange; pendingRange?: ModelHealthMetricsRange | null }>(), { range: '1h', pendingRange: null })
const emit = defineEmits<{ changeRange: [range: ModelHealthMetricsRange]; edit: [rule: ModelHealthRule]; probe: [id: string]; bindProvider: [accountID: number, groupID: number]; retire: [account: ModelHealthAccount] }>()
const ranges = ['1h', '24h', '7d'] as const
const platform = ref('')
const members = computed(() => props.state.accounts.filter(item => !isModelHealthExcludedAccount(item.id)))
const platforms = computed(() => {
  const visible = [...new Set(members.value.map(item => item.platform ?? 'openai'))]
  return [{ id: '', label: t('admin.supplierHall.allPlatforms') }, ...visible.map(id => ({ id, label: supplierPlatformLabels[id] ?? id }))]
})
const selectedPlatform = computed(() => platforms.value.some(item => item.id === platform.value) ? platform.value : '')
const { t } = useI18n()
const rules = (id: number) => props.state.settings.rules.filter(rule => rule.primary_id === id || rule.backup_ids.includes(id))
const binding = (id: number) => props.state.provider_bindings?.[String(id)] ?? props.state.settings.provider_groups?.[String(id)] ?? 0
const provider = (id: number) => props.state.providers?.accounts[String(id)]
const channelOrder = (id: number) => Math.min(...rules(id).map(rule => rule.primary_id === id ? 0 : rule.backup_ids.indexOf(id) + 1), Infinity)
const matching = computed(() => members.value.filter(channel => props.providerId
  ? (binding(channel.id) || provider(channel.id)?.group_id) === props.providerId :
  `${channel.name} ${channel.id} ${provider(channel.id)?.code ?? ''} ${rules(channel.id).map(rule => `${rule.name} ${rule.model}`).join(' ')} ${Object.keys(channel.models).join(' ')}`.toLowerCase().includes(props.search.toLowerCase()))
  .sort((a, b) => channelOrder(a.id) - channelOrder(b.id) || a.id - b.id))
const channels = computed(() => selectedPlatform.value ? matching.value.filter(channel => (channel.platform ?? 'openai') === selectedPlatform.value) : matching.value)
const channelCount = (id: string) => id ? matching.value.filter(channel => (channel.platform ?? 'openai') === id).length : matching.value.length
function time(value?: string) { return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-' }
</script>
