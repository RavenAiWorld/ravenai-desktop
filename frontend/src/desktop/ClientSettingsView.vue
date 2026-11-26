<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import { useDarkMode, setDarkMode } from '@/composables/useDarkMode'
import { useAppStore } from '@/stores/app'
const dark = useDarkMode()
const app = useAppStore()
const version = ref('2.0.0')
const testing = ref(false)
const connection = ref('')
async function test() { testing.value = true; const started = performance.now(); try { connection.value = await app.fetchPublicSettings(true) ? `已连接 · ${Math.round(performance.now() - started)} ms` : '连接失败，请检查网络后重试' } finally { testing.value = false } }
onMounted(async () => { if (window.ravenDesktop) version.value = (await window.ravenDesktop.getInfo()).version })
</script>
<template><AppLayout><div class="client-settings"><h2>客户端设置</h2><section><h3>外观</h3><div class="client-setting-row"><span>主题</span><div class="client-segmented"><button :class="{ selected: !dark }" @click="setDarkMode(false)"><Icon name="sun" size="sm" />浅色</button><button :class="{ selected: dark }" @click="setDarkMode(true)"><Icon name="moon" size="sm" />深色</button></div></div></section><section><h3>服务连接</h3><div class="client-setting-row"><span>账户服务</span><code>ravenaiworld.org</code></div><div class="client-setting-row"><span>API 服务</span><code>api.ravenaiworld.org</code></div><div class="client-setting-row"><span role="status">{{ connection || 'Ravenai 正式服务' }}</span><button class="client-button" :disabled="testing" @click="test"><Icon name="refresh" size="sm" :class="{ 'animate-spin': testing }" />{{ testing ? '检测中…' : '检测连接' }}</button></div></section><section><h3>账户</h3><div class="client-setting-row"><span>资料、密码和登录方式</span><RouterLink class="client-text-link" to="/profile">账户安全 <Icon name="chevronRight" size="sm" /></RouterLink></div></section><section><h3>关于 Ravenai</h3><div class="client-setting-row"><span>桌面客户端</span><span>{{ version }} · Windows x64</span></div><div class="client-setting-row"><span>开源许可</span><span>AGPL-3.0</span></div></section></div></AppLayout></template>
