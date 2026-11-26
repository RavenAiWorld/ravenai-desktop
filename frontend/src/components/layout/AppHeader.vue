<template>
  <header class="console-topbar sticky top-0 z-30">
    <div class="console-topbar-inner">
      <!-- Left: Mobile Menu Toggle + Breadcrumb -->
      <div class="flex min-w-0 items-center gap-2">
        <button
          @click="toggleMobileSidebar"
          class="btn-ghost btn-icon -ml-1 lg:hidden"
          :aria-label="t('common.toggleMenu')"
          :aria-expanded="appStore.mobileOpen"
          aria-controls="console-sidebar"
        >
          <Icon name="menu" size="md" />
        </button>

        <nav class="flex min-w-0 items-center gap-1.5 text-[13px]" :aria-label="t('common.breadcrumb')">
          <span class="hidden shrink-0 text-rv-fg-3 sm:inline">{{ sectionLabel }}</span>
          <Icon name="chevronRight" size="xs" class="hidden shrink-0 text-rv-fg-4 sm:block" />
          <span class="truncate font-medium text-rv-fg" aria-current="page">{{ pageTitle }}</span>
        </nav>
      </div>

      <!-- Right: Shortcuts + Announcements + Language + Balance + User Dropdown -->
      <div class="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <!-- Docs Link -->
        <a
          v-if="docUrl"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="console-topbar-link hidden sm:flex"
        >
          <Icon name="book" size="sm" />
          <span>{{ t('nav.docs') }}</span>
        </a>

        <!-- Model Plaza Entry (icon only below sm) -->
        <router-link
          v-if="user && modelPlazaEnabled"
          :to="{ path: '/model-plaza', query: { embedded: '1' } }"
          :title="t('nav.modelPlaza')"
          :aria-label="t('nav.modelPlaza')"
          class="console-nav-link relative shrink-0 whitespace-nowrap max-sm:px-1"
          :data-nav-tone="selfNavTone('/model-plaza')"
        >
          <span class="console-nav-icon" aria-hidden="true">
            <Icon name="priceTag" class="h-[18px] w-[18px]" />
          </span>
          <span class="hidden sm:inline">{{ t('nav.modelPlaza') }}</span>
        </router-link>

        <router-link
          v-if="user"
          to="/support"
          :title="t('support.title')"
          :aria-label="t('support.title')"
          class="console-nav-link relative shrink-0 whitespace-nowrap max-sm:px-1"
          :data-nav-tone="selfNavTone('/support')"
          data-testid="support-topbar-link"
        >
          <span class="console-nav-icon" aria-hidden="true">
            <Icon name="chatBubble" class="h-[18px] w-[18px]" />
          </span>
          <span class="hidden sm:inline">{{ t('support.title') }}</span>
          <span v-if="ticketBadges.userUnread" class="ticket-topbar-badge">
            {{ Math.min(ticketBadges.userUnread, 99) }}{{ ticketBadges.userUnread > 99 ? '+' : '' }}
          </span>
        </router-link>

        <!-- Announcement Bell -->
        <AnnouncementBell v-if="user" />

        <!-- Language Switcher -->
        <LocaleSwitcher />

        <!-- Subscription Progress (admins only, since regular users have no 我的订阅 page; not mounted at all when the feature is off) -->
        <SubscriptionProgressMini v-if="user && subscriptionFeatureEnabled && authStore.isAdmin" />

        <span class="mx-1 hidden h-5 w-px bg-rv-line sm:block" aria-hidden="true"></span>

        <!-- Balance Display -->
        <div
          v-if="user"
          class="console-balance group relative hidden items-center gap-1.5 sm:flex"
        >
          <span class="text-xs text-rv-fg-3">{{ t('common.balance') }}</span>
          <span class="font-mono text-[13px] font-medium text-rv-fg">
            {{ formatHeaderMoney(availableBalance) }}
          </span>
          <span
            v-if="frozenBalance > 0"
            class="rounded-full bg-amber-50 px-1.5 py-0.5 text-2xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          >
            {{ balanceFrozenLabel }}
          </span>
          <div
            class="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden w-56 rounded-lg border border-rv-line bg-rv-raised p-3 text-xs shadow-lg group-hover:block"
          >
            <div class="flex items-center justify-between">
              <span class="text-rv-fg-3">{{ balanceAvailableText }}</span>
              <span class="font-mono font-medium text-rv-fg">{{ formatHeaderMoney(availableBalance) }}</span>
            </div>
            <div class="mt-2 flex items-center justify-between">
              <span class="text-rv-fg-3">{{ balanceFrozenText }}</span>
              <span class="font-mono font-medium text-amber-700 dark:text-amber-300">{{ formatHeaderMoney(frozenBalance) }}</span>
            </div>
            <div class="mt-2 border-t border-rv-line pt-2">
              <div class="flex items-center justify-between">
                <span class="text-rv-fg-3">{{ balanceTotalText }}</span>
                <span class="font-mono font-semibold text-rv-fg">{{ formatHeaderMoney(totalBalance) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- User Dropdown -->
        <div v-if="user" class="relative" ref="dropdownRef">
          <button
            @click="toggleDropdown"
            class="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-rv-hover"
            :aria-label="t('common.userMenu')"
            :aria-expanded="dropdownOpen"
          >
            <div class="console-avatar flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-2xs font-semibold">
              <img
                v-if="avatarUrl"
                :src="avatarUrl"
                :alt="displayName"
                class="h-full w-full object-cover"
              >
              <span v-else>{{ userInitials }}</span>
            </div>
            <Icon name="chevronDown" size="xs" class="hidden text-rv-fg-4 md:block" />
          </button>

          <!-- Dropdown Menu -->
          <transition name="dropdown">
            <div v-if="dropdownOpen" class="dropdown right-0 mt-2 w-60">
              <!-- User Info -->
              <div class="px-2.5 pb-2.5 pt-2">
                <div class="truncate text-sm font-medium text-rv-fg">
                  {{ displayName }}
                </div>
                <div class="truncate text-xs text-rv-fg-3">{{ user.email }}</div>
                <span class="mt-1.5 inline-flex rounded-full bg-rv-muted px-2 py-0.5 text-2xs font-medium text-rv-fg-2">{{ t('admin.users.roles.' + user.role) }}</span>
              </div>

              <!-- Balance (mobile only) -->
              <div class="border-t border-rv-line px-2.5 py-2 sm:hidden">
                <div class="text-xs text-rv-fg-3">
                  {{ t('common.balance') }}
                </div>
                <div class="font-mono text-sm font-semibold text-rv-fg">
                  {{ formatHeaderMoney(availableBalance) }}
                </div>
                <div v-if="frozenBalance > 0" class="mt-1 text-xs text-amber-600 dark:text-amber-300">
                  {{ balanceFrozenText }} {{ formatHeaderMoney(frozenBalance) }}
                </div>
              </div>

              <div class="border-t border-rv-line pt-1">
                <router-link to="/profile" @click="closeDropdown" class="dropdown-item">
                  <Icon name="user" size="sm" />
                  {{ t('nav.profile') }}
                </router-link>

                <router-link to="/keys" @click="closeDropdown" class="dropdown-item">
                  <Icon name="key" size="sm" />
                  {{ t('nav.apiKeys') }}
                </router-link>

                <a
                  v-if="authStore.isAdmin"
                  href="https://github.com/Wei-Shaw/sub2api"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click="closeDropdown"
                  class="dropdown-item"
                >
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                    />
                  </svg>
                  {{ t('nav.github') }}
                </a>

              </div>

              <!-- Contact Support (only show if configured) -->
              <div
                v-if="contactInfo"
                class="mt-1 border-t border-rv-line px-2.5 py-2"
              >
                <div class="flex items-center gap-2 text-xs text-rv-fg-3">
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                    />
                  </svg>
                  <span>{{ t('common.contactSupport') }}:</span>
                  <span class="font-medium text-rv-fg-2">{{
                    contactInfo
                  }}</span>
                </div>
              </div>

              <div v-if="showOnboardingButton" class="mt-1 border-t border-rv-line pt-1">
                <button @click="handleReplayGuide" class="dropdown-item w-full">
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 14a1 1 0 110 2 1 1 0 010-2zm1.07-7.75c0-.6-.49-1.25-1.32-1.25-.7 0-1.22.4-1.43 1.02a1 1 0 11-1.9-.62A3.41 3.41 0 0111.8 5c2.02 0 3.25 1.4 3.25 2.9 0 2-1.83 2.55-2.43 3.12-.43.4-.47.75-.47 1.23a1 1 0 01-2 0c0-1 .16-1.82 1.1-2.7.69-.64 1.82-1.05 1.82-2.06z"
                    />
                  </svg>
                  {{ $t('onboarding.restartTour') }}
                </button>
              </div>

              <div class="mt-1 border-t border-rv-line pt-1">
                <button
                  @click="handleLogout"
                  class="dropdown-item w-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                    />
                  </svg>
                  {{ t('nav.logout') }}
                </button>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore, useOnboardingStore } from '@/stores'
import { useSupportTicketStore } from '@/stores/supportTickets'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import SubscriptionProgressMini from '@/components/common/SubscriptionProgressMini.vue'
import AnnouncementBell from '@/components/common/AnnouncementBell.vue'
import Icon from '@/components/icons/Icon.vue'
import { selfNavTone } from './selfNavTone'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import { usePageMeta } from '@/composables/usePageMeta'

const router = useRouter()
const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const ticketBadges = useSupportTicketStore()
const onboardingStore = useOnboardingStore()
const { pageTitle, sectionLabel } = usePageMeta()

const user = computed(() => authStore.user)
const dropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const contactInfo = computed(() => appStore.contactInfo)
const docUrl = computed(() => sanitizeUrl(appStore.docUrl))
const modelPlazaEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.modelPlaza))
const avatarUrl = computed(() => user.value?.avatar_url?.trim() || '')
const availableBalance = computed(() => Number(user.value?.balance || 0))
const frozenBalance = computed(() => Number(user.value?.frozen_balance || 0))
const totalBalance = computed(() => availableBalance.value + frozenBalance.value)
const balanceAvailableText = computed(() => t('common.availableBalance') === 'common.availableBalance' ? '可用余额' : t('common.availableBalance'))
const balanceFrozenText = computed(() => t('common.frozenBalance') === 'common.frozenBalance' ? '冻结金额' : t('common.frozenBalance'))
const balanceTotalText = computed(() => t('common.totalBalance') === 'common.totalBalance' ? '总余额' : t('common.totalBalance'))
const balanceFrozenLabel = computed(() => `${balanceFrozenText.value} ${formatHeaderMoney(frozenBalance.value)}`)

// 只在标准模式的管理员下显示新手引导按钮
const showOnboardingButton = computed(() => {
  return !authStore.isSimpleMode && user.value?.role === 'admin'
})

const userInitials = computed(() => {
  if (!user.value) return ''
  // Prefer username, fallback to email
  if (user.value.username) {
    return user.value.username.substring(0, 2).toUpperCase()
  }
  if (user.value.email) {
    // Get the part before @ and take first 2 chars
    const localPart = user.value.email.split('@')[0]
    return localPart.substring(0, 2).toUpperCase()
  }
  return ''
})

const displayName = computed(() => {
  if (!user.value) return ''
  return user.value.username || user.value.email?.split('@')[0] || ''
})

// 订阅功能关闭时不挂载顶栏订阅徽章（组件 onMounted 会拉取订阅接口）。
const subscriptionFeatureEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.subscription))

function toggleMobileSidebar() {
  appStore.toggleMobileSidebar()
}

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function closeDropdown() {
  dropdownOpen.value = false
}

async function handleLogout() {
  closeDropdown()
  try {
    await authStore.logout()
  } catch (error) {
    // Ignore logout errors - still redirect to login
    console.error('Logout error:', error)
  }
  await router.push('/login')
}

function handleReplayGuide() {
  closeDropdown()
  onboardingStore.replay()
}

function formatHeaderMoney(value: number) {
  if (!Number.isFinite(value)) return '$0.00'
  return `$${value.toFixed(2)}`
}

function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.console-topbar {
  border-bottom: 1px solid rgb(var(--rv-line));
  background: rgb(var(--rv-canvas) / 0.85);
  backdrop-filter: saturate(180%) blur(12px);
}

.console-topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: var(--rv-header-h);
  padding: 0 32px;
}

.console-topbar-link {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--rv-fg-3));
  transition: background-color 0.15s, color 0.15s;
}

.console-topbar-link:hover {
  background: rgb(var(--rv-hover));
  color: rgb(var(--rv-fg));
}

.console-topbar-link:focus-visible {
  outline: 2px solid rgb(var(--rv-accent));
  outline-offset: 2px;
}

.ticket-topbar-badge {
  position: absolute;
  top: -3px;
  right: -2px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: rgb(var(--rv-danger));
  color: white;
  font-size: 10px;
  line-height: 1;
}

.console-balance {
  height: 32px;
  padding: 0 6px;
}

.console-avatar {
  background: rgb(var(--rv-ink));
  color: rgb(var(--rv-on-ink));
}

@media (max-width: 1279px) {
  .console-topbar-inner {
    padding: 0 24px;
  }
}

@media (max-width: 640px) {
  .console-topbar-inner {
    padding: 0 12px 0 16px;
  }
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.14s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.98) translateY(-2px);
}
</style>
