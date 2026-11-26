<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore } from '@/stores'
import { usePageMeta } from '@/composables/usePageMeta'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import Icon from '@/components/icons/Icon.vue'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'
import { getCreditShopUrl } from '@/utils/creditShop'

defineProps<{ hideHeading?: boolean; fillViewport?: boolean }>()
type IconName = InstanceType<typeof Icon>['$props']['name']
type Entry = { path: string; label: string; icon: IconName; section: string; enabled?: boolean }
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const auth = useAuthStore()
const app = useAppStore()
const { pageTitle } = usePageMeta()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()
const accountOpen = ref(false)
const searchOpen = ref(false)
const query = ref('')
const searchInput = ref<HTMLInputElement>()
const signingOut = ref(false)
const adminMode = computed(() => route.path.startsWith('/admin'))
const features = (key: keyof typeof FeatureFlags) => isFeatureFlagEnabled(FeatureFlags[key])
const entries = computed<Entry[]>(() => {
  if (adminMode.value && auth.isAdmin) return router.getRoutes()
    .filter(item => item.path.startsWith('/admin/') && !item.redirect && !item.path.includes(':'))
    .map(item => ({ path: item.path, label: item.meta.titleKey ? t(String(item.meta.titleKey)) : String(item.meta.title || item.name), icon: 'grid', section: '管理' }))
  return [
    { path: '/dashboard', label: '工作台', icon: 'home', section: '工作空间' },
    { path: '/keys', label: 'API 密钥', icon: 'key', section: '工作空间' },
    { path: '/usage', label: '用量记录', icon: 'chart', section: '工作空间' },
    { path: '/model-plaza', label: '模型目录', icon: 'cube', section: '工作空间', enabled: features('modelPlaza') },
    { path: '/available-channels', label: '可用渠道', icon: 'server', section: '工作空间', enabled: features('availableChannels') },
    { path: '/image-studio', label: '图像工作室', icon: 'sparkles', section: '工具' },
    { path: '/batch-image', label: '批量生图', icon: 'grid', section: '工具', enabled: canUseBatchImage.value },
    { path: '/model-trace', label: '模型检测', icon: 'beaker', section: '工具' },
    { path: '/settings/mcp', label: 'MCP 连接', icon: 'mcp', section: '工具', enabled: features('mcp') },
    { path: '/subscriptions', label: '我的套餐', icon: 'creditCard', section: '账户', enabled: features('subscription') },
    { path: '/buy-credits', label: '购买积分', icon: 'creditCard', section: '账户', enabled: !!getCreditShopUrl(app.cachedPublicSettings) },
    { path: '/purchase', label: '充值与订阅', icon: 'plus', section: '账户', enabled: features('payment') },
    { path: '/orders', label: '订单', icon: 'document', section: '账户', enabled: features('payment') },
    { path: '/redeem', label: '兑换', icon: 'gift', section: '账户' },
    { path: '/affiliate', label: '邀请奖励', icon: 'users', section: '账户', enabled: features('affiliate') },
    { path: '/support', label: '支持工单', icon: 'chatBubble', section: '账户' },
    { path: '/profile', label: '资料与安全', icon: 'shield', section: '账户' },
    { path: '/desktop-settings', label: '客户端设置', icon: 'cog', section: '账户' },
  ].filter(item => item.enabled !== false && (auth.isAdmin || !router.resolve(item.path).meta.hiddenForRegularUsers) && (!auth.isSimpleMode || !['/subscriptions', '/buy-credits', '/redeem'].includes(item.path))) as Entry[]
})
const sections = computed(() => [...new Set(entries.value.map(item => item.section))])
const results = computed(() => entries.value.filter(item => `${item.label} ${item.path}`.toLowerCase().includes(query.value.toLowerCase())))
const displayName = computed(() => auth.user?.username || auth.user?.email?.split('@')[0] || 'Ravenai')
const currentSection = computed(() => entries.value.find(item => route.path === item.path)?.section || '工作空间')
async function openSearch() { query.value = ''; searchOpen.value = true; await nextTick(); searchInput.value?.focus() }
function go(path: string) { searchOpen.value = false; accountOpen.value = false; void router.push(path) }
function keydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); void openSearch() }
  if (event.key === 'Escape') { searchOpen.value = false; accountOpen.value = false }
}
async function signOut() {
  signingOut.value = true
  try { await auth.logout(); await router.replace('/login') } finally { signingOut.value = false }
}
onMounted(() => { window.addEventListener('keydown', keydown); void refreshBatchImageAccess() })
onBeforeUnmount(() => window.removeEventListener('keydown', keydown))
</script>

<template>
  <div class="client-shell">
    <aside id="console-sidebar" class="client-sidebar" aria-label="主导航">
      <button class="client-workspace" @click="go('/dashboard')"><img :src="app.siteLogo || '/logo.svg'" alt="" /><span><strong>Ravenai</strong><small>{{ adminMode ? '管理空间' : '个人空间' }}</small></span><Icon name="chevronDown" size="xs" /></button>
      <button class="client-search" title="查找功能 (Ctrl+K)" @click="openSearch"><Icon name="search" size="sm" /><span>查找功能</span><kbd>Ctrl K</kbd></button>
      <nav class="client-nav">
        <section v-for="section in sections" :key="section">
          <p class="client-section-label">{{ section }}</p>
          <RouterLink v-for="entry in entries.filter(item => item.section === section)" :key="entry.path" :to="entry.path" :title="entry.label" class="client-nav-item" :class="{ active: route.path === entry.path || (entry.path === '/support' && route.path.startsWith('/support/')) }"><Icon :name="entry.icon" size="sm" /><span>{{ entry.label }}</span></RouterLink>
        </section>
      </nav>
      <div class="client-account">
        <div v-if="accountOpen" class="client-account-menu">
          <button @click="go('/profile')"><Icon name="user" size="sm" />资料与安全</button>
          <button @click="go('/desktop-settings')"><Icon name="cog" size="sm" />客户端设置</button>
          <button v-if="auth.isAdmin" @click="go(adminMode ? '/dashboard' : '/admin/dashboard')"><Icon name="swap" size="sm" />{{ adminMode ? '个人空间' : '管理空间' }}</button>
          <button :disabled="signingOut" @click="signOut"><Icon name="login" size="sm" />{{ signingOut ? '正在退出…' : '退出登录' }}</button>
        </div>
        <button class="client-account-button" :aria-expanded="accountOpen" title="账户菜单" @click="accountOpen = !accountOpen"><span class="console-avatar">{{ displayName.slice(0, 1).toUpperCase() }}</span><span class="client-account-name"><strong>{{ displayName }}</strong><small>{{ auth.user?.email }}</small></span><Icon name="more" size="sm" /></button>
      </div>
    </aside>
    <div class="client-workarea">
      <header class="client-pagebar"><div class="client-breadcrumb"><span>{{ currentSection }}</span><Icon name="chevronRight" size="xs" /><h1>{{ route.path === '/dashboard' ? '工作台' : pageTitle }}</h1></div><div class="client-page-actions"><slot name="actions" /></div></header>
      <main class="client-content" :class="{ 'client-content-fill': fillViewport }"><slot /></main>
    </div>
    <Teleport to="body"><div v-if="searchOpen" class="client-modal-backdrop" @click.self="searchOpen = false"><section role="dialog" aria-modal="true" aria-label="查找功能" class="client-command"><div class="client-command-input"><Icon name="search" /><input ref="searchInput" v-model="query" placeholder="查找功能…" @keydown.enter="results[0] && go(results[0].path)" /><button class="client-icon" title="关闭" @click="searchOpen = false"><Icon name="x" size="sm" /></button></div><div class="client-command-results"><button v-for="entry in results" :key="entry.path" @click="go(entry.path)"><Icon :name="entry.icon" size="sm" /><span>{{ entry.label }}</span><small>{{ entry.section }}</small></button><p v-if="!results.length" class="client-empty">没有匹配的功能</p></div></section></div></Teleport>
  </div>
</template>
