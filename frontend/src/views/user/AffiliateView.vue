<template>
  <AppLayout>
    <div class="space-y-6">
      <div v-if="loading" class="flex justify-center py-12">
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"
        ></div>
      </div>

      <div v-else-if="loadError" role="alert" class="space-y-3 py-8 text-sm text-red-600 dark:text-red-400">
        <p>{{ loadError }}</p>
        <button class="btn btn-secondary btn-sm" @click="loadAffiliateDetail()">
          <Icon name="refresh" size="sm" />
          <span>{{ t('common.refresh') }}</span>
        </button>
      </div>

      <template v-else-if="detail">
        <section class="card p-5 sm:p-6" aria-labelledby="personal-invite-heading">
          <!-- The layout heading already shows the title; keep this one for the section's accessible name. -->
          <h2 id="personal-invite-heading" class="sr-only">{{ t('affiliate.title') }}</h2>
          <p data-test="invite-reward-rule" class="text-[15px] font-medium text-rv-fg">
            {{ t('affiliate.inviteRewardRule', { rate: `${formattedRebateRate}%` }) }}
          </p>
          <p data-test="invite-reward-example" class="mt-1 text-sm text-rv-fg-3">
            {{ t('affiliate.rewardExample', { amount: 20, reward: exampleReward }) }}
          </p>

          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <p class="input-label !mb-0">{{ t('affiliate.yourCode') }}</p>
              <div class="flex flex-col items-stretch gap-2 rounded-lg border border-rv-line bg-rv-subtle py-1.5 pl-3 pr-1.5 sm:flex-row sm:items-center">
                <code class="min-w-0 break-all font-mono text-sm font-semibold text-rv-fg sm:flex-1 sm:truncate">{{ detail.aff_code }}</code>
                <button class="btn btn-secondary btn-sm w-full sm:w-auto sm:shrink-0" @click="copyCode">
                  <Icon name="copy" size="sm" />
                  <span>{{ t('affiliate.copyCode') }}</span>
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <p class="input-label !mb-0">{{ t('affiliate.inviteLink') }}</p>
              <div class="flex flex-col items-stretch gap-2 rounded-lg border border-rv-line bg-rv-subtle py-1.5 pl-3 pr-1.5 sm:flex-row sm:items-center">
                <code class="min-w-0 break-all font-mono text-[13px] text-rv-fg-2 sm:flex-1 sm:truncate">{{ inviteLink }}</code>
                <button class="btn btn-secondary btn-sm w-full sm:w-auto sm:shrink-0" @click="copyInviteLink">
                  <Icon name="copy" size="sm" />
                  <span>{{ t('affiliate.copyLink') }}</span>
                </button>
              </div>
            </div>
          </div>

          <p class="mt-4 text-[13px] text-rv-fg-3">
            {{ t('affiliate.cashbackRule', { rate: `${formattedRebateRate}%` }) }}
          </p>
        </section>

        <section class="stat-strip lg:grid-cols-4">
          <div class="stat-cell">
            <p class="stat-cell-label"><Icon name="dollar" size="sm" />{{ t('affiliate.stats.rebateRate') }}</p>
            <p class="stat-cell-value">{{ formattedRebateRate }}<span class="stat-cell-unit">%</span></p>
            <p class="stat-cell-meta">{{ t('affiliate.stats.rebateRateHint') }}</p>
          </div>
          <div class="stat-cell">
            <p class="stat-cell-label"><Icon name="users" size="sm" />{{ t('affiliate.stats.invitedUsers') }}</p>
            <p class="stat-cell-value">{{ formatCount(detail.aff_count) }}</p>
          </div>
          <div class="stat-cell">
            <p class="stat-cell-label"><Icon name="creditCard" size="sm" />{{ t('affiliate.stats.balanceCredited') }}</p>
            <p class="stat-cell-value">{{ formatCurrency(detail.redeem_balance_total ?? 0) }}</p>
          </div>
          <div class="stat-cell">
            <p class="stat-cell-label"><Icon name="chartBar" size="sm" />{{ t('affiliate.stats.totalQuota') }}</p>
            <p class="stat-cell-value">{{ formatCurrency(detail.aff_history_quota) }}</p>
            <p v-if="detail.aff_frozen_quota > 0" class="stat-cell-meta text-amber-700 dark:text-amber-400">
              {{ t('affiliate.stats.frozenQuota') }}: {{ formatCurrency(detail.aff_frozen_quota) }}
            </p>
          </div>
        </section>

        <div v-if="detail.aff_quota > 0 || detail.aff_frozen_quota > 0" class="card p-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('affiliate.transfer.title') }}</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-dark-400">{{ t('affiliate.transfer.description') }}</p>
              <p class="mt-2 font-mono text-sm font-medium text-rv-fg">
                {{ formatCurrency(detail.aff_quota) }}
              </p>
            </div>
            <button
              class="btn btn-primary"
              :disabled="transferring || detail.aff_quota <= 0"
              @click="transferQuota"
            >
              <Icon v-if="transferring" name="refresh" size="sm" class="animate-spin" />
              <Icon v-else name="dollar" size="sm" />
              <span>{{ transferring ? t('affiliate.transfer.transferring') : t('affiliate.transfer.button') }}</span>
            </button>
          </div>
          <p v-if="detail.aff_quota <= 0" class="mt-3 text-sm text-amber-600 dark:text-amber-400">
            {{ t('affiliate.transfer.empty') }}
          </p>
        </div>

        <section class="card overflow-hidden">
          <h3 class="border-b border-rv-line px-5 py-3 text-sm font-semibold text-rv-fg">{{ t('affiliate.invitees.title') }}</h3>
          <div v-if="detail.invitees.length === 0" class="py-10 text-center text-sm text-rv-fg-3">
            {{ t('affiliate.invitees.empty') }}
          </div>
          <div v-else class="overflow-x-auto">
            <table class="table min-w-[560px] text-left">
              <thead>
                <tr>
                  <th>{{ t('affiliate.invitees.columns.email') }}</th>
                  <th>{{ t('affiliate.invitees.columns.username') }}</th>
                  <th class="!text-right">{{ t('affiliate.invitees.columns.rebate') }}</th>
                  <th>{{ t('affiliate.invitees.columns.joinedAt') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in detail.invitees"
                  :key="item.user_id"
                >
                  <td class="text-rv-fg">{{ item.email || '-' }}</td>
                  <td>{{ item.username || '-' }}</td>
                  <td class="text-right font-mono font-medium text-rv-fg">{{ formatCurrency(item.total_rebate) }}</td>
                  <td>{{ formatDateTime(item.created_at) || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import userAPI from '@/api/user'
import type { UserAffiliateDetail } from '@/types'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useClipboard } from '@/composables/useClipboard'
import { formatCurrency, formatBusinessDateTime as formatDateTime } from '@/utils/format'
import { extractApiErrorMessage } from '@/utils/apiError'

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const { copyToClipboard } = useClipboard()

const loading = ref(true)
const loadError = ref<string | null>(null)
const transferring = ref(false)
const detail = ref<UserAffiliateDetail | null>(null)

const inviteLink = computed(() => {
  if (!detail.value) return ''
  if (typeof window === 'undefined') return `/register?aff=${encodeURIComponent(detail.value.aff_code)}`
  return `${window.location.origin}/register?aff=${encodeURIComponent(detail.value.aff_code)}`
})

// Rebate rate is a percentage in the range [0, 100]; backend already clamps it.
// We trim trailing zeros (e.g. 20.00 → "20", 12.50 → "12.5") for a cleaner UI.
const formattedRebateRate = computed(() => {
  const v = detail.value?.effective_rebate_rate_percent ?? 0
  const rounded = Math.round(v * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString()
})

const exampleReward = computed(() => {
  const amount = 20 * (detail.value?.effective_rebate_rate_percent ?? 0) / 100
  return Math.round(amount * 1e8) / 1e8
})

function formatCount(value: number): string {
  return value.toLocaleString()
}

async function loadAffiliateDetail(silent = false): Promise<void> {
  loadError.value = null
  if (!silent) {
    loading.value = true
  }
  try {
    detail.value = await userAPI.getAffiliateDetail()
  } catch (error) {
    const message = extractApiErrorMessage(error, t('affiliate.loadFailed'))
    if (!detail.value) loadError.value = message
    appStore.showError(message)
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

async function copyCode(): Promise<void> {
  if (!detail.value?.aff_code) return
  await copyToClipboard(detail.value.aff_code, t('affiliate.codeCopied'))
}

async function copyInviteLink(): Promise<void> {
  if (!inviteLink.value) return
  await copyToClipboard(inviteLink.value, t('affiliate.linkCopied'))
}

async function transferQuota(): Promise<void> {
  if (!detail.value || detail.value.aff_quota <= 0 || transferring.value) return
  transferring.value = true
  try {
    const resp = await userAPI.transferAffiliateQuota()
    appStore.showSuccess(t('affiliate.transfer.success', { amount: formatCurrency(resp.transferred_quota) }))
    await Promise.all([
      loadAffiliateDetail(true),
      authStore.refreshUser().catch(() => undefined),
    ])
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('affiliate.transferFailed')))
  } finally {
    transferring.value = false
  }
}

onMounted(() => {
  void loadAffiliateDetail()
})
</script>
