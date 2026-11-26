<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useDarkMode } from '@/composables/useDarkMode'
import Icon from '@/components/icons/Icon.vue'

const { locale } = useI18n()
const zh = computed(() => locale.value.startsWith('zh'))
const settings = useAppStore()
const dark = useDarkMode()
const version = ref('2.0.0')
const network = ref(navigator.onLine)
const storageFailed = ref(false)
const retrying = ref(false)
const connection = ref<'checking' | 'connected' | 'disconnected'>('checking')
const serviceReady = computed(() => network.value && connection.value === 'connected')
let lastCheck = 0

function networkChanged() { network.value = navigator.onLine; if (network.value) void retry(); else connection.value = 'disconnected' }
function focused() { if (Date.now() - lastCheck > 60000) void checkConnection() }
function storageError() { storageFailed.value = true }
async function checkConnection() {
  if (retrying.value) return
  retrying.value = true
  connection.value = 'checking'
  try {
    connection.value = await settings.fetchPublicSettings(true) ? 'connected' : 'disconnected'
    lastCheck = Date.now()
  } finally { retrying.value = false }
}
async function retry() { await checkConnection(); if (serviceReady.value) location.reload() }
watch(dark, (value) => { void window.ravenDesktop?.setTheme(value) }, { immediate: true })
onMounted(async () => {
  window.addEventListener('online', networkChanged)
  window.addEventListener('offline', networkChanged)
  window.addEventListener('raven-storage-error', storageError)
  window.addEventListener('focus', focused)
  void checkConnection()
  if (window.ravenDesktop) {
    version.value = (await window.ravenDesktop.getInfo()).version
  }
})
onUnmounted(() => {
  window.removeEventListener('online', networkChanged)
  window.removeEventListener('offline', networkChanged)
  window.removeEventListener('raven-storage-error', storageError)
  window.removeEventListener('focus', focused)
})
</script>

<template>
  <header class="desktop-toolbar">
    <span class="desktop-product"><img src="/ravenai.png" alt="" />Ravenai <span>Desktop</span></span>
    <div class="desktop-connection" role="status">
      <span :class="['desktop-status-dot', { connected: serviceReady }]" />
      <span>{{ serviceReady ? (zh ? '已连接' : 'Connected') : connection === 'checking' ? (zh ? '正在连接' : 'Connecting') : (zh ? '连接中断' : 'Disconnected') }}</span>
      <button v-if="connection === 'disconnected'" :disabled="retrying" :title="zh ? '重新连接' : 'Reconnect'" :aria-label="zh ? '重新连接' : 'Reconnect'" @click="retry"><Icon name="refresh" size="xs" :class="{ 'animate-spin': retrying }" /></button>
      <span class="desktop-version">v{{ version }}</span>
    </div>
  </header>
  <div v-if="storageFailed" class="desktop-alert" role="alert">{{ zh ? '登录信息暂时无法保存。关闭应用后可能需要重新登录。' : 'Sign-in could not be saved. You may need to sign in again after closing.' }}</div>
</template>
