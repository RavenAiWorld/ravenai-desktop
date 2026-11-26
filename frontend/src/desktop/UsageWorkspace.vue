<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import { usageAPI } from '@/api/usage'
import { keysAPI } from '@/api/keys'
import { useAppStore } from '@/stores/app'
import type { ApiKey, UsageLog, UserErrorRequest, UserErrorRequestDetail } from '@/types'
import { count, money, dateTime, dateRange, errorMessage } from './format'
const route = useRoute()
const app = useAppStore()
const initial = dateRange(7)
const start = ref(initial.start_date)
const end = ref(initial.end_date)
const keyId = ref(route.query.key ? Number(route.query.key) : 0)
const model = ref('')
const tab = ref<'usage' | 'errors'>('usage')
const keys = ref<ApiKey[]>([])
const rows = ref<UsageLog[]>([])
const errors = ref<UserErrorRequest[]>([])
const selected = ref<UsageLog>()
const selectedError = ref<UserErrorRequestDetail>()
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const detailLoading = ref(false)
const failure = ref('')
const pages = computed(() => Math.max(1, Math.ceil(total.value / 30)))
const hasDetail = computed(() => !!selected.value || !!selectedError.value || detailLoading.value)
let generation = 0
let detailGeneration = 0
let filterTimer: ReturnType<typeof setTimeout>
async function load() {
  const current = ++generation
  failure.value = ''
  if (!start.value || !end.value || start.value > end.value) { failure.value = '请选择有效的起止日期。'; return }
  loading.value = true
  try {
    const params = { page: page.value, page_size: 30, start_date: start.value, end_date: end.value, timezone: initial.timezone, api_key_id: keyId.value || undefined, model: model.value || undefined }
    if (tab.value === 'usage') {
      const result = await usageAPI.query(params)
      if (current !== generation) return
      rows.value = result.items || []; total.value = result.total
    } else {
      const result = await usageAPI.listMyErrorRequests(params)
      if (current !== generation) return
      errors.value = result.items || []; total.value = result.total
    }
  } catch (error) { if (current === generation) failure.value = errorMessage(error) }
  finally { if (current === generation) loading.value = false }
}
function clearDetail() { detailGeneration++; detailLoading.value = false; selected.value = undefined; selectedError.value = undefined }
async function detail(id: number, error = false) {
  clearDetail()
  const current = detailGeneration
  detailLoading.value = true
  try {
    if (error) { const item = await usageAPI.getMyErrorDetail(id); if (current === detailGeneration) selectedError.value = item }
    else { const item = await usageAPI.getById(id); if (current === detailGeneration) selected.value = item }
  } catch (error) { if (current === detailGeneration) app.showError(errorMessage(error)) }
  finally { if (current === detailGeneration) detailLoading.value = false }
}
function exportPage() {
  const data = tab.value === 'usage' ? [['时间', '模型', '密钥', '输入 Tokens', '输出 Tokens', '实际花费'], ...rows.value.map(item => [dateTime(item.created_at), item.model, item.api_key?.name || item.api_key_id, item.input_tokens, item.output_tokens, item.actual_cost])] : [['时间', '模型', '密钥', '状态码', '错误'], ...errors.value.map(item => [dateTime(item.created_at), item.model, item.key_name, item.status_code, item.message])]
  const escape = (value: unknown) => { let text = String(value ?? ''); if (/^[=+@\-\t\r]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"' }
  const url = URL.createObjectURL(new Blob(['\uFEFF' + data.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = `Ravenai-${tab.value}-${start.value}-page-${page.value}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000)
}
watch([start, end, keyId, tab], () => { clearDetail(); if (page.value !== 1) page.value = 1; else void load() })
watch(page, load)
watch(model, () => { clearTimeout(filterTimer); filterTimer = setTimeout(() => { if (page.value !== 1) page.value = 1; else void load() }, 300) })
onMounted(async () => {
  void keysAPI.list(1, 100).then(result => { keys.value = result.items || [] }).catch(error => app.showError('密钥筛选加载失败：' + errorMessage(error)))
  await load()
  if (route.query.request && /^\d+$/.test(String(route.query.request))) void detail(Number(route.query.request))
})
onBeforeUnmount(() => { clearTimeout(filterTimer); generation++; detailGeneration++ })
</script>

<template><AppLayout fill-viewport>
  <template #actions><button class="client-icon" title="刷新用量" aria-label="刷新用量" :disabled="loading" @click="load"><Icon name="refresh" size="sm" :class="{ 'animate-spin': loading }" /></button><button class="client-button" :disabled="loading || !!failure || !(tab === 'usage' ? rows.length : errors.length)" @click="exportPage"><Icon name="download" size="sm" />导出当前页</button></template>
  <div class="client-usage-workspace"><div class="client-usage-main"><div class="client-usage-toolbar"><div class="client-tabs"><button :class="{ active: tab === 'usage' }" @click="tab = 'usage'">请求记录</button><button :class="{ active: tab === 'errors' }" @click="tab = 'errors'">错误记录</button></div><div class="client-usage-filters"><input v-model="start" type="date" aria-label="开始日期" /><span class="client-muted">至</span><input v-model="end" type="date" aria-label="结束日期" /><select v-model="keyId" aria-label="按密钥筛选"><option :value="0">全部密钥</option><option v-if="keyId && !keys.some(key => key.id === keyId)" :value="keyId">密钥 #{{ keyId }}</option><option v-for="key in keys" :key="key.id" :value="key.id">{{ key.name }}</option></select><label class="client-search-input"><Icon name="search" size="sm" /><input v-model="model" placeholder="模型名称" aria-label="筛选模型" /></label></div></div>
    <div v-if="failure" class="client-error" role="alert"><span>{{ failure }}</span><button @click="load">重试</button></div>
    <div class="client-table-scroll client-usage-table" :aria-busy="loading"><table v-if="tab === 'usage'" class="client-table"><thead><tr><th>模型 / 时间</th><th>密钥</th><th class="numeric">输入 / 输出</th><th class="numeric">实际花费</th><th class="numeric">耗时</th></tr></thead><tbody><tr v-for="item in rows" :key="item.id" tabindex="0" :class="{ selected: selected?.id === item.id }" @click="detail(item.id)" @keydown.enter="detail(item.id)"><td><strong class="client-mono">{{ item.model }}</strong><small>{{ dateTime(item.created_at) }}</small></td><td>{{ item.api_key?.name || `#${item.api_key_id}` }}</td><td class="numeric">{{ count(item.input_tokens) }} / {{ count(item.output_tokens) }}</td><td class="numeric">{{ money(item.actual_cost, 4) }}</td><td class="numeric">{{ item.duration_ms == null ? '—' : `${(item.duration_ms / 1000).toFixed(2)} s` }}</td></tr></tbody></table><table v-else class="client-table"><thead><tr><th>模型 / 时间</th><th>密钥</th><th>状态</th><th>错误</th></tr></thead><tbody><tr v-for="item in errors" :key="item.id" tabindex="0" :class="{ selected: selectedError?.id === item.id }" @click="detail(item.id, true)" @keydown.enter="detail(item.id, true)"><td><strong>{{ item.model || '—' }}</strong><small>{{ dateTime(item.created_at) }}</small></td><td>{{ item.key_name || '—' }}</td><td><span class="client-state expired">{{ item.status_code }}</span></td><td class="client-error-cell">{{ item.message }}</td></tr></tbody></table><div v-if="!(tab === 'usage' ? rows.length : errors.length) && !failure" class="client-empty tall"><Icon :name="tab === 'usage' ? 'chart' : 'shield'" size="xl" /><span>{{ loading ? '正在加载记录…' : tab === 'usage' ? '所选时间内没有请求记录' : '所选时间内没有错误记录' }}</span></div></div>
    <footer class="client-pagination"><span>{{ total }} 条记录 · 第 {{ page }} / {{ pages }} 页</span><button class="client-icon" title="上一页" :disabled="page <= 1 || loading" @click="page--"><Icon name="chevronLeft" size="sm" /></button><button class="client-icon" title="下一页" :disabled="page >= pages || loading" @click="page++"><Icon name="chevronRight" size="sm" /></button></footer>
  </div><aside v-if="hasDetail" class="client-usage-detail"><div class="client-detail-heading"><h2>请求详情</h2><button class="client-icon" title="关闭详情" @click="clearDetail"><Icon name="x" size="sm" /></button></div><div v-if="detailLoading" class="client-empty">正在加载…</div><div v-else-if="selected" class="client-detail-body"><p class="client-detail-model client-mono">{{ selected.model }}</p><dl class="client-details"><dt>时间</dt><dd>{{ dateTime(selected.created_at) }}</dd><dt>密钥</dt><dd>{{ selected.api_key?.name || `#${selected.api_key_id}` }}</dd><dt>分组</dt><dd>{{ selected.group?.name || '—' }}</dd><dt>输入 Tokens</dt><dd>{{ count(selected.input_tokens) }}</dd><dt>输出 Tokens</dt><dd>{{ count(selected.output_tokens) }}</dd><dt>缓存读取</dt><dd>{{ count(selected.cache_read_tokens) }}</dd><dt>缓存写入</dt><dd>{{ count(selected.cache_creation_tokens) }}</dd><dt>标准花费</dt><dd>{{ money(selected.total_cost, 6) }}</dd><dt>实际花费</dt><dd>{{ money(selected.actual_cost, 6) }}</dd><dt>倍率</dt><dd>{{ selected.rate_multiplier }}×</dd><dt>传输</dt><dd>{{ selected.request_type || (selected.stream ? 'stream' : 'sync') }}</dd><dt>首 Token 延迟</dt><dd>{{ selected.first_token_ms ?? '—' }} ms</dd><dt>推理强度</dt><dd>{{ selected.reasoning_effort || '—' }}</dd><dt>服务等级</dt><dd>{{ selected.service_tier || '—' }}</dd></dl><h3 class="client-detail-subtitle">请求标识</h3><code class="client-wrap">{{ selected.request_id }}</code></div><div v-else-if="selectedError" class="client-detail-body"><p class="client-detail-model">{{ selectedError.model }}</p><dl class="client-details"><dt>时间</dt><dd>{{ dateTime(selectedError.created_at) }}</dd><dt>状态码</dt><dd>{{ selectedError.status_code }}</dd><dt>密钥</dt><dd>{{ selectedError.key_name }}</dd><dt>类别</dt><dd>{{ selectedError.category }}</dd><dt>接口</dt><dd>{{ selectedError.inbound_endpoint }}</dd></dl><h3 class="client-detail-subtitle">错误信息</h3><p class="client-wrap">{{ selectedError.message }}</p><pre v-if="selectedError.error_body" class="client-config">{{ selectedError.error_body }}</pre></div></aside></div>
</AppLayout></template>
