<template>
  <div class="mt-2 flex flex-wrap gap-1.5" data-testid="channel-roles">
    <span v-for="rule in rules" :key="rule.id" class="inline-flex max-w-full flex-wrap items-center gap-1 rounded px-1.5 py-0.5 text-xs" :class="active(rule) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-300'">
      <span class="break-all">{{ rule.model }}</span>
      <span>· {{ accountId === rule.primary_id ? t('admin.modelHealth.primary') : t('admin.modelHealth.backupNumber', { number: rule.backup_ids.indexOf(accountId) + 1 }) }}</span>
      <span v-if="state.runtime[rule.id]?.observations[String(accountId)]?.delisted" class="text-amber-700 dark:text-amber-300">· {{ t('admin.supplierHall.knownDelisted') }}</span>
      <span v-else-if="active(rule)">· {{ t('admin.modelHealth.currentlyServing') }}</span>
      <span v-else-if="selected(rule)">· {{ t('admin.modelHealth.selectedPaused') }}</span>
    </span>
    <span v-if="!rules.length" class="text-xs text-gray-500">{{ t('admin.modelHealth.monitorOnly') }}</span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ModelHealthRule, ModelHealthState } from '@/api/admin/modelHealth'
const props = defineProps<{ accountId: number; rules: ModelHealthRule[]; state: ModelHealthState }>()
const { t } = useI18n()
function selected(rule: ModelHealthRule) {
  return props.state.settings.enabled && rule.enabled && rule.mode !== 'observe' &&
    props.state.runtime[rule.id]?.active_account_id === props.accountId
}
function active(rule: ModelHealthRule) {
  const account = props.state.accounts.find(item => item.id === props.accountId)
  return selected(rule) && account?.ready && account.schedulable &&
    props.state.runtime[rule.id]?.observations[String(props.accountId)]?.ready !== false &&
    account.model_controls?.[rule.model]?.enabled !== false
}
</script>
