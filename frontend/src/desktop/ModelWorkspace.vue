<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore, useAuthStore } from '@/stores'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import PlazaModelTable from '@/components/modelPlaza/PlazaModelTable.vue'
import PlazaModelDrawer from '@/components/modelPlaza/PlazaModelDrawer.vue'
import { buildEntries, catalogModels, isPlazaGroupVisible, matchesQuery, sortEntries, SCENARIO_PRESETS, type PlazaEntry, type PriceUnit, type SortKey } from '@/components/modelPlaza/plazaCatalog'
import { useModelPlaza } from '@/composables/useModelPlaza'
import { hasPeakRate, serverTimezoneLabel } from '@/utils/peak-rate'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
const app = useAppStore()
const auth = useAuthStore()
const route = useRoute()
const { data, loading, loadFailed, load } = useModelPlaza()
const search = ref(String(route.query.q || ''))
const groupId = ref(route.query.group ? Number(route.query.group) : 0)
const unit = ref<PriceUnit>('M')
const compare = ref(false)
const sort = ref<SortKey>('name')
const active = ref<PlazaEntry | null>(null)
const page = ref(1)
const groups = computed(() => (data.value?.groups || []).filter(isPlazaGroupVisible))
const all = computed(() => groups.value.flatMap(buildEntries))
const entries = computed(() => groupId.value ? all.value.filter(item => item.group.id === groupId.value) : catalogModels(all.value))
const visible = computed(() => sortEntries(entries.value.filter(item => matchesQuery(item, search.value)), sort.value, SCENARIO_PRESETS.agent))
const pages = computed(() => Math.max(1, Math.ceil(visible.value.length / 20)))
const pageRows = computed(() => visible.value.slice((page.value - 1) * 20, page.value * 20))
const related = computed(() => active.value ? all.value.filter(item => item.model.name.toLowerCase() === active.value!.model.name.toLowerCase() && item.model.platform === active.value!.model.platform) : [])
const apiBase = computed(() => app.cachedPublicSettings?.api_base_url || 'https://api.ravenaiworld.org/v1')
const description = computed(() => data.value?.description ? DOMPurify.sanitize(marked.parse(data.value.description) as string) : '')
const peakWindow = computed(() => { const group = active.value?.group; return group && hasPeakRate(group) ? `${group.peak_start}–${group.peak_end} (${serverTimezoneLabel(app.cachedPublicSettings?.server_utc_offset)})` : '' })
watch([search, groupId, sort], () => { page.value = 1 })
watch(pages, value => { page.value = Math.min(page.value, value) })
let pendingModel = String(route.query.model || '')
watch(all, list => { if (pendingModel && list.length) { active.value = list.find(item => item.model.name === pendingModel && (!groupId.value || item.group.id === groupId.value)) || null; pendingModel = '' } }, { immediate: true })
async function copy(text: string) { try { await navigator.clipboard.writeText(text); app.showSuccess('已复制模型名称') } catch { app.showError('无法复制，请选择文本后复制。') } }
</script>
<template><AppLayout fill-viewport><template #actions><button class="client-icon" title="刷新模型" aria-label="刷新模型" :disabled="loading" @click="load"><Icon name="refresh" size="sm" :class="{ 'animate-spin': loading }" /></button></template><div class="client-model-workspace"><aside class="client-model-groups"><p class="client-eyebrow">模型分组</p><button :class="{ selected: groupId === 0 }" @click="groupId = 0"><Icon name="cube" size="sm" /><span>全部模型</span><small>{{ catalogModels(all).length }}</small></button><button v-for="group in groups" :key="group.id" :class="{ selected: groupId === group.id }" @click="groupId = group.id"><Icon name="server" size="sm" /><span>{{ group.name }}<small v-if="group.status === 'maintenance'">维护中</small></span><small>{{ group.models.length }}</small></button></aside><section class="client-model-results"><div class="client-model-toolbar"><label class="client-search-input"><Icon name="search" size="sm" /><input v-model="search" placeholder="搜索模型名称" aria-label="搜索模型名称" /></label><select v-model="sort" aria-label="模型排序"><option value="name">名称排序</option><option value="recommended">推荐排序</option><option value="input">输入价格</option><option value="output">输出价格</option></select><select v-model="unit" aria-label="价格单位"><option value="M">每百万 Tokens</option><option value="K">每千 Tokens</option></select><label class="client-model-compare"><input v-model="compare" type="checkbox" />对比官方价</label></div><div v-if="loadFailed" class="client-error" role="alert"><span>模型目录加载失败{{ data ? '，当前显示上次数据' : '' }}。</span><button @click="load">重试</button></div><div class="client-model-table"><details v-if="description" class="client-model-notes"><summary>价格说明</summary><div class="prose prose-sm dark:prose-invert" v-html="description" /></details><PlazaModelTable v-if="pageRows.length" :entries="pageRows" :unit="unit" :compare="compare" :workload="SCENARIO_PRESETS.agent" @open="active = $event" @copy="copy" /><div v-else-if="!loadFailed" class="client-empty tall"><Icon name="cube" size="xl" /><span>{{ loading ? '正在加载模型…' : search ? '没有匹配的模型' : '暂无可用模型' }}</span></div></div><footer class="client-pagination"><span>{{ visible.length }} 个模型 · 第 {{ page }} / {{ pages }} 页</span><button class="client-icon" title="上一页" :disabled="page <= 1" @click="page--"><Icon name="chevronLeft" size="sm" /></button><button class="client-icon" title="下一页" :disabled="page >= pages" @click="page++"><Icon name="chevronRight" size="sm" /></button></footer></section></div><PlazaModelDrawer :entry="active" :group-entries="related" :unit="unit" :compare="compare" :workload="SCENARIO_PRESETS.agent" :api-base-url="apiBase" :is-authenticated="auth.isAuthenticated" :peak-window="peakWindow" @close="active = null" @copy="copy" @select="active = $event" /></AppLayout></template>
