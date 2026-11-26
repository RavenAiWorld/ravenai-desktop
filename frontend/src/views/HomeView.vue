<template>
  <div v-if="hasHomeContent" class="min-h-screen">
    <iframe v-if="isHomeContentUrl" :src="homeContent.trim()" class="h-screen w-full border-0" allowfullscreen></iframe>
    <div v-else v-html="homeContent"></div>
  </div>

  <!-- Compact home: brand, subtitle and entry points only -->
  <div v-else-if="compactHomeEnabled" class="home-root" data-testid="compact-home">
    <PublicHeader active="home" />
    <main class="home-compact">
      <div class="home-hero-grid-bg" aria-hidden="true"></div>
      <div class="home-container relative text-center">
        <h1 class="home-title">{{ siteName }}</h1>
        <p class="home-lead mx-auto">{{ siteSubtitle }}</p>
        <div class="home-cta-row justify-center">
          <RouterLink :to="consolePath" class="btn btn-primary btn-lg home-button-primary">{{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}</RouterLink>
          <RouterLink v-if="showModelPlazaEntry" to="/model-plaza" class="btn btn-secondary btn-lg">{{ t('home.raven.exploreModels') }}<Icon name="arrowRight" size="sm" /></RouterLink>
        </div>
      </div>
    </main>
    <PublicFooter />
  </div>

  <div v-else class="home-root">
    <PublicHeader active="home" />
    <main>
      <!-- Hero: value proposition on the left, a real request on the right -->
      <section class="home-hero">
        <div class="home-hero-grid-bg" aria-hidden="true"></div>
        <div class="home-container home-hero-layout">
          <div class="home-hero-copy">
            <span class="home-eyebrow"><span class="home-eyebrow-dot"></span>{{ t('home.raven.compatBadge') }}</span>
            <h1 class="home-title">{{ t('home.raven.heroLine1') }}<br class="hidden sm:block" />{{ t('home.raven.heroLine2') }}</h1>
            <p class="home-lead">{{ t('home.raven.heroDescription') }}</p>
            <div class="home-cta-row">
              <RouterLink :to="consolePath" class="btn btn-primary btn-lg home-button-primary">{{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}</RouterLink>
              <RouterLink v-if="showModelPlazaEntry" to="/model-plaza" class="btn btn-secondary btn-lg">{{ t('home.raven.exploreModels') }}<Icon name="arrowRight" size="sm" /></RouterLink>
            </div>
            <button type="button" class="home-base-url" :title="t('home.raven.copyExample')" @click="copyBaseUrl">
              <span class="home-base-url-label">{{ t('home.raven.apiBaseLabel') }}</span>
              <code>{{ apiBase }}</code>
              <Icon :name="baseCopied ? 'check' : 'copy'" size="xs" class="shrink-0" />
            </button>
          </div>

          <div class="home-code" :data-protocol="activeProtocol.id">
            <div class="home-code-head">
              <div class="home-code-tabs" role="tablist" :aria-label="t('home.raven.protocol')" @keydown="onProtocolKeydown">
                <button
                  v-for="(protocol, index) in protocols"
                  :id="'protocol-tab-' + protocol.id"
                  :key="protocol.id"
                  type="button"
                  role="tab"
                  :aria-selected="selectedProtocol === index"
                  aria-controls="protocol-panel"
                  :tabindex="selectedProtocol === index ? 0 : -1"
                  @click="selectedProtocol = index"
                >{{ protocol.name }}</button>
              </div>
              <button type="button" class="home-code-copy" @click="copyToClipboard(codeExample)">
                <Icon :name="copied ? 'check' : 'copy'" size="xs" />
                <span aria-live="polite">{{ copied ? t('common.copied') : t('home.raven.copyExample') }}</span>
              </button>
            </div>
            <div id="protocol-panel" role="tabpanel" :aria-labelledby="'protocol-tab-' + activeProtocol.id" tabindex="0" class="home-code-body">
              <div class="home-code-endpoint"><span>POST</span><code>{{ activeProtocol.path }}</code><em>{{ activeProtocol.title }}</em></div>
              <pre><code><span v-for="(line, i) in highlightedCode" :key="i" class="block"><span v-for="(token, j) in line" :key="j" :class="token.cls">{{ token.text }}</span></span></code></pre>
            </div>
            <div class="home-code-foot"><Icon name="infoCircle" size="xs" class="shrink-0" />{{ t('home.raven.exampleNotice') }}</div>
          </div>
        </div>
      </section>

      <!-- Live catalogue figures from the public model plaza -->
      <section v-if="catalog.length" class="home-container" :aria-label="t('home.raven.models')">
        <div class="stat-strip home-stats sm:grid-cols-4">
          <div class="stat-cell"><p class="stat-cell-label">{{ t('home.raven.statModels') }}</p><p class="stat-cell-value">{{ catalog.length }}</p></div>
          <div class="stat-cell"><p class="stat-cell-label">{{ t('home.raven.statVendors') }}</p><p class="stat-cell-value">{{ vendorCount }}</p></div>
          <div class="stat-cell"><p class="stat-cell-label">{{ t('home.raven.statGroups') }}</p><p class="stat-cell-value">{{ plazaGroups.length }}</p></div>
          <div class="stat-cell"><p class="stat-cell-label">{{ t('home.raven.statProtocols') }}</p><p class="stat-cell-value">{{ protocols.length }}</p></div>
        </div>
      </section>

      <!-- Featured models with the prices users actually pay -->
      <section v-if="featuredModels.length" class="home-section home-container">
        <div class="home-section-head">
          <div>
            <h2 class="home-h2">{{ t('home.raven.pricingTitle') }}</h2>
            <p class="home-section-desc">{{ t('home.raven.pricingDescription') }}</p>
          </div>
          <RouterLink v-if="showModelPlazaEntry" to="/model-plaza" class="home-link">{{ t('home.raven.pricingViewAll', { count: catalog.length }) }}<Icon name="arrowRight" size="xs" /></RouterLink>
        </div>
        <div class="home-price-table">
          <div class="home-price-row home-price-head">
            <span>{{ t('home.raven.pricingModel') }}</span>
            <span class="hidden md:block">{{ t('home.raven.pricingVendor') }}</span>
            <span class="text-right">{{ t('home.raven.pricingInput') }}</span>
            <span class="text-right">{{ t('home.raven.pricingOutput') }}</span>
            <span class="hidden text-right sm:block">{{ t('home.raven.pricingContext') }}</span>
          </div>
          <div v-for="model in featuredModels" :key="model.key" class="home-price-row">
            <span class="flex min-w-0 items-center gap-2.5">
              <PlazaVendorIcon :model="model.iconModel" size="xs" />
              <code>{{ model.name }}</code>
            </span>
            <span class="hidden text-rv-fg-3 md:block">{{ model.vendorLabel }}</span>
            <span class="text-right text-rv-fg">{{ model.input }}</span>
            <span class="text-right text-rv-fg">{{ model.output }}</span>
            <span class="hidden text-right text-rv-fg-3 sm:block">{{ model.context }}</span>
          </div>
        </div>
      </section>

      <!-- Capabilities -->
      <section id="features" class="home-section home-container">
        <div class="home-section-head">
          <div>
            <h2 class="home-h2">{{ t('home.raven.capabilitiesTitle') }}</h2>
            <p class="home-section-desc">{{ t('home.raven.capabilitiesDescription') }}</p>
          </div>
        </div>
        <div class="home-features">
          <article v-for="feature in features" :key="feature.title" class="home-feature">
            <span class="home-feature-icon"><Icon :name="feature.icon" size="sm" /></span>
            <h3>{{ t(feature.title) }}</h3>
            <p>{{ t(feature.description) }}</p>
          </article>
        </div>
      </section>

      <!-- Getting started -->
      <section id="quickstart" class="home-section home-container">
        <div class="home-section-head">
          <div>
            <h2 class="home-h2">{{ t('home.raven.quickstartTitle') }}</h2>
            <p class="home-section-desc">{{ t('home.raven.quickstartDescription') }}</p>
          </div>
        </div>
        <ol class="home-steps">
          <li v-for="(step, index) in steps" :key="step.title">
            <span class="home-step-num">{{ index + 1 }}</span>
            <strong>{{ t(step.title) }}</strong>
            <p>{{ t(step.description) }}</p>
          </li>
        </ol>
      </section>

      <section class="home-container home-section pt-0">
        <div class="home-cta-band">
          <div>
            <h2 class="home-h2">{{ t('home.raven.ctaTitle') }}</h2>
            <p class="home-section-desc">{{ t('home.raven.ctaDescription') }}</p>
          </div>
          <div class="home-cta-row mt-0">
            <RouterLink :to="consolePath" class="btn btn-primary btn-lg">{{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}</RouterLink>
            <RouterLink v-if="showModelPlazaEntry" to="/model-plaza" class="btn btn-secondary btn-lg">{{ t('home.raven.exploreModels') }}</RouterLink>
          </div>
        </div>
      </section>
    </main>
    <PublicFooter />
  </div>
  <HomeAgreementGate />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useAppStore } from '@/stores'
import HomeAgreementGate from '@/components/auth/HomeAgreementGate.vue'
import PublicHeader from '@/components/layout/PublicHeader.vue'
import PublicFooter from '@/components/layout/PublicFooter.vue'
import PlazaVendorIcon from '@/components/modelPlaza/PlazaVendorIcon.vue'
import Icon from '@/components/icons/Icon.vue'
import { useClipboard } from '@/composables/useClipboard'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import { getModelPlaza, type ModelPlazaGroup } from '@/api/modelPlaza'
import {
  buildEntries,
  catalogModels,
  formatContextSize,
  formatUnitPrice,
  isPlazaGroupVisible,
  isTokenBilled,
  paidRate,
  paidTokenTiers,
  sortEntries,
  SCENARIO_PRESETS,
  vendorMeta,
  type PlazaEntry
} from '@/components/modelPlaza/plazaCatalog'

const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()
const { copied, copyToClipboard } = useClipboard()
const siteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Ravenai')
const siteSubtitle = computed(() => appStore.cachedPublicSettings?.site_subtitle || '')
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')
const hasHomeContent = computed(() => homeContent.value.trim().length > 0)
const isHomeContentUrl = computed(() => /^https?:\/\//.test(homeContent.value.trim()))
const compactHomeEnabled = computed(() => appStore.cachedPublicSettings?.compact_home_enabled === true)
const isAuthenticated = computed(() => authStore.isAuthenticated)
const consolePath = computed(() => isAuthenticated.value ? (authStore.isAdmin ? '/admin/dashboard' : '/dashboard') : '/login')
const showModelPlazaEntry = computed(() => isFeatureFlagEnabled(FeatureFlags.modelPlaza)
  && (isAuthenticated.value || appStore.cachedPublicSettings?.model_plaza_require_auth !== true))
const apiBase = computed(() => (sanitizeUrl(appStore.cachedPublicSettings?.api_base_url || '') || window.location.origin).replace(/\/+$/, ''))
// Example paths already include their version segment (/v1, /v1beta), so drop it from the configured base.
const apiOrigin = computed(() => apiBase.value.replace(/\/v1(beta)?$/i, ''))

const baseCopied = ref(false)
async function copyBaseUrl() {
  try {
    await navigator.clipboard.writeText(apiBase.value)
    baseCopied.value = true
    setTimeout(() => { baseCopied.value = false }, 1600)
  } catch {
    // Clipboard can be blocked (insecure context); the URL stays visible for manual copy.
  }
}

// ── Protocol examples ─────────────────────────────────────────────
const selectedProtocol = ref(0)
watch(selectedProtocol, () => { copied.value = false })
const protocols = [
  { id: 'openai', name: 'OpenAI', title: 'Chat Completions', path: '/v1/chat/completions' },
  { id: 'claude', name: 'Claude', title: 'Messages API', path: '/v1/messages' },
  { id: 'gemini', name: 'Gemini', title: 'Generate Content', path: '/v1beta/models/model-name:generateContent' },
]
const activeProtocol = computed(() => protocols[selectedProtocol.value]!)
const codeExample = computed(() => {
  const protocol = activeProtocol.value
  const headers = protocol.id === 'claude'
    ? ['  -H "x-api-key: YOUR_API_KEY"', '  -H "anthropic-version: 2023-06-01"']
    : protocol.id === 'gemini' ? ['  -H "x-goog-api-key: YOUR_API_KEY"'] : ['  -H "Authorization: Bearer YOUR_API_KEY"']
  const body = protocol.id === 'gemini'
    ? { contents: [{ parts: [{ text: 'Hello' }] }] }
    : { model: 'model-name', ...(protocol.id === 'claude' ? { max_tokens: 1024 } : {}), messages: [{ role: 'user', content: 'Hello' }] }
  return ['curl ' + apiOrigin.value + protocol.path, ...headers, '  -H "Content-Type: application/json"', "  -d '" + JSON.stringify(body, null, 2) + "'"].join(' \\\n')
})

interface CodeToken { text: string; cls: string }
// Minimal shell highlighting rendered as text nodes (no v-html): command, flags, strings.
const highlightedCode = computed<CodeToken[][]>(() => codeExample.value.split('\n').map((line) => {
  const tokens: CodeToken[] = []
  const pattern = /("[^"]*"|'[^']*'?|^curl\b|\s-[Hd]\b|https?:\/\/\S+)/g
  let last = 0
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) tokens.push({ text: line.slice(last, index), cls: '' })
    const text = match[0]
    const cls = text === 'curl' ? 'tok-cmd' : /^\s-/.test(text) ? 'tok-flag' : text.startsWith('http') ? 'tok-url' : 'tok-str'
    tokens.push({ text, cls })
    last = index + text.length
  }
  if (last < line.length) tokens.push({ text: line.slice(last), cls: '' })
  return tokens
}))

async function onProtocolKeydown(event: KeyboardEvent) {
  const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }
  if (event.key in moves) selectedProtocol.value = (selectedProtocol.value + moves[event.key]! + protocols.length) % protocols.length
  else if (event.key === 'Home') selectedProtocol.value = 0
  else if (event.key === 'End') selectedProtocol.value = protocols.length - 1
  else return
  event.preventDefault()
  await nextTick()
  document.getElementById('protocol-tab-' + activeProtocol.value.id)?.focus()
}

// ── Live catalogue (same pricing logic as the model plaza) ───────────
const plazaGroups = ref<ModelPlazaGroup[]>([])
const catalog = computed<PlazaEntry[]>(() => catalogModels(plazaGroups.value.flatMap(buildEntries)))
const vendorCount = computed(() => new Set(catalog.value.map((entry) => entry.vendor)).size)
const featuredModels = computed(() => {
  const perVendor = new Map<string, number>()
  const picked: PlazaEntry[] = []
  for (const entry of sortEntries(catalog.value.filter((e) => isTokenBilled(e.model)), 'recommended', SCENARIO_PRESETS.chat)) {
    const count = perVendor.get(entry.vendor) ?? 0
    if (count >= 2) continue
    perVendor.set(entry.vendor, count + 1)
    picked.push(entry)
    if (picked.length >= 8) break
  }
  return picked.map((entry) => {
    const tier = paidTokenTiers(entry.model, paidRate(entry.model, entry.group))[0]
    const meta = vendorMeta(entry.vendor)
    const context = entry.info?.context_window
    return {
      key: entry.key,
      name: entry.model.name,
      iconModel: meta.iconModel || entry.model.name,
      vendorLabel: meta.label || entry.model.platform,
      input: formatUnitPrice(tier?.input, 'M'),
      output: formatUnitPrice(tier?.output, 'M'),
      context: context ? formatContextSize(context) : '—'
    }
  })
})

async function loadCatalog() {
  if (!showModelPlazaEntry.value || compactHomeEnabled.value || hasHomeContent.value) return
  try {
    const data = await getModelPlaza()
    plazaGroups.value = (data.groups ?? []).filter(isPlazaGroupVisible)
  } catch {
    // The home page stays complete without live catalogue figures.
  }
}

const features = [
  { icon: 'grid', title: 'home.raven.featureModelsTitle', description: 'home.raven.featureModelsDescription' },
  { icon: 'key', title: 'home.raven.featureKeysTitle', description: 'home.raven.featureKeysDescription' },
  { icon: 'chart', title: 'home.raven.featureUsageTitle', description: 'home.raven.featureUsageDescription' },
  { icon: 'swap', title: 'home.raven.featureRoutingTitle', description: 'home.raven.featureRoutingDescription' },
] as const

const steps = [
  { title: 'home.raven.stepAccount', description: 'home.raven.stepAccountDescription' },
  { title: 'home.raven.stepKey', description: 'home.raven.stepKeyDescription' },
  { title: 'home.raven.stepConnect', description: 'home.raven.stepConnectDescription' },
]

onMounted(() => {
  authStore.checkAuth()
  if (!appStore.publicSettingsLoaded) void appStore.fetchPublicSettings()
  void loadCatalog()
})
</script>

<style scoped>
.home-root {
  min-height: 100vh;
  background: rgb(var(--rv-canvas));
  color: rgb(var(--rv-fg));
}

.home-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* Hero */
.home-hero {
  position: relative;
  overflow: hidden;
  padding: 72px 0 56px;
}

.home-hero-grid-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgb(var(--rv-line) / 0.55) 1px, transparent 1px),
    linear-gradient(90deg, rgb(var(--rv-line) / 0.55) 1px, transparent 1px);
  background-size: 48px 48px;
  background-position: center top;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 75%);
}

.home-hero-layout {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 40px;
  align-items: center;
}

.home-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 10px;
  border: 1px solid rgb(var(--rv-line));
  border-radius: 999px;
  background: rgb(var(--rv-surface));
  font-size: 12.5px;
  color: rgb(var(--rv-fg-2));
}

.home-eyebrow-dot {
  height: 6px;
  width: 6px;
  border-radius: 999px;
  background: rgb(var(--rv-accent));
  box-shadow: 0 0 0 3px rgb(var(--rv-accent) / 0.18);
}

.home-title {
  margin-top: 20px;
  font-size: clamp(34px, 5vw, 54px);
  line-height: 1.12;
  font-weight: 650;
  letter-spacing: -0.035em;
  color: rgb(var(--rv-fg));
}

.home-lead {
  margin-top: 18px;
  max-width: 34rem;
  font-size: 16.5px;
  line-height: 1.7;
  color: rgb(var(--rv-fg-3));
}

.home-cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
}

.home-base-url {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 10px;
  margin-top: 22px;
  padding: 6px 12px;
  border: 1px solid rgb(var(--rv-line));
  border-radius: 8px;
  background: rgb(var(--rv-subtle));
  font-size: 12.5px;
  color: rgb(var(--rv-fg-3));
  transition: border-color 0.15s, color 0.15s;
}

.home-base-url:hover {
  border-color: rgb(var(--rv-line-strong));
  color: rgb(var(--rv-fg));
}

.home-base-url code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: theme('fontFamily.mono');
  color: rgb(var(--rv-fg));
}

.home-base-url-label {
  flex-shrink: 0;
  padding-right: 10px;
  border-right: 1px solid rgb(var(--rv-line));
}

/* Code window: dark in both themes */
.home-code {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #27272a;
  border-radius: 14px;
  background: #0c0c0e;
  box-shadow: 0 30px 60px -30px rgb(0 0 0 / 0.45), 0 0 0 1px rgb(255 255 255 / 0.02) inset;
  color: #e4e4e7;
}

.home-code-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px 0;
  border-bottom: 1px solid #1f1f23;
}

.home-code-tabs {
  display: flex;
  gap: 2px;
}

.home-code-tabs button {
  position: relative;
  padding: 8px 12px 11px;
  font-size: 13px;
  font-weight: 500;
  color: #a1a1aa;
  transition: color 0.15s;
}

.home-code-tabs button:hover {
  color: #fafafa;
}

.home-code-tabs button[aria-selected='true'] {
  color: #fafafa;
}

.home-code-tabs button[aria-selected='true']::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: #fafafa;
}

.home-code-copy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 5px 10px;
  border: 1px solid #27272a;
  border-radius: 6px;
  font-size: 12px;
  color: #d4d4d8;
  transition: background-color 0.15s, border-color 0.15s;
}

.home-code-copy:hover {
  border-color: #3f3f46;
  background: #18181b;
}

.home-code-body {
  padding: 16px 18px 18px;
  outline: none;
}

.home-code-endpoint {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  font-size: 12.5px;
}

.home-code-endpoint span {
  padding: 2px 6px;
  border-radius: 4px;
  background: rgb(34 197 94 / 0.14);
  font-family: theme('fontFamily.mono');
  font-size: 11px;
  font-weight: 600;
  color: #4ade80;
}

.home-code-endpoint code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: theme('fontFamily.mono');
  color: #e4e4e7;
}

.home-code-endpoint em {
  margin-left: auto;
  flex-shrink: 0;
  font-style: normal;
  color: #71717a;
}

.home-code pre {
  overflow-x: auto;
  font-family: theme('fontFamily.mono');
  font-size: 12.5px;
  line-height: 1.75;
  color: #d4d4d8;
}

.home-code :deep(.tok-cmd) { color: #fafafa; font-weight: 600; }
.home-code :deep(.tok-flag) { color: #a1a1aa; }
.home-code :deep(.tok-url) { color: #93a8f4; }
.home-code :deep(.tok-str) { color: #86efac; }

.home-code-foot {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 11px 18px;
  border-top: 1px solid #1f1f23;
  font-size: 12px;
  line-height: 1.5;
  color: #71717a;
}

/* Sections */
.home-stats {
  margin-top: -8px;
}

.home-section {
  padding-top: 72px;
}

.home-section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 24px;
  margin-bottom: 20px;
}

.home-h2 {
  font-size: 24px;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: rgb(var(--rv-fg));
}

.home-section-desc {
  margin-top: 6px;
  max-width: 40rem;
  font-size: 14.5px;
  line-height: 1.65;
  color: rgb(var(--rv-fg-3));
}

.home-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13.5px;
  font-weight: 500;
  color: rgb(var(--rv-accent-fg));
}

.home-link:hover {
  color: rgb(var(--rv-accent));
}

.home-price-table {
  overflow: hidden;
  border: 1px solid rgb(var(--rv-line));
  border-radius: 12px;
  background: rgb(var(--rv-surface));
  box-shadow: var(--rv-shadow-sm);
}

.home-price-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 96px;
  align-items: center;
  gap: 16px;
  min-height: 48px;
  padding: 0 18px;
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
}

.home-price-row + .home-price-row {
  border-top: 1px solid rgb(var(--rv-line-soft));
}

.home-price-row code {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: theme('fontFamily.mono');
  font-size: 13px;
  color: rgb(var(--rv-fg));
}

.home-price-head {
  min-height: 38px;
  background: rgb(var(--rv-thead));
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--rv-fg-3));
}

.home-features {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1px;
  overflow: hidden;
  border: 1px solid rgb(var(--rv-line));
  border-radius: 12px;
  background: rgb(var(--rv-line));
}

.home-feature {
  padding: 24px;
  background: rgb(var(--rv-surface));
}

.home-feature-icon {
  display: flex;
  height: 34px;
  width: 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rv-line));
  border-radius: 8px;
  color: rgb(var(--rv-fg-2));
}

.home-feature h3 {
  margin-top: 18px;
  font-size: 15px;
  font-weight: 600;
  color: rgb(var(--rv-fg));
}

.home-feature p {
  margin-top: 6px;
  font-size: 13.5px;
  line-height: 1.65;
  color: rgb(var(--rv-fg-3));
}

.home-steps {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.home-steps li {
  padding: 20px 22px;
  border: 1px solid rgb(var(--rv-line));
  border-radius: 12px;
  background: rgb(var(--rv-surface));
}

.home-step-num {
  display: inline-flex;
  height: 24px;
  width: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgb(var(--rv-ink));
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--rv-on-ink));
}

.home-steps strong {
  display: block;
  margin-top: 14px;
  font-size: 15px;
  font-weight: 600;
  color: rgb(var(--rv-fg));
}

.home-steps p {
  margin-top: 4px;
  font-size: 13.5px;
  line-height: 1.6;
  color: rgb(var(--rv-fg-3));
}

.home-cta-band {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 20px 32px;
  margin-bottom: 72px;
  padding: 32px;
  border: 1px solid rgb(var(--rv-line));
  border-radius: 16px;
  background:
    radial-gradient(120% 140% at 100% 0%, rgb(var(--rv-accent) / 0.08), transparent 55%),
    rgb(var(--rv-subtle));
}

/* Compact */
.home-compact {
  position: relative;
  overflow: hidden;
  padding: 120px 0 140px;
}

.home-compact .home-lead {
  margin-left: auto;
  margin-right: auto;
}

@media (min-width: 640px) {
  .home-price-row {
    grid-template-columns: minmax(0, 1fr) 96px 96px 80px;
  }

  .home-steps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .home-features {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .home-price-row {
    grid-template-columns: minmax(0, 1fr) 140px 110px 110px 90px;
  }
}

@media (min-width: 1024px) {
  .home-hero {
    padding: 88px 0 72px;
  }

  .home-hero-layout {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    gap: 56px;
  }

  .home-features {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .home-container {
    padding: 0 16px;
  }

  .home-hero {
    padding: 44px 0 40px;
  }

  .home-section {
    padding-top: 52px;
  }

  .home-cta-band {
    padding: 24px 20px;
    margin-bottom: 52px;
  }

  .home-cta-row .btn {
    flex: 1 1 auto;
  }
}

/* Phones: narrower price columns, and model names wrap instead of collapsing to "gpt-6.1…". */
@media (max-width: 639.98px) {
  .home-price-row {
    grid-template-columns: minmax(0, 1fr) 72px 72px;
    gap: 10px;
    padding: 8px 14px;
  }

  .home-price-row code {
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
</style>
