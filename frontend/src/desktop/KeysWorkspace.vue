<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import { keysAPI } from '@/api/keys'
import { userGroupsAPI } from '@/api/groups'
import { useAppStore } from '@/stores/app'
import type { ApiKey, Group } from '@/types'
import { money, dateTime, errorMessage } from './format'

const app = useAppStore()
const route = useRoute()
const router = useRouter()
const rows = ref<ApiKey[]>([])
const groups = ref<Group[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const status = ref('')
const selected = ref<ApiKey>()
const tab = ref<'overview' | 'connection'>('overview')
const revealed = ref(false)
const loading = ref(false)
const busy = ref(false)
const failure = ref('')
const formError = ref('')
const editor = ref(false)
const editingId = ref<number>()
const deleteOpen = ref(false)
const form = reactive({ name: '', group: '' as string | number, quota: 0, expiresDays: 0, expiresAt: '', whitelist: '', blacklist: '', rate5h: 0, rate1d: 0, rate7d: 0 })
const pages = computed(() => Math.max(1, Math.ceil(total.value / 20)))
const endpoint = computed(() => (app.cachedPublicSettings?.api_base_url || 'https://api.ravenaiworld.org').replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1')
const statusNames = { active: '使用中', inactive: '已停用', quota_exhausted: '额度用尽', expired: '已过期' }
let generation = 0
let searchTimer: ReturnType<typeof setTimeout>
async function load() {
  const current = ++generation
  loading.value = true; failure.value = ''
  try {
    const result = await keysAPI.list(page.value, 20, { search: search.value || undefined, status: status.value || undefined })
    if (current !== generation) return
    rows.value = result.items || []; total.value = result.total
    selected.value = rows.value.find(item => item.id === selected.value?.id) || rows.value[0]
  } catch (error) { if (current === generation) failure.value = errorMessage(error) }
  finally { if (current === generation) loading.value = false }
}
async function loadGroups() {
  try { groups.value = await userGroupsAPI.getAvailable({ includeMaintenance: true }) }
  catch (error) { app.showError('分组加载失败：' + errorMessage(error)) }
}
function choose(key: ApiKey) { selected.value = key; revealed.value = false }
function openEditor(key?: ApiKey) {
  editingId.value = key?.id
  Object.assign(form, { name: key?.name || '', group: key?.group_id ?? '', quota: key?.quota || 0, expiresDays: 0, expiresAt: key?.expires_at ? toLocalInput(key.expires_at) : '', whitelist: key?.ip_whitelist?.join('\n') || '', blacklist: key?.ip_blacklist?.join('\n') || '', rate5h: key?.rate_limit_5h || 0, rate1d: key?.rate_limit_1d || 0, rate7d: key?.rate_limit_7d || 0 })
  formError.value = ''; editor.value = true
  void loadGroups()
}
function toLocalInput(iso: string) { const value = new Date(iso); return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
async function save() {
  if (busy.value) return
  const name = form.name.trim()
  if (!name) { formError.value = '请输入密钥名称'; return }
  busy.value = true; formError.value = ''
  const list = (value: string) => value.split(/\n|,/).map(item => item.trim()).filter(Boolean)
  const groupId = form.group === '' ? null : Number(form.group)
  const rates = { rate_limit_5h: Number(form.rate5h) || 0, rate_limit_1d: Number(form.rate1d) || 0, rate_limit_7d: Number(form.rate7d) || 0 }
  try {
    let saved: ApiKey
    if (editingId.value) saved = await keysAPI.update(editingId.value, { name, group_id: groupId, quota: Number(form.quota) || 0, expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : '', ip_whitelist: list(form.whitelist), ip_blacklist: list(form.blacklist), ...rates })
    else saved = await keysAPI.create(name, groupId, undefined, list(form.whitelist), list(form.blacklist), Number(form.quota) || 0, Number(form.expiresDays) || undefined, rates)
    editor.value = false; selected.value = saved; revealed.value = false
    if (!editingId.value) { page.value = 1; search.value = ''; status.value = '' }
    app.showSuccess(editingId.value ? '密钥已更新' : '密钥已创建')
    await load()
  } catch (error) { formError.value = errorMessage(error) }
  finally { busy.value = false }
}
async function toggle() {
  if (!selected.value || busy.value) return
  busy.value = true
  try { await keysAPI.toggleStatus(selected.value.id, selected.value.status === 'active' ? 'inactive' : 'active'); await load() }
  catch (error) { app.showError(errorMessage(error)) }
  finally { busy.value = false }
}
async function remove() {
  if (!selected.value || busy.value) return
  busy.value = true
  try { await keysAPI.delete(selected.value.id); deleteOpen.value = false; selected.value = undefined; if (rows.value.length === 1 && page.value > 1) page.value--; await load(); app.showSuccess('密钥已删除') }
  catch (error) { app.showError(errorMessage(error)) }
  finally { busy.value = false }
}
async function copy(value: string) { try { await navigator.clipboard.writeText(value); app.showSuccess('已复制') } catch { app.showError('无法复制，请选择文本后复制。') } }
watch([page, status], () => { void load() })
watch(search, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { if (page.value !== 1) page.value = 1; else void load() }, 250) })
watch(() => selected.value?.id, () => { revealed.value = false })
onMounted(async () => { await load(); if (route.query.create === '1') { openEditor(); void router.replace('/keys') } })
onBeforeUnmount(() => { clearTimeout(searchTimer); generation++ })
</script>

<template>
  <AppLayout fill-viewport>
    <template #actions><button class="client-icon" :disabled="loading" title="刷新密钥" aria-label="刷新密钥" @click="load"><Icon name="refresh" size="sm" :class="{ 'animate-spin': loading }" /></button><button class="client-button primary" data-testid="create-key" @click="openEditor()"><Icon name="plus" size="sm" />新建密钥</button></template>
    <div class="client-key-workspace">
      <section class="client-key-list">
        <div class="client-filter-bar"><label class="client-search-input"><Icon name="search" size="sm" /><input v-model="search" placeholder="搜索密钥" aria-label="搜索密钥" /></label><select v-model="status" aria-label="密钥状态" @change="page = 1"><option value="">全部状态</option><option v-for="(label, value) in statusNames" :key="value" :value="value">{{ label }}</option></select></div>
        <div class="client-list-caption"><span>{{ total }} 个密钥</span><span>{{ loading ? '同步中…' : '最近创建' }}</span></div>
        <div v-if="failure" class="client-error" role="alert"><span>{{ failure }}</span><button @click="load">重试</button></div>
        <div class="client-key-rows" :aria-busy="loading"><button v-for="key in rows" :key="key.id" class="client-key-row" :class="{ selected: selected?.id === key.id }" @click="choose(key)"><span class="client-key-glyph"><Icon name="key" /></span><span class="client-key-row-text"><strong>{{ key.name }}</strong><small>{{ key.group?.name || '默认分组' }} · {{ key.key ? `${key.key.slice(0, 7)}…${key.key.slice(-4)}` : '密钥已隐藏' }}</small></span><span class="client-state" :class="key.status">{{ statusNames[key.status] }}</span></button><div v-if="!rows.length && !failure" class="client-empty tall"><Icon name="key" size="xl" /><strong>{{ loading ? '正在加载密钥…' : search || status ? '没有匹配的密钥' : '还没有 API 密钥' }}</strong><button v-if="!loading && !search && !status" class="client-button" @click="openEditor()"><Icon name="plus" size="sm" />新建密钥</button></div></div>
        <footer class="client-pagination"><span>第 {{ page }} / {{ pages }} 页</span><button class="client-icon" title="上一页" :disabled="page <= 1 || loading" @click="page--"><Icon name="chevronLeft" size="sm" /></button><button class="client-icon" title="下一页" :disabled="page >= pages || loading" @click="page++"><Icon name="chevronRight" size="sm" /></button></footer>
      </section>
      <section class="client-key-detail">
        <template v-if="selected"><div class="client-detail-heading"><div><p class="client-eyebrow">API KEY</p><h2>{{ selected.name }}</h2></div><button class="client-icon" title="编辑密钥" aria-label="编辑密钥" @click="openEditor(selected)"><Icon name="edit" size="sm" /></button></div><div class="client-tabs"><button :class="{ active: tab === 'overview' }" @click="tab = 'overview'">概览</button><button :class="{ active: tab === 'connection' }" @click="tab = 'connection'">接入配置</button></div>
        <div class="client-detail-body">
          <template v-if="tab === 'overview'"><div class="client-detail-status"><span class="client-state" :class="selected.status">{{ statusNames[selected.status] }}</span><button v-if="selected.status === 'active' || selected.status === 'inactive'" class="client-text-link" :disabled="busy" @click="toggle">{{ selected.status === 'active' ? '停用密钥' : '启用密钥' }}</button></div><dl class="client-details"><dt>分组</dt><dd>{{ selected.group?.name || '默认分组' }}</dd><dt>累计花费</dt><dd>{{ money(selected.quota_used, 4) }}</dd><dt>额度上限</dt><dd>{{ selected.quota > 0 ? money(selected.quota) : '不限额' }}</dd><dt>有效期</dt><dd>{{ selected.expires_at ? dateTime(selected.expires_at) : '长期有效' }}</dd><dt>最近使用</dt><dd>{{ dateTime(selected.last_used_at) }}</dd><dt>创建时间</dt><dd>{{ dateTime(selected.created_at) }}</dd></dl><h3 class="client-detail-subtitle">周期限额</h3><div class="client-limit-row" v-for="limit in [{ label: '5 小时', cap: selected.rate_limit_5h, used: selected.usage_5h }, { label: '1 天', cap: selected.rate_limit_1d, used: selected.usage_1d }, { label: '7 天', cap: selected.rate_limit_7d, used: selected.usage_7d }]" :key="limit.label"><span>{{ limit.label }}</span><span>{{ money(limit.used || 0, 4) }} / {{ limit.cap ? money(limit.cap) : '不限额' }}</span></div><h3 class="client-detail-subtitle">IP 访问限制</h3><p class="client-muted client-wrap">白名单：{{ selected.ip_whitelist?.join(', ') || '未设置' }}</p><p class="client-muted client-wrap">黑名单：{{ selected.ip_blacklist?.join(', ') || '未设置' }}</p><div class="client-detail-bottom"><RouterLink class="client-button" :to="`/usage?key=${selected.id}`"><Icon name="chart" size="sm" />查看用量</RouterLink><button class="client-icon danger" title="删除密钥" aria-label="删除密钥" @click="deleteOpen = true"><Icon name="trash" size="sm" /></button></div></template>
          <template v-else><label class="client-field-label">API 地址</label><div class="client-secret"><input :value="endpoint" readonly /><button class="client-icon" title="复制 API 地址" @click="copy(endpoint)"><Icon name="copy" size="sm" /></button></div><label class="client-field-label">API 密钥</label><div class="client-secret"><input :value="selected.key" :type="revealed ? 'text' : 'password'" readonly /><button class="client-icon" :title="revealed ? '隐藏密钥' : '显示密钥'" @click="revealed = !revealed"><Icon :name="revealed ? 'eyeOff' : 'eye'" size="sm" /></button><button class="client-icon" title="复制密钥" @click="copy(selected.key)"><Icon name="copy" size="sm" /></button></div><h3 class="client-detail-subtitle">环境变量</h3><pre class="client-config">OPENAI_BASE_URL={{ endpoint }}
OPENAI_API_KEY={{ revealed ? selected.key : '••••••••••••••••' }}</pre><button class="client-button" @click="copy(`OPENAI_BASE_URL=${endpoint}\nOPENAI_API_KEY=${selected.key}`)"><Icon name="copy" size="sm" />复制配置</button></template>
        </div></template><div v-else class="client-empty tall"><Icon name="key" size="xl" /><span>密钥详情</span></div>
      </section>
    </div>
    <BaseDialog :show="editor" :title="editingId ? '编辑密钥' : '新建密钥'" :close-on-escape="!busy" @close="!busy && (editor = false)"><form id="client-key-form" class="client-form" @submit.prevent="save"><div v-if="formError" role="alert" class="client-error">{{ formError }}</div><label>名称<input v-model="form.name" name="key-name" required maxlength="100" placeholder="例如：日常开发" /></label><label>分组<select v-model="form.group"><option value="">默认分组</option><option v-for="group in groups" :key="group.id" :value="group.id" :disabled="group.status !== 'active' && group.id !== selected?.group_id">{{ group.name }}{{ group.status !== 'active' ? '（暂不可用）' : '' }}</option></select></label><div class="client-form-grid"><label>总额度（美元，0 为不限额）<input v-model.number="form.quota" type="number" min="0" step="0.01" /></label><label v-if="!editingId">有效天数（0 为长期）<input v-model.number="form.expiresDays" type="number" min="0" max="36500" step="1" /></label><label v-else>到期时间<input v-model="form.expiresAt" type="datetime-local" /></label></div><details><summary>周期限额与 IP 访问限制</summary><div class="client-form-grid"><label>5 小时限额（美元）<input v-model.number="form.rate5h" type="number" min="0" step="0.01" /></label><label>每天限额（美元）<input v-model.number="form.rate1d" type="number" min="0" step="0.01" /></label><label>每周限额（美元）<input v-model.number="form.rate7d" type="number" min="0" step="0.01" /></label></div><label>IP 白名单<textarea v-model="form.whitelist" rows="3" placeholder="每行一个 IP 或 CIDR" /></label><label>IP 黑名单<textarea v-model="form.blacklist" rows="3" placeholder="每行一个 IP 或 CIDR" /></label></details></form><template #footer><button class="client-button" :disabled="busy" @click="editor = false">取消</button><button class="client-button primary" form="client-key-form" type="submit" :disabled="busy">{{ busy ? '正在保存…' : editingId ? '保存更改' : '创建密钥' }}</button></template></BaseDialog>
    <BaseDialog :show="deleteOpen" title="删除密钥" width="narrow" :close-on-escape="!busy" @close="!busy && (deleteOpen = false)"><p>删除“{{ selected?.name }}”后，使用这个密钥的应用将无法连接。此操作不可撤销。</p><template #footer><button class="client-button" :disabled="busy" @click="deleteOpen = false">取消</button><button class="client-button danger" :disabled="busy" @click="remove">{{ busy ? '正在删除…' : '删除密钥' }}</button></template></BaseDialog>
  </AppLayout>
</template>
