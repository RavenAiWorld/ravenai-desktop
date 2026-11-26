<template>
  <div v-if="account.type === 'apikey'" class="flex min-w-[9rem] items-center gap-1">
    <HelpTooltip width-class="w-80">
      <template #trigger>
        <span class="cursor-help border-b border-dotted border-gray-300 text-sm dark:border-dark-600" data-testid="upstream-account-balance">
          {{ amount ?? statusLabel }}
        </span>
      </template>
      <div class="space-y-1">
        <p>{{ t('admin.accounts.upstreamBalance.scope') }}</p>
        <p v-if="snapshot?.currency">{{ t('admin.accounts.upstreamBalance.currency') }}: {{ snapshot.currency }}</p>
        <p>{{ t('admin.accounts.upstreamBalance.updatedAt', { value: updatedAt }) }}</p>
        <p v-if="errorLabel" data-testid="upstream-balance-error">{{ errorLabel }}</p>
      </div>
    </HelpTooltip>
    <span v-if="amount && statusLabel" class="text-[10px] text-amber-600 dark:text-amber-400">{{ statusLabel }}</span>
    <button
      type="button"
      class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
      :disabled="probing"
      :title="t(needsConfiguration ? 'admin.accounts.upstreamBalance.configure' : 'admin.accounts.upstreamBalance.refresh')"
      :aria-label="t(needsConfiguration ? 'admin.accounts.upstreamBalance.configure' : 'admin.accounts.upstreamBalance.refresh')"
      data-testid="upstream-account-balance-action"
      @click="needsConfiguration ? $emit('configure') : $emit('probe')"
    >
      <Icon :name="needsConfiguration ? 'cog' : 'refresh'" size="xs" :class="{ 'animate-spin': probing }" />
    </button>
  </div>
  <span v-else class="text-sm text-gray-400">-</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import HelpTooltip from '@/components/common/HelpTooltip.vue'
import Icon from '@/components/icons/Icon.vue'
import type { Account } from '@/types'

const props = defineProps<{ account: Account; now: number; probing?: boolean }>()
defineEmits<{ (event: 'probe'): void; (event: 'configure'): void }>()
const { t } = useI18n()
const snapshot = computed(() => props.account.extra?.upstream_billing_probe?.account_balance)
const needsConfiguration = computed(() =>
  props.account.credentials?.upstream_balance_provider !== 'newapi' ||
  props.account.credentials_status?.has_upstream_balance_access_token !== true ||
  snapshot.value?.status === 'requires_configuration'
)
const stale = computed(() => {
  const until = Date.parse(snapshot.value?.fresh_until ?? '')
  return snapshot.value?.received_at && (!Number.isFinite(until) || props.now > until)
})
const amount = computed(() => {
  const value = snapshot.value
  if (needsConfiguration.value || value?.provider !== 'newapi' || value.scope !== 'account' ||
    typeof value.balance !== 'number' || !Number.isFinite(value.balance) ||
    !Number.isFinite(Date.parse(value.received_at ?? '')) ||
    Date.parse(value.received_at ?? '') > props.now + 5 * 60_000) return null
  if (value.currency === 'USD' || value.currency === 'CNY') {
    return `${value.currency} ${value.balance.toFixed(2)}`
  }
  if (value.currency === 'quota') return `${value.balance.toLocaleString()} ${t('admin.accounts.upstreamBalance.quota')}`
  return null
})
const statusLabel = computed(() => {
  if (needsConfiguration.value) return t('admin.accounts.upstreamBalance.requiresConfiguration')
  if (!snapshot.value) return t('admin.accounts.upstreamBalance.notProbed')
  if (snapshot.value.status === 'failed') return t('admin.accounts.upstreamBalance.failed')
  if (!amount.value) return t('admin.accounts.upstreamBalance.failed')
  if (stale.value) return t('admin.accounts.upstreamBalance.stale')
  return ''
})
const errorLabel = computed(() => {
  const error = snapshot.value?.last_error
  if (!error) return ''
  if (['missing_access_token', 'invalid_user_id', 'invalid_quota_unit', 'invalid_currency', 'user_id_mismatch'].includes(error)) {
    return t(`admin.accounts.upstreamBalance.errors.${error}`)
  }
  if (error === 'account_access_denied' || snapshot.value?.http_status === 401 || snapshot.value?.http_status === 403) {
    return t('admin.accounts.upstreamBalance.errors.unauthorized')
  }
  if (error === 'currency_metadata_unavailable') return t('admin.accounts.upstreamBalance.errors.currency_metadata_unavailable')
  return t('admin.accounts.upstreamBalance.errors.request_failed')
})
const updatedAt = computed(() => {
  const value = snapshot.value?.received_at
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : '-'
})
</script>
