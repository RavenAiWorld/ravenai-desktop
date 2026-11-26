<template>
  <div class="auth-shell">
    <header class="auth-top">
      <span class="auth-edition">Ravenai Desktop</span>
      <div class="auth-actions">
        <LocaleSwitcher />
        <button type="button" class="auth-icon-btn" :title="isDark ? t('home.switchToLight') : t('home.switchToDark')" :aria-label="isDark ? t('home.switchToLight') : t('home.switchToDark')" @click="setDarkMode(!isDark)">
          <Icon :name="isDark ? 'sun' : 'moon'" size="sm" />
        </button>
      </div>
    </header>
    <main class="auth-stage">
      <div class="auth-column">
        <RouterLink to="/login" class="auth-brand">
          <span class="auth-logo"><img :src="siteLogo || '/logo.svg'" alt="" /></span>
          <span>{{ siteName }}</span>
        </RouterLink>
        <div class="auth-form"><slot /></div>
        <div class="auth-form-footer"><slot name="footer" /></div>
      </div>
    </main>
    <footer class="auth-footer"><span>© {{ currentYear }} {{ siteName }}</span><span>ravenaiworld.org</span></footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores'
import { sanitizeUrl } from '@/utils/url'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { setDarkMode, useDarkMode } from '@/composables/useDarkMode'

const { t } = useI18n()
const appStore = useAppStore()
const siteName = computed(() => appStore.siteName || 'Ravenai')
const siteLogo = computed(() => sanitizeUrl(appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const currentYear = new Date().getFullYear()
const isDark = useDarkMode()
onMounted(() => { void appStore.fetchPublicSettings() })
</script>

<style scoped>
.auth-shell { display: flex; flex-direction: column; min-height: calc(100dvh - 42px); background: rgb(var(--rv-surface)); color: rgb(var(--rv-fg)); }
.auth-top { display: flex; align-items: center; justify-content: space-between; min-height: 64px; padding: 0 36px; }
.auth-edition { font-size: 12px; font-weight: 500; color: rgb(var(--rv-fg-3)); }
.auth-actions { display: flex; align-items: center; gap: 6px; }
.auth-icon-btn { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 6px; color: rgb(var(--rv-fg-3)); }
.auth-icon-btn:hover { background: rgb(var(--rv-hover)); color: rgb(var(--rv-fg)); }
.auth-stage { display: flex; flex: 1; align-items: center; justify-content: center; padding: 20px 24px 40px; }
.auth-column { width: 100%; max-width: 368px; min-width: 0; }
.auth-brand { display: flex; align-items: center; justify-content: center; gap: 13px; margin: 0 auto 32px; font-size: 30px; line-height: 40px; font-weight: 650; }
.auth-logo { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 8px; overflow: hidden; }
.auth-logo img { width: 100%; height: 100%; object-fit: contain; }
.dark .auth-logo { background: #fff; padding: 4px; }
.auth-form :deep(h2) { font-size: 22px; line-height: 30px; font-weight: 600; color: rgb(var(--rv-fg)); }
.auth-form :deep(h2 + p) { margin-top: 6px; font-size: 13px; color: rgb(var(--rv-fg-3)); }
.auth-form :deep(.input) { min-height: 44px; font-size: 14px; background: rgb(var(--rv-canvas)); }
.auth-form :deep(.btn.w-full) { min-height: 44px; font-size: 14px; }
.auth-form :deep(.input-label) { margin-bottom: 7px; font-size: 13px; }
.auth-form-footer { margin-top: 24px; text-align: center; font-size: 13px; color: rgb(var(--rv-fg-3)); }
.auth-form-footer :deep(a) { font-weight: 600; }
.auth-footer { display: flex; justify-content: space-between; gap: 16px; padding: 20px 36px; font-size: 11px; color: rgb(var(--rv-fg-4)); border-top: 1px solid rgb(var(--rv-line)); }
@media (max-height: 760px) { .auth-stage { align-items: flex-start; padding-top: 12px; } .auth-brand { margin-bottom: 24px; } }
@media (max-width: 640px) { .auth-top { padding: 0 20px; } .auth-footer { padding: 18px 20px; } }
</style>
