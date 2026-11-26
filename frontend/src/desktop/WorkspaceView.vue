<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { Bar } from 'vue-chartjs'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore, useAuthStore } from '@/stores'
import { usageAPI, type UserDashboardStats } from '@/api/usage'
import type { TrendDataPoint, UsageLog } from '@/types'
import { money, count, dateTime, dateRange, errorMessage } from './format'
import { useDarkMode } from '@/composables/useDarkMode'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)
const auth = useAuthStore()
const app = useAppStore()
const dark = useDarkMode()
const stats = ref<UserDashboardStats>()
const trend = ref<TrendDataPoint[]>([])
const recent = ref<UsageLog[]>([])
const days = ref(7)
const loading = ref(false)
const failure = ref('')
const updated = ref('')
let generation = 0
const paymentEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.payment))
const endpoint = computed(() => (app.cachedPublicSettings?.api_base_url || 'https://api.ravenaiworld.org').replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1')
const chart = computed(() => ({ labels: trend.value.map(point => point.date.slice(5)), datasets: [{ label: '请求次数', data: trend.value.map(point => point.requests), backgroundColor: '#398c80', hoverBackgroundColor: '#237769', borderRadius: 3, maxBarThickness: 28 }] }))
const chartOptions = computed(() => ({ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: dark.value ? '#a1a1aa' : '#71717a' }, border: { display: false } }, y: { beginAtZero: true, grid: { color: dark.value ? '#303036' : '#eef0f2' }, ticks: { color: dark.value ? '#a1a1aa' : '#71717a', precision: 0 }, border: { display: false } } } }))
async function load() {
  const current = ++generation
  loading.value = true; failure.value = ''
  try {
    const [summary, history, activity] = await Promise.all([usageAPI.getDashboardStats(), usageAPI.getDashboardTrend({ ...dateRange(days.value), granularity: 'day' }), usageAPI.list(1, 6), auth.refreshUser()])
    if (current !== generation) return
    stats.value = summary; trend.value = history.trend || []; recent.value = activity.items || []
    updated.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } catch (error) { if (current === generation) failure.value = errorMessage(error) }
  finally { if (current === generation) loading.value = false }
}
watch(days, load)
onMounted(load)
</script>

<template>
  <AppLayout>
    <template #actions><span class="client-sync-time">{{ loading ? '正在同步…' : updated ? `更新于 ${updated}` : '' }}</span><button class="client-icon" :disabled="loading" title="刷新工作台" aria-label="刷新工作台" @click="load"><Icon name="refresh" size="sm" :class="{ 'animate-spin': loading }" /></button></template>
    <div class="client-dashboard">
      <div class="client-welcome"><div><p class="client-eyebrow">个人空间</p><h2>{{ auth.user?.username || auth.user?.email?.split('@')[0] }}，欢迎回来</h2></div><RouterLink class="client-button primary" to="/keys?create=1"><Icon name="plus" size="sm" />新建密钥</RouterLink></div>
      <div v-if="failure" class="client-error" role="alert"><Icon name="exclamationTriangle" size="sm" /><span>{{ failure }}</span><button @click="load">重试</button></div>
      <section class="client-metrics" aria-label="账户概览">
        <div><span>可用余额 <Icon name="creditCard" size="sm" /></span><strong>{{ money(auth.user?.balance) }}</strong><RouterLink v-if="paymentEnabled" to="/purchase">充值与订阅 <Icon name="chevronRight" size="xs" /></RouterLink><small v-else>账户余额</small></div>
        <div><span>今日花费 <Icon name="dollar" size="sm" /></span><strong>{{ failure ? '—' : money(stats?.today_actual_cost, 4) }}</strong><small>累计 {{ failure ? '—' : money(stats?.total_actual_cost, 4) }}</small></div>
        <div><span>今日请求 <Icon name="bolt" size="sm" /></span><strong>{{ failure ? '—' : count(stats?.today_requests) }}</strong><small>{{ failure ? '—' : count(stats?.today_tokens) }} Tokens</small></div>
        <div><span>有效密钥 <Icon name="key" size="sm" /></span><strong>{{ failure ? '—' : count(stats?.active_api_keys) }}</strong><RouterLink to="/keys">管理密钥 <Icon name="chevronRight" size="xs" /></RouterLink></div>
      </section>
      <div class="client-overview-grid">
        <section class="client-trend"><div class="client-section-heading"><h3>请求趋势</h3><div class="client-segmented" role="group" aria-label="时间范围"><button :class="{ selected: days === 7 }" @click="days = 7">7 天</button><button :class="{ selected: days === 30 }" @click="days = 30">30 天</button></div></div><div class="client-chart"><Bar v-if="trend.length && !failure" :data="chart" :options="chartOptions" /><div v-else class="client-empty"><Icon name="chart" size="xl" /><span>{{ loading ? '正在加载用量…' : failure ? '用量暂不可用' : '这段时间还没有请求' }}</span></div></div></section>
        <section class="client-connection-panel"><div class="client-section-heading"><h3>连接信息</h3><Icon name="terminal" size="sm" /></div><dl><dt>API 地址</dt><dd class="client-code">{{ endpoint }}</dd><dt>服务</dt><dd>Ravenai · Sub2API</dd><dt>账户并发</dt><dd>{{ auth.user?.concurrency ?? '—' }}</dd></dl><RouterLink class="client-connection-link" to="/keys">管理接入配置 <Icon name="chevronRight" size="sm" /></RouterLink></section>
      </div>
      <section class="client-recent"><div class="client-section-heading"><h3>最近请求</h3><RouterLink class="client-text-link" to="/usage">全部记录 <Icon name="chevronRight" size="xs" /></RouterLink></div><div class="client-table-scroll"><table class="client-table"><thead><tr><th>模型</th><th>密钥</th><th>Tokens</th><th>实际花费</th><th>时间</th></tr></thead><tbody><tr v-for="item in recent" :key="item.id" @click="$router.push(`/usage?request=${item.id}`)" tabindex="0" @keydown.enter="$router.push(`/usage?request=${item.id}`)"><td class="client-mono">{{ item.model }}</td><td>{{ item.api_key?.name || `#${item.api_key_id}` }}</td><td>{{ count(item.input_tokens + item.output_tokens) }}</td><td>{{ money(item.actual_cost, 4) }}</td><td class="client-muted">{{ dateTime(item.created_at) }}</td></tr></tbody></table><div v-if="!recent.length" class="client-empty">{{ loading ? '正在加载记录…' : failure ? '记录暂不可用' : '暂无请求记录' }}</div></div></section>
    </div>
  </AppLayout>
</template>
