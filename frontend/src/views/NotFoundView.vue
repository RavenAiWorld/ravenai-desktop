<template>
  <div class="flex min-h-screen flex-col bg-rv-canvas text-rv-fg">
    <PublicHeader />
    <main class="flex flex-1 items-center justify-center px-4 py-20">
      <div class="w-full max-w-md text-center">
        <p class="font-mono text-sm font-medium text-rv-fg-3">404</p>
        <h1 class="mt-3 text-[28px] font-semibold tracking-tight text-rv-fg">
          {{ t('errors.pageNotFound') }}
        </h1>
        <p class="mt-3 text-[15px] leading-relaxed text-rv-fg-3">
          {{ t('errors.pageNotFoundDescription') }}
        </p>
        <div class="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <button type="button" class="btn btn-secondary" @click="goBack">
            <Icon name="arrowLeft" size="sm" />
            {{ t('errors.goBack') }}
          </button>
          <router-link to="/home" class="btn btn-primary">
            <Icon name="home" size="sm" />
            {{ t('errors.goHome') }}
          </router-link>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Icon from '@/components/icons/Icon.vue'
import PublicHeader from '@/components/layout/PublicHeader.vue'

const { t } = useI18n()
const router = useRouter()

function goBack(): void {
  router.back()
}
</script>
