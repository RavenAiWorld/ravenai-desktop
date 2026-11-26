<template>
  <footer class="pub-footer">
    <div class="pub-footer-inner">
      <div class="pub-footer-brand">
        <RouterLink to="/home" class="pub-footer-name">{{ siteName }}</RouterLink>
        <p>{{ t('home.raven.footerDescription') }}</p>
      </div>
      <nav class="pub-footer-links" :aria-label="t('home.raven.navigation')">
        <RouterLink v-if="showModelPlaza" to="/model-plaza">{{ t('nav.modelPlaza') }}</RouterLink>
        <RouterLink to="/key-usage">{{ t('home.raven.keyUsage') }}</RouterLink>
        <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">{{ t('home.docs') }}</a>
        <RouterLink v-for="doc in legalDocuments" :key="doc.id" :to="'/legal/' + doc.id">{{ doc.title }}</RouterLink>
      </nav>
    </div>
    <div class="pub-footer-bottom">
      <span>© {{ currentYear }} {{ siteName }}</span>
      <span v-if="legalDocuments.length">{{ t('legal.loginAgreementPrompt.regionFooter') }}</span>
      <slot name="notice" />
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore } from '@/stores'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, resolveFeatureFlag } from '@/utils/featureFlags'

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const siteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Ravenai')
const docUrl = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || ''))
const showModelPlaza = computed(() => resolveFeatureFlag(appStore.cachedPublicSettings, FeatureFlags.modelPlaza)
  && (authStore.isAuthenticated || appStore.cachedPublicSettings?.model_plaza_require_auth !== true))
const legalDocuments = computed(() => appStore.cachedPublicSettings?.login_agreement_enabled
  ? (appStore.cachedPublicSettings.login_agreement_documents ?? []).filter((doc) => ['service-terms', 'privacy-policy'].includes(doc.id)) : [])
const currentYear = new Date().getFullYear()
</script>

<style scoped>
.pub-footer {
  border-top: 1px solid rgb(var(--rv-line));
  background: rgb(var(--rv-subtle));
}

.pub-footer-inner,
.pub-footer-bottom {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding-left: 24px;
  padding-right: 24px;
}

.pub-footer-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px 48px;
  padding-top: 36px;
  padding-bottom: 28px;
}

.pub-footer-name {
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--rv-fg));
}

.pub-footer-brand p {
  margin-top: 6px;
  font-size: 13px;
  color: rgb(var(--rv-fg-3));
}

.pub-footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
}

.pub-footer-links a {
  font-size: 13px;
  color: rgb(var(--rv-fg-3));
  transition: color 0.15s;
}

.pub-footer-links a:hover {
  color: rgb(var(--rv-fg));
}

.pub-footer-bottom {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 24px;
  padding-top: 16px;
  padding-bottom: 24px;
  border-top: 1px solid rgb(var(--rv-line));
  font-size: 12px;
  color: rgb(var(--rv-fg-4));
}

@media (max-width: 640px) {
  .pub-footer-inner,
  .pub-footer-bottom {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
