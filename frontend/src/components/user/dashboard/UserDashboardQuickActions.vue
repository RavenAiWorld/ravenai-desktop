<template>
  <div class="card flex h-full flex-col">
    <div class="border-b border-rv-line px-5 py-3">
      <h2 class="text-sm font-semibold text-rv-fg">{{ t('dashboard.quickActions') }}</h2>
    </div>
    <div class="flex-1 p-1.5">
      <button @click="router.push('/keys')" class="qa-item group">
        <span class="qa-icon"><Icon name="key" size="sm" /></span>
        <span class="min-w-0 flex-1">
          <span class="qa-title">{{ t('dashboard.createApiKey') }}</span>
          <span class="qa-desc">{{ t('dashboard.generateNewKey') }}</span>
        </span>
        <Icon name="chevronRight" size="sm" class="qa-chevron" />
      </button>

      <button @click="router.push('/usage')" class="qa-item group">
        <span class="qa-icon"><Icon name="chart" size="sm" /></span>
        <span class="min-w-0 flex-1">
          <span class="qa-title">{{ t('dashboard.viewUsage') }}</span>
          <span class="qa-desc">{{ t('dashboard.checkDetailedLogs') }}</span>
        </span>
        <Icon name="chevronRight" size="sm" class="qa-chevron" />
      </button>

      <button v-if="canUseBatchImage" @click="router.push('/batch-image')" class="qa-item group">
        <span class="qa-icon"><Icon name="sparkles" size="sm" /></span>
        <span class="min-w-0 flex-1">
          <span class="qa-title">{{ t('dashboard.batchImageAgent') }}</span>
          <span class="qa-desc">{{ t('dashboard.batchImageAgentDesc') }}</span>
        </span>
        <Icon name="chevronRight" size="sm" class="qa-chevron" />
      </button>

      <button v-if="showAffiliate" data-test="personal-invite-action" @click="router.push('/affiliate')" class="qa-item group">
        <span class="qa-icon"><Icon name="users" size="sm" /></span>
        <span class="min-w-0 flex-1">
          <span class="qa-title">{{ t('nav.affiliate') }}</span>
          <span class="qa-desc">{{ t('affiliate.dashboardDescription') }}</span>
        </span>
        <Icon name="chevronRight" size="sm" class="qa-chevron" />
      </button>

      <button v-if="!authStore.isSimpleMode" @click="router.push('/redeem')" class="qa-item group">
        <span class="qa-icon"><Icon name="gift" size="sm" /></span>
        <span class="min-w-0 flex-1">
          <span class="qa-title">{{ t('dashboard.redeemCode') }}</span>
          <span class="qa-desc">{{ t('dashboard.addBalanceWithCode') }}</span>
        </span>
        <Icon name="chevronRight" size="sm" class="qa-chevron" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'
import { useAppStore, useAuthStore } from '@/stores'
import { FeatureFlags, resolveFeatureFlag } from '@/utils/featureFlags'
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()
const showAffiliate = computed(() => !authStore.isSimpleMode && resolveFeatureFlag(appStore.cachedPublicSettings, FeatureFlags.affiliate))
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()

onMounted(() => {
  void refreshBatchImageAccess()
})
</script>

<style scoped>
.qa-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  text-align: left;
  transition: background-color 0.15s;
}

.qa-item:hover {
  background: rgb(var(--rv-hover) / 0.7);
}

.qa-icon {
  display: flex;
  height: 32px;
  width: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgb(var(--rv-line));
  background: rgb(var(--rv-surface));
  color: rgb(var(--rv-fg-2));
}

.qa-title {
  display: block;
  font-size: 13.5px;
  font-weight: 500;
  color: rgb(var(--rv-fg));
}

.qa-desc {
  display: block;
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: rgb(var(--rv-fg-3));
}

.qa-chevron {
  flex-shrink: 0;
  color: rgb(var(--rv-fg-4));
  transition: transform 0.15s, color 0.15s;
}

.qa-item:hover .qa-chevron {
  color: rgb(var(--rv-fg-2));
  transform: translateX(2px);
}
</style>
