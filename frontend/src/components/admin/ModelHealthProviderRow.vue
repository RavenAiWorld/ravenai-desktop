<template>
  <article class="provider-row" data-testid="health-channel" :data-account-id="channel.id" :data-metrics-source="upstream ? 'aihub' : 'local'">
    <div class="board-summary provider-row-top">
      <div class="board-identity group-cell">
        <div class="group-title"><h3>{{ group?.code ?? channel.name }}</h3><ModelHealthProviderPopularity v-if="upstream" :group="group" :now="now" /></div>
        <ModelHealthChannelRoles :account-id="channel.id" :rules="rules" :state="state" />
        <ProviderReputation v-if="upstream" class="group-reputation" :group="group" :name="group?.code ?? channel.name" :warning="sourceStats?.input_warning" @reviews="showReviews = true">
          <ModelHealthProviderWarnings v-if="group?.warnings?.length" :group="group" :source="state.providers" :now="now" />
        </ProviderReputation>
        <div v-else class="group-reputation"><span class="local-source">{{ t('admin.modelHealth.localRequests') }}</span><ModelHealthProviderWarnings :local="localWarnings" :now="now" /></div>
        <p class="group-description" :title="!upstream && channel.provider_supported ? t('admin.modelHealth.providerUnbound') : group?.detail"><span :data-testid="!upstream && channel.provider_supported ? 'provider-unbound' : undefined">{{ !upstream && channel.provider_supported ? t('admin.modelHealth.providerUnbound') : group?.detail || channel.name }}</span><b v-if="group?.long_context" :title="t('admin.modelHealth.longContext')">x2</b></p>
      </div>
      <div class="board-rate multiplier-cell"><span class="board-label">{{ t('admin.modelHealth.hallMultiplier') }}</span><strong>{{ formatSupplierMetric(upstream ? group?.rate_multiplier : channel.rate_multiplier, 'rate', locale) }}</strong></div>
      <div class="board-price price-cell" :title="t(upstream ? 'admin.supplierHall.costTitle' : 'admin.modelHealth.costHint', { range })">
        <span class="board-label" :class="{ 'always-visible': !upstream }">{{ t(upstream ? 'admin.modelHealth.hallPrice' : 'admin.modelHealth.localCost') }}</span>
        <div><strong>{{ price == null ? '&mdash;' : (upstream ? '¥' : '$') + fixed(price, upstream ? 2 : 3) }}</strong><small v-if="price != null"> / M</small></div>
        <p :title="t('admin.supplierHall.effective')">{{ predictedRate == null ? '&mdash;' : fixed(predictedRate, 2) + '×' }}</p>
      </div>
      <div class="board-state status-cell"><p class="board-label">{{ t('admin.modelHealth.hallStatus') }}</p>
        <span v-if="upstream" class="availability" data-testid="group-probe-status" :class="groupProbe.status === 'ok' ? 'is-available' : groupProbe.status === 'abnormal' ? 'is-failed' : 'is-unknown'" :title="t(groupProbe.titleKey, { available: groupProbe.availableRaw, expires: groupProbe.probeExpiresRaw, feed: groupProbe.feedRaw })"><i />{{ t(groupProbe.labelKey) }}</span>
        <span v-else class="availability" :class="available === true ? 'is-available' : available === false ? 'is-failed' : 'is-unknown'"><i />{{ t(available === true ? 'admin.modelHealth.hallAvailable' : available === false ? 'admin.modelHealth.hallUnavailable' : 'admin.modelHealth.hallUnknown') }}</span>
        <span v-if="!localReady" class="availability is-unknown" data-testid="local-unavailable">{{ t('admin.modelHealth.localUnavailable') }}</span>
        <div class="model-aliases"><span v-for="model in visibleModels" :key="model.model" :class="`model-${model.health}`" :title="model.title">{{ model.alias }}<template v-if="model.closed"> · {{ t('admin.modelHealth.blocked') }}</template><i /></span><button v-if="visibleModels.length < models.length" type="button" :aria-label="t('admin.supplierHall.modelCount', { count: models.length })" @click="toggleDetails">+{{ models.length - visibleModels.length }}</button></div>

      </div>
      <div class="board-latency"><span class="board-label" :class="{ 'always-visible': !upstream }">{{ averageLabel }}</span><ProviderLatencyMeter :ms="metrics?.duration_ms" :hint="t(upstream ? 'admin.modelHealth.upstreamMetrics' : 'admin.modelHealth.durationHint', { range })" /></div>
      <div class="board-detection detection-cell"><span class="board-label">{{ t('admin.modelHealth.modelDetection') }}</span>
        <button v-if="detection" type="button" class="detection-status" :class="detection.passed === false || detection.status === 'failed' ? 'is-failed' : detection.status === 'passed' ? 'is-available' : 'is-unknown'" @click="showDetection = true">{{ detectionStatus }}</button>
        <span v-else class="board-absent">{{ t('admin.supplierHall.noDetection') }}</span>
        <button v-if="imageTitle" type="button" class="detection-title" :title="imageTitle" @click="showDetection = true"><Icon name="eye" size="xs" /><span>{{ imageTitle }}</span></button>
      </div>
      <div class="board-image"><button v-if="detection?.preview_url || detection?.image_url" type="button" :title="imageTitle" :aria-label="imageTitle || t('admin.supplierHall.image')" @click="showDetection = true"><ModelHealthDetectionImage lazy :account-id="channel.id" :source="detection.preview_url || detection.image_url" :title="imageTitle || t('admin.supplierHall.image')" :preview="!!detection.preview_url" /></button><span v-else class="board-absent" aria-hidden="true">&ndash;</span></div>
      <div class="board-actions row-actions">
        <button type="button" class="group-settings" :aria-expanded="expanded" :aria-controls="detailsId" @click="toggleDetails">
          <Icon name="cog" size="xs" aria-hidden="true" />{{ t('admin.modelHealth.groupSettings') }}
        </button>
        <button v-if="channel.provider_supported" type="button" class="group-settings channel-retire" :aria-label="`${t('admin.supplierHall.retire')} #${channel.id}`" :disabled="saving" @click="emit('retire', channel)">
          <Icon name="trash" size="xs" aria-hidden="true" />{{ t('admin.supplierHall.retire') }}
        </button>
      </div>
    </div>
    <div class="board-history provider-row-bottom">
      <ProviderIndicators :stats="metrics" :range="range" :scope="scope" />
      <div class="chart-cell" :data-testid="'health-trend-' + channel.id">
        <SupplierHistoryChart compact :trend="trend" :period="upstream ? group?.series_period : state.metrics" :label="(group?.code ?? channel.name) + ' · ' + averageLabel" :average-label="averageLabel" :empty-label="t('admin.modelHealth.noSamples')" />
        <div class="board-legend"><span v-if="upstream"><i class="probe-line" />{{ t('admin.modelHealth.textProbe') }}</span><span><i />{{ averageLabel }}</span><span v-if="hasFailures"><i class="failed-band" />{{ t('admin.supplierHall.failedProbe') }}</span><span class="board-scope">{{ upstream ? t('admin.supplierHall.responseTrend') : t('admin.modelHealth.localRequests') }} · {{ upstream ? group?.series_range ?? range : range }}</span></div>
      </div>
    </div>
    <details :id="detailsId" ref="details" class="channel-details" @toggle="expanded = Boolean(details?.open)">
      <summary class="sr-only">{{ t('admin.modelHealth.detail') }} #{{ channel.id }}</summary>
      <div class="channel-settings">
        <div><strong>{{ channel.name }} #{{ channel.id }}</strong><p>{{ t('admin.modelHealth.localCost') }}: ${{ number(localMetric?.cost_per_million, 3) }} / M tokens</p></div>
        <label v-if="channel.provider_supported || upstream"><span>{{ t('admin.modelHealth.providerGroup') }}</span><select :value="groupId" :disabled="saving" :data-testid="`provider-binding-${channel.id}`" :aria-label="`${t('admin.modelHealth.providerGroup')} #${channel.id}`" @change="emit('bindProvider', channel.id, Number(($event.target as HTMLSelectElement).value))"><option :value="0">{{ t('admin.modelHealth.localRequests') }}</option><option v-if="groupId && !providerChoices.some(item => item.id === groupId)" :value="groupId">#{{ groupId }}</option><option v-for="item in providerChoices" :key="item.id" :value="item.id">{{ item.code }} #{{ item.id }}</option></select></label>
        <div v-for="rule in rules" :key="rule.id" class="channel-rule"><div><strong>{{ rule.name }} · {{ channel.id === rule.primary_id ? t('admin.modelHealth.primary') : t('admin.modelHealth.backupNumber', { number: rule.backup_ids.indexOf(channel.id) + 1 }) }}</strong><p>{{ t(`admin.modelHealth.routes.${state.runtime[rule.id]?.route ?? 'unmanaged'}`) }} · {{ reason(state.runtime[rule.id]?.reason) }}</p><div class="local-models"><span v-for="model in Object.keys(channel.model_controls ?? {})" :key="model" :class="channel.model_controls?.[model]?.enabled ? 'is-available' : 'is-unknown'">{{ model }}<template v-if="!channel.model_controls?.[model]?.enabled"> · {{ t('admin.modelHealth.blocked') }}</template></span></div></div><button type="button" class="row-icon" :title="t('admin.modelHealth.probe')" :aria-label="`${t('admin.modelHealth.probe')} · ${rule.name}`" :disabled="state.runtime[rule.id]?.probing || state.runtime[rule.id]?.requested" @click="emit('probe', rule.id)"><Icon name="refresh" size="sm" /></button><button type="button" class="row-icon" :title="t('admin.modelHealth.edit')" :aria-label="`${t('admin.modelHealth.edit')} · ${rule.name}`" @click="emit('edit', rule)"><Icon name="edit" size="sm" /></button></div>
      </div>
      <ModelHealthProviderSignal v-if="upstream" :source="state.providers" :group="group" :group-id="groupId" :models="providerModels" :range="range" :metrics-stale="metricsStale" />
      <ModelHealthHeaderSignal v-for="rule in rules" :key="rule.id" :rule="rule" :account-id="channel.id" :signal="state.runtime[rule.id]?.headers?.[String(channel.id)]" />
    </details>
    <SupplierReviewsDialog v-if="showReviews && groupId" :provider="{ id: groupId, code: group?.code ?? channel.name }" @close="showReviews = false" />
    <BaseDialog :show="showDetection && !!detection" :title="`${group?.code} · ${t('admin.modelHealth.modelDetection')}`" width="wide" :z-index="100" :close-on-click-outside="true" @close="showDetection = false">
        <div v-if="detection" class="detection-dialog">
          <p>{{ detectionStatus }} · {{ detection.model }} · {{ time(detection.detected_at) }}</p>
          <ModelHealthDetectionImage v-if="showDetection && detection.image_url" :account-id="channel.id" :source="detection.image_url" :title="imageTitle" />
          <h4>{{ imageTitle }}</h4>
          <pre>{{ detection.question }}</pre>
          <strong class="detection-result">{{ detection.answer }}</strong>
        </div>
    </BaseDialog>
  </article>
</template>

<script setup lang="ts">
import SupplierReviewsDialog from './SupplierReviewsDialog.vue'
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import ProviderIndicators from './ProviderIndicators.vue'
import ProviderLatencyMeter from './ProviderLatencyMeter.vue'
import ProviderReputation from './ProviderReputation.vue'
import SupplierHistoryChart from './SupplierHistoryChart.vue'
import Icon from '@/components/icons/Icon.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import ModelHealthProviderWarnings from './ModelHealthProviderWarnings.vue'
import ModelHealthProviderSignal from './ModelHealthProviderSignal.vue'
import ModelHealthHeaderSignal from './ModelHealthHeaderSignal.vue'
import ModelHealthChannelRoles from './ModelHealthChannelRoles.vue'
import ModelHealthDetectionImage from './ModelHealthDetectionImage.vue'
import ModelHealthProviderPopularity from './ModelHealthProviderPopularity.vue'
import { formatSupplierMetric, supplierEffectiveMultiplier, supplierScopedMetrics } from '@/utils/supplierHall'
import type { SupplierTrend } from '@/api/admin/supplierHall'
import { modelHealthGroupProbePresentation, modelHealthProviderHealth } from '@/utils/modelHealthProvider'
import type { ModelHealthAccount, ModelHealthMetricsRange, ModelHealthRule, ModelHealthState, ModelHealthProviderGroup, ModelHealthProviderModel, ModelHealthProviderTrigger, ModelHealthProviderWarning } from '@/api/admin/modelHealth'

const props = withDefaults(defineProps<{ channel: ModelHealthAccount; group?: ModelHealthProviderGroup; groupId: number; state: ModelHealthState; rules: ModelHealthRule[]; saving?: boolean; range?: ModelHealthMetricsRange }>(), { range: '1h' })
const emit = defineEmits<{ edit: [rule: ModelHealthRule]; probe: [id: string]; bindProvider: [id: number, groupId: number]; retire: [account: ModelHealthAccount] }>()
const showReviews = ref(false)
const detailsId = useId()
const { t, te, locale } = useI18n()
const now = ref(Date.now()), details = ref<HTMLDetailsElement>(), expanded = ref(false), showDetection = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
const localMetric = computed(() => props.state.metrics?.accounts[String(props.channel.id)])
const upstream = computed(() => props.groupId > 0)
const metricsStale = computed(() => !props.state.providers || !!(props.state.providers.metrics_stale || props.state.providers.metrics_error || props.state.providers.stale || props.state.providers.error) || !!props.state.providers.metrics_range && props.state.providers.metrics_range !== props.range)
const sourceStats = computed(() => supplierScopedMetrics(props.group, '', metricsStale.value))
const metrics = computed(() => upstream.value ? sourceStats.value : props.state.metrics?.error ? undefined : localMetric.value)
const price = computed(() => upstream.value ? sourceStats.value?.input_price_per_million : props.state.metrics?.error ? null : localMetric.value?.cost_per_million)
const predictedRate = computed(() => upstream.value ? supplierEffectiveMultiplier(sourceStats.value, now.value) : metrics.value?.effective_multiplier)
const scope = computed(() => t(upstream.value ? 'admin.modelHealth.upstreamMetrics' : 'admin.modelHealth.localRequests', { range: props.range }))
const averageLabel = computed(() => t(upstream.value ? 'admin.modelHealth.hallAverage' : 'admin.modelHealth.averageRequests'))
const platform = computed(() => props.channel.platform ?? 'openai')
const providerChoices = computed(() => props.state.providers?.catalog.filter(item => item.platform === platform.value) ?? [])
const detection = computed(() => {
  const value = props.group?.detection
  if (!upstream.value || !(value?.status || value?.model || value?.preview_url || value?.image_url)) return undefined
  return platform.value === 'anthropic' && !value.model?.startsWith('claude-') ? undefined : value
})
const fresh = computed(() => !props.state.providers?.stale && !props.state.providers?.error)
const localReady = computed(() => props.channel.ready && props.channel.schedulable)
const localObservations = computed(() => props.rules.flatMap(rule => {
  const observation = props.state.runtime[rule.id]?.observations[String(props.channel.id)]
  return observation ? [{ ...observation, model: rule.model }] : []
}))
const groupProbe = computed(() => modelHealthGroupProbePresentation(props.groupId, props.group, props.state.providers, now.value))
const available = computed(() => {
  if (upstream.value) return fresh.value && props.group?.probe_expires_at && Date.parse(props.group.probe_expires_at) > now.value ? props.group.available : null
  if (!localReady.value) return false
  const observations = localObservations.value.filter(item => item.checked_at && Math.abs(now.value - Date.parse(item.checked_at)) <= 15000)
  return observations.some(item => item.status === 'failed') ? false : observations.length && observations.every(item => item.status === 'healthy') ? true : null
})
const imageTitle = computed(() => detection.value?.image_title?.[locale?.value?.startsWith('zh') ? 'zh' : 'en'] ?? detection.value?.image_title?.zh ?? '')
const detectionStatus = computed(() => {
  const status = detection.value?.passed === false ? 'failed' : detection.value?.status
  return t(`admin.modelHealth.detectionStates.${status === 'passed' || status === 'failed' || status === 'running' ? status : 'unknown'}`)
})
function number(value: number | null | undefined, digits: number) { return value == null || !Number.isFinite(value) ? '-' : value.toLocaleString(undefined, { maximumFractionDigits: digits }) }
function fixed(value: number | null | undefined, digits: number) { return value == null || !Number.isFinite(value) ? '-' : value.toFixed(digits) }
function time(value?: string) { return value ? new Date(value).toLocaleString() : '-' }
function health(model: ModelHealthProviderModel) {
  return modelHealthProviderHealth(model, props.state.providers, now.value)
}
function locallyClosed(model: string) {
  const ruleModels = props.rules.filter(rule => (rule.upstream_model || props.channel.models[rule.model] || rule.model) === model).map(rule => rule.model)
  const names = new Set([model, ...ruleModels, ...Object.keys(props.channel.models).filter(name => props.channel.models[name] === model)])
  const controls = [...names].flatMap(name => props.channel.model_controls?.[name] ? [props.channel.model_controls[name]!] : [])
  return !localReady.value || controls.length > 0 && controls.every(control => !control.enabled)
}
const providerModels = computed(() => {
  const probes = props.group?.models ?? []
  const byTarget = new Map(probes.filter(probe => probe.probe_state !== 'not_listed').map(probe => [probe.model, probe]))
  const rows = platform.value === 'anthropic'
    ? Object.entries(props.channel.models)
        .filter(([id]) => id && !/[\s*?]/.test(id))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([model, target]) => ({ model, target, alias: model, probe: byTarget.get(target) }))
    : probes.map(probe => ({ model: probe.model, target: probe.model, alias: probe.alias || probe.model, probe }))
  return rows.map(row => {
    const status = row.probe ? health(row.probe) : 'unknown'
    return { ...row, health: status, closed: locallyClosed(row.model), title: `${row.model} · ${t(`admin.modelHealth.${status}`)}` }
  })
})
const models = computed(() => {
  if (upstream.value) return providerModels.value
  const names = new Set([...Object.keys(props.channel.models), ...Object.keys(props.channel.model_controls ?? {}), ...props.rules.map(rule => rule.model)])
  return [...names].sort().map(model => {
    const enabled = localReady.value && (props.channel.model_controls?.[model]?.enabled ?? Boolean(props.channel.models[model]))
    const observation = localObservations.value.find(item => item.model === model)
    const status = observation?.checked_at && Math.abs(now.value - Date.parse(observation.checked_at)) <= 15000 ? observation.status : 'unknown'
    return { model, alias: model, health: !enabled ? 'stale' : status, closed: !enabled,
      title: `${model} · ${t(enabled ? 'admin.modelHealth.serving' : 'admin.modelHealth.blocked')}` }
  })
})
const visibleModels = computed(() => expanded.value ? models.value : models.value.slice(0, 4))
const localWarnings = computed(() => {
  if (upstream.value) return undefined
  const signals = props.rules.flatMap(rule => {
    const signal = props.state.runtime[rule.id]?.headers?.[String(props.channel.id)]
    return rule.header_policy?.enabled && signal && !signal.error && Math.abs(now.value - Date.parse(signal.checked_at)) <= 15000 ? [{ rule, signal }] : []
  })
  if (!signals.length) return undefined
  const generatedAt = Math.max(...signals.map(({ signal }) => Date.parse(signal.checked_at)))
  const triggers: ModelHealthProviderTrigger[] = signals.flatMap(({ rule, signal }) => signal.windows
    .filter(window => window.warning && window.enough_samples && window.rate != null)
    .map(window => ({
      generated_at: signal.checked_at, expires_at: new Date(Date.parse(signal.checked_at) + 15000).toISOString(),
      window: window.minutes >= 60 ? `${window.minutes / 60}h` : `${window.minutes}m`, model: rule.model,
      classification: `local_headers_${rule.id}`, numerator: window.slow, denominator: window.requests,
      value: window.rate! * 100, threshold: rule.header_policy!.rate_percent, operator: '>=',
      complete: !window.partial, available: true, observed_seconds: window.observed_seconds
    })))
  const partial = signals.some(({ signal }) => signal.windows.some(window => window.partial))
  const warnings: ModelHealthProviderWarning[] = [{ id: 'slow_response', status: triggers.length ? 'active' : partial ? 'partial' : 'healthy', partial, triggers }]
  return {
    generated_at: new Date(generatedAt).toISOString(), expires_at: new Date(generatedAt + 15000).toISOString(), warnings,
    cause_labels: Object.fromEntries(signals.map(({ rule }) => [
      `local_headers_${rule.id}`, `${rule.model} · ${t('admin.modelHealth.headerWaitLabel', { seconds: rule.header_policy!.wait_seconds })}`
    ]))
  }
})
const reason = (value?: string) => value && te(`admin.modelHealth.reasons.${value}`) ? t(`admin.modelHealth.reasons.${value}`) : value ?? ''
const trend = computed<SupplierTrend | undefined>(() => {
  if (upstream.value) return metricsStale.value || !props.group ? undefined : {
    generated_at: props.group.series_at ?? '', user_latency: props.group.points ?? null, probe: props.group.probe_points ?? null,
  }
  if (!localMetric.value || props.state.metrics?.error) return undefined
  return { generated_at: props.state.metrics?.to ?? '', probe: null, user_latency: localMetric.value.points.map(point => ({
    at: point.at, latency_ms: point.duration_ms, has_data: point.duration_ms != null, sample_count: point.successes,
  })) }
})
const hasFailures = computed(() => trend.value?.probe?.some(point => !!point.failed_from))
function toggleDetails() { if (details.value) { details.value.open = !details.value.open; expanded.value = details.value.open } }
</script>

<style scoped>
.provider-row { --row-bg: #fff; min-width: 0; font-size: 13px; @apply border-b border-gray-200 bg-white text-gray-900 dark:border-dark-700 dark:bg-dark-900 dark:text-gray-100; }
.group-cell { display: grid; gap: 4px; }
.group-title, .group-reputation, .group-description, .model-aliases { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.group-title h3 { font-size: 16px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.group-reputation, .group-description, .price-cell small { font-size: 11px; @apply text-gray-600 dark:text-gray-400; }
.group-description span { @apply line-clamp-2; }
.group-description b { padding: 0 4px; @apply rounded-sm bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300; }
.group-description [data-testid="provider-unbound"] { @apply text-amber-800 dark:text-amber-400; }
.always-visible { display: block; }
.multiplier-cell strong, .price-cell strong { font-size: 17px; line-height: 1.25; font-weight: 700; font-variant-numeric: tabular-nums; }
.price-cell > div { padding-bottom: 3px; @apply border-b border-gray-200 dark:border-dark-700; }
.price-cell p { margin-top: 3px; font-weight: 600; font-variant-numeric: tabular-nums; }
.availability, .model-aliases > span { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; overflow-wrap: anywhere; }
.availability, .detection-status { border-radius: 4px; padding: 3px 7px; font-size: 11px; font-weight: 650; }
.availability i, .model-aliases i { width: 5px; height: 5px; flex: 0 0 5px; border-radius: 50%; background: currentColor; }
.is-unknown, .model-aliases > * { @apply bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-gray-300; }
.is-available, .model-aliases > .model-healthy { @apply bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300; }
.is-failed, .model-aliases > .model-failed { @apply bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300; }
.model-aliases { gap: 3px; margin-top: 5px; }
.model-aliases > * { padding: 2px 5px; border-radius: 3px; font-size: 10px; }
.detection-title { display: flex; align-items: center; gap: 4px; font-size: 11px; @apply text-cyan-800 hover:underline dark:text-cyan-300; }
.detection-title span { @apply line-clamp-2; }
.detection-title svg { flex-shrink: 0; }
.row-actions { display: grid; justify-items: end; gap: 4px; }
.group-settings { display: inline-flex; min-height: 30px; max-width: 100%; align-items: center; justify-content: center; gap: 4px; padding: 4px 7px; font-size: 11px; text-align: start; overflow-wrap: anywhere; @apply rounded border border-cyan-200 bg-cyan-50 text-cyan-800 hover:border-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200; }
.group-settings > svg { flex-shrink: 0; }
.channel-retire { @apply border-transparent bg-transparent text-red-700 hover:border-red-200 hover:bg-red-50 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-transparent dark:bg-transparent dark:text-red-300 dark:hover:border-red-800 dark:hover:bg-red-950/40; }
.row-icon { display: inline-grid; place-items: center; width: 28px; height: 28px; flex-shrink: 0; border-radius: 4px; color: #71849c; }
.row-icon:hover { background: #edf2f7; }
.channel-details { grid-column: 1 / -1; }
.channel-details[open] { border-top: 1px solid #e5e7eb; }
.channel-settings { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; padding: 16px; font-size: 12px; }
.channel-settings p { margin-top: 4px; color: #7890a8; overflow-wrap: anywhere; }
.channel-settings label > span { display: block; margin-bottom: 5px; color: #7890a8; }
.channel-settings select { width: 100%; height: 32px; border: 1px solid #dce3eb; border-radius: 4px; padding: 3px 8px; background: var(--row-bg); color: inherit; font-size: 12px; }
.channel-rule { display: flex; align-items: center; gap: 4px; }
.channel-rule > div { min-width: 0; flex: 1; }
.local-models { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.local-models > span { border-radius: 3px; padding: 1px 4px; font-size: 10px; overflow-wrap: anywhere; }
.detection-dialog { color: #172b40; font-size: 13px; }
.detection-dialog > p { color: #7890a8; font-size: 12px; margin-top: 8px; }
.detection-dialog > :deep(img) { display: block; width: 100%; max-height: 320px; object-fit: contain; margin: 20px auto 10px; }
.detection-dialog h4 { font-weight: 600; margin-top: 12px; }
.detection-dialog pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; line-height: 1.8; margin: 18px 0; }
.detection-result { display: block; font-size: 20px; color: #128466; }
:global(.dark) .provider-row { --row-bg: #171c23; }
:global(.dark) .channel-details[open] { border-color: #303740; }
:global(.dark) .detection-dialog { color: #dce5ed; }
@container provider-board (max-width: 599px) {
  .row-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .row-actions > button { min-height: 36px; }
  .channel-settings { grid-template-columns: minmax(0, 1fr); padding: 14px 12px; }
}
</style>
