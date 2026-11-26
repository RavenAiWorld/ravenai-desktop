<template>
  <AppLayout>
    <section class="space-y-6" :aria-label="t('creditPurchase.title')">
      <div class="flex min-h-10 flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-gray-500 dark:text-dark-400">
          {{ t('redeem.currentBalance') }}
          <span class="ml-2 font-semibold tabular-nums text-gray-900 dark:text-white">
            ${{ authStore.user?.balance?.toFixed(2) || '0.00' }}
          </span>
        </p>
        <router-link to="/redeem" class="btn btn-secondary btn-sm" data-test="redeem-link">
          <Icon name="gift" size="sm" />
          {{ t('creditPurchase.redeem') }}
        </router-link>
      </div>

      <div v-if="settingsLoading" class="flex items-center gap-2 py-6 text-sm text-gray-500" role="status">
        <Icon name="refresh" size="sm" class="animate-spin" />
        {{ t('common.loading') }}
      </div>
      <div v-else-if="settingsFailed" class="space-y-3 py-6" role="alert">
        <p class="text-sm text-red-500">{{ t('creditPurchase.loadFailed') }}</p>
        <button type="button" class="btn btn-secondary btn-sm" @click="loadSettings">
          <Icon name="refresh" size="sm" />
          {{ t('common.tryAgain') }}
        </button>
      </div>
      <p v-else-if="!shopUrl" class="py-6 text-sm text-gray-500">
        {{ t('creditPurchase.unavailable') }}
      </p>
      <div v-else class="space-y-3 border-t border-gray-100 py-6 dark:border-dark-800">
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" class="btn btn-primary" data-test="open-credit-shop" @click="openShop">
            <Icon name="externalLink" size="sm" />
            {{ t('creditPurchase.title') }}
          </button>
          <a
            v-if="popupBlocked"
            :href="shopUrl"
            target="_blank"
            rel="noopener noreferrer"
            referrerpolicy="no-referrer"
            class="btn btn-secondary"
          >
            <Icon name="externalLink" size="sm" />
            {{ t('creditPurchase.openNewTab') }}
          </a>
        </div>
        <p v-if="popupBlocked" class="text-sm text-amber-700 dark:text-amber-400" role="alert">
          {{ t('creditPurchase.popupBlocked') }}
        </p>
      </div>
    </section>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import { getCreditShopUrl, openCreditShopPopup } from '@/utils/creditShop'

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const shopUrl = computed(() => getCreditShopUrl(appStore.cachedPublicSettings))
const settingsLoading = ref(!appStore.publicSettingsLoaded)
const settingsFailed = ref(false)
const popupBlocked = ref(false)

function openShop() {
  popupBlocked.value = !openCreditShopPopup(shopUrl.value)
}

async function loadSettings() {
  settingsLoading.value = true
  settingsFailed.value = false
  try {
    const result = await appStore.fetchPublicSettings(true)
    settingsFailed.value = !result && !appStore.publicSettingsLoaded
  } catch {
    settingsFailed.value = true
  } finally {
    settingsLoading.value = false
  }
}

onMounted(() => {
  if (!appStore.publicSettingsLoaded) void loadSettings()
})
</script>
