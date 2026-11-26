<template>
  <header class="pub-header" @keydown.esc="closeMenu">
    <div class="pub-container pub-header-inner">
      <RouterLink to="/home" class="pub-brand">
        <span class="pub-logo"><img :src="siteLogo || '/logo.svg'" alt="" /></span>
        <span class="truncate">{{ siteName }}</span>
      </RouterLink>

      <nav class="pub-nav" :aria-label="t('home.raven.navigation')">
        <RouterLink v-if="showModelPlaza" to="/model-plaza" :class="{ 'is-active': active === 'plaza' }">{{ t('nav.modelPlaza') }}</RouterLink>
        <RouterLink to="/key-usage" :class="{ 'is-active': active === 'key-usage' }">{{ t('home.raven.keyUsage') }}</RouterLink>
        <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">{{ t('home.docs') }}</a>
      </nav>

      <div class="pub-actions">
        <LocaleSwitcher />
        <button type="button" class="pub-icon-btn" :aria-label="isDark ? t('home.switchToLight') : t('home.switchToDark')" @click="setDarkMode(!isDark)">
          <Icon :name="isDark ? 'sun' : 'moon'" size="sm" />
        </button>
        <template v-if="isAuthenticated">
          <RouterLink :to="consolePath" class="btn btn-primary btn-sm home-nav-console">{{ t('home.dashboard') }}</RouterLink>
        </template>
        <template v-else>
          <RouterLink to="/login" class="btn btn-ghost btn-sm hidden sm:inline-flex">{{ t('home.login') }}</RouterLink>
          <RouterLink :to="registrationEnabled ? '/register' : '/login'" class="btn btn-primary btn-sm">
            {{ registrationEnabled ? t('home.raven.register') : t('home.login') }}
          </RouterLink>
        </template>
        <button
          ref="menuButton"
          type="button"
          class="pub-icon-btn md:hidden"
          :aria-label="t('home.raven.navigation')"
          :aria-expanded="menuOpen"
          aria-controls="pub-mobile-menu"
          @click="menuOpen = !menuOpen"
        >
          <Icon :name="menuOpen ? 'x' : 'menu'" size="sm" />
        </button>
      </div>
    </div>

    <Transition name="pub-menu">
      <nav v-if="menuOpen" id="pub-mobile-menu" class="pub-mobile-nav">
        <RouterLink to="/home" @click="menuOpen = false">{{ t('home.raven.home') }}</RouterLink>
        <RouterLink v-if="showModelPlaza" to="/model-plaza" @click="menuOpen = false">{{ t('nav.modelPlaza') }}</RouterLink>
        <RouterLink to="/key-usage" @click="menuOpen = false">{{ t('home.raven.keyUsage') }}</RouterLink>
        <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">{{ t('home.docs') }}</a>
        <RouterLink :to="consolePath" @click="menuOpen = false">{{ isAuthenticated ? t('home.dashboard') : t('home.login') }}</RouterLink>
      </nav>
    </Transition>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, resolveFeatureFlag } from '@/utils/featureFlags'
import { setDarkMode, useDarkMode } from '@/composables/useDarkMode'

defineProps<{
  /** Highlights the matching navigation entry. */
  active?: 'home' | 'plaza' | 'key-usage'
}>()

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const isDark = useDarkMode()

const siteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Ravenai')
const siteLogo = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const docUrl = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || ''))
const isAuthenticated = computed(() => authStore.isAuthenticated)
const consolePath = computed(() => isAuthenticated.value ? (authStore.isAdmin ? '/admin/dashboard' : '/dashboard') : '/login')
const registrationEnabled = computed(() => appStore.cachedPublicSettings?.registration_enabled !== false)
const showModelPlaza = computed(() => resolveFeatureFlag(appStore.cachedPublicSettings, FeatureFlags.modelPlaza)
  && (isAuthenticated.value || appStore.cachedPublicSettings?.model_plaza_require_auth !== true))

const menuOpen = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)

async function closeMenu() {
  if (!menuOpen.value) return
  menuOpen.value = false
  await nextTick()
  menuButton.value?.focus()
}
</script>

<style scoped>
.pub-header {
  position: sticky;
  top: 0;
  z-index: 40;
  border-bottom: 1px solid rgb(var(--rv-line));
  background: rgb(var(--rv-canvas) / 0.82);
  backdrop-filter: saturate(180%) blur(12px);
}

.pub-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.pub-header-inner {
  display: flex;
  align-items: center;
  gap: 28px;
  height: 60px;
}

.pub-brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: rgb(var(--rv-fg));
}

.pub-logo {
  display: flex;
  height: 26px;
  width: 26px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 6px;
}

.pub-logo img {
  height: 100%;
  width: 100%;
  object-fit: contain;
}

.dark .pub-logo {
  background: #fff;
  padding: 3px;
}

.pub-nav {
  display: none;
  align-items: center;
  gap: 4px;
}

.pub-nav a {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13.5px;
  color: rgb(var(--rv-fg-3));
  transition: color 0.15s, background-color 0.15s;
}

.pub-nav a:hover,
.pub-nav a.is-active {
  color: rgb(var(--rv-fg));
}

.pub-nav a:hover {
  background: rgb(var(--rv-hover));
}

.pub-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.pub-icon-btn {
  display: grid;
  height: 32px;
  width: 32px;
  place-items: center;
  border-radius: 6px;
  color: rgb(var(--rv-fg-3));
  transition: color 0.15s, background-color 0.15s;
}

.pub-icon-btn:hover {
  background: rgb(var(--rv-hover));
  color: rgb(var(--rv-fg));
}

.pub-mobile-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 16px 14px;
  border-top: 1px solid rgb(var(--rv-line));
  background: rgb(var(--rv-canvas));
}

.pub-mobile-nav a {
  padding: 10px 8px;
  border-radius: 6px;
  font-size: 14px;
  color: rgb(var(--rv-fg-2));
}

.pub-mobile-nav a:hover {
  background: rgb(var(--rv-hover));
}

.pub-menu-enter-active,
.pub-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.pub-menu-enter-from,
.pub-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (min-width: 768px) {
  .pub-nav {
    display: flex;
  }
}

@media (max-width: 640px) {
  .pub-container {
    padding: 0 16px;
  }

  .pub-header-inner {
    height: 56px;
    gap: 12px;
  }
}
</style>
