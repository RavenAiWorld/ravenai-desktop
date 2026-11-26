<template>
  <section class="space-y-3 border-t border-gray-200 pt-4 dark:border-dark-600" data-testid="upstream-account-balance-settings">
    <div>
      <label class="input-label">{{ t('admin.accounts.upstreamBalance.provider') }}</label>
      <Select
        :model-value="modelValue.provider"
        :options="providerOptions"
        :aria-label="t('admin.accounts.upstreamBalance.provider')"
        data-testid="upstream-balance-provider"
        @update:model-value="update('provider', $event)"
      />
    </div>
    <template v-if="modelValue.provider === 'newapi'">
      <div>
        <label class="input-label">{{ t('admin.accounts.upstreamBalance.accessToken') }}</label>
        <input
          :value="modelValue.accessToken"
          type="password"
          autocomplete="new-password"
          class="input font-mono"
          :placeholder="hasStoredToken ? t('admin.accounts.upstreamBalance.keepToken') : ''"
          :aria-label="t('admin.accounts.upstreamBalance.accessToken')"
          data-testid="upstream-balance-token"
          @input="update('accessToken', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div>
        <label class="input-label">{{ t('admin.accounts.upstreamBalance.userId') }}</label>
        <input
          :value="modelValue.userId"
          type="text"
          inputmode="numeric"
          class="input font-mono"
          :aria-label="t('admin.accounts.upstreamBalance.userId')"
          data-testid="upstream-balance-user-id"
          @input="update('userId', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <details>
        <summary class="cursor-pointer text-sm text-gray-600 dark:text-gray-300">{{ t('admin.accounts.upstreamBalance.currencyOverride') }}</summary>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label class="input-label">{{ t('admin.accounts.upstreamBalance.quotaUnit') }}</label>
            <input
              :value="modelValue.quotaPerUnit ?? ''"
              type="number"
              min="0.000001"
              step="any"
              class="input"
              :aria-label="t('admin.accounts.upstreamBalance.quotaUnit')"
              data-testid="upstream-balance-quota-unit"
              @input="update('quotaPerUnit', ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value))"
            />
          </div>
          <div>
            <label class="input-label">{{ t('admin.accounts.upstreamBalance.currency') }}</label>
            <Select
              :model-value="modelValue.currency"
              :options="currencyOptions"
              :aria-label="t('admin.accounts.upstreamBalance.currency')"
              data-testid="upstream-balance-currency"
              @update:model-value="update('currency', $event)"
            />
          </div>
        </div>
      </details>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Select from '@/components/common/Select.vue'
import type { UpstreamBalanceConfig } from './upstreamBalanceConfig'

const props = defineProps<{ modelValue: UpstreamBalanceConfig; hasStoredToken?: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: UpstreamBalanceConfig): void }>()
const { t } = useI18n()
const providerOptions = computed(() => [
  { value: '', label: t('admin.accounts.upstreamBalance.disabled') },
  { value: 'newapi', label: 'NewAPI' }
])
const currencyOptions = computed(() => [
  { value: '', label: t('admin.accounts.upstreamBalance.autoCurrency') },
  { value: 'USD', label: 'USD' },
  { value: 'CNY', label: 'CNY' },
  { value: 'quota', label: t('admin.accounts.upstreamBalance.quota') }
])
const update = (field: keyof UpstreamBalanceConfig, value: unknown) => {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>
