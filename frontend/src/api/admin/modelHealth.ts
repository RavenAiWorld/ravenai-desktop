import { apiClient } from '../client'

export interface ModelHealthRule {
  id: string
  group_id?: number
  name: string
  model: string
  upstream_model: string
  primary_id: number
  backup_ids: number[]
  enabled: boolean
  mode: 'auto' | 'primary' | 'backup' | 'observe'
  interval_seconds: number
  timeout_seconds: number
  failure_threshold: number
  recovery_threshold: number
  hold_seconds: number
  header_policy?: ModelHealthHeaderPolicy
}
export interface ModelHealthHeaderPolicy {
  enabled: boolean
  wait_seconds: number
  rate_percent: number
  min_samples: number
  window_minutes: number[]
}
export interface ModelHealthHeaderWindow {
  minutes: number
  requests: number
  slow: number
  rate: number | null
  enough_samples: boolean
  partial: boolean
  observed_seconds: number
  warning: boolean
}
export interface ModelHealthHeaderSignal {
  checked_at: string
  windows: ModelHealthHeaderWindow[]
  warning: boolean
  enough_samples: boolean
  slow_observed: boolean
  error?: string
}
export interface ModelHealthSettings {
  revision: string
  enabled: boolean
  rules: ModelHealthRule[]
  provider_groups?: Record<string, number>
}
export interface ModelHealthProviderAdvisory {
  id: string
  source_group_id?: number
  source_group?: string
  window: string
  scope?: string
  classification?: string
  numerator: number
  denominator: number
  percent: number
  threshold: number
  operator?: string
  long_window?: boolean
}
export interface ModelHealthObservation {
  high_error_advisory?: boolean
  upstream_advisories?: ModelHealthProviderAdvisory[]
  local_outcomes?: { as_of: string; successes: number; failures: number; last_failure?: string; last_success?: string }
  local_error?: string
  delisted?: boolean
  traffic?: { samples: number; success_rate: number; window_end: string }
  account_id: number
  status: string
  successes: number
  failures: number
  latency_ms: number
  checked_at: string | null
  error: string
  ready: boolean
  source?: string
  source_group_id?: number
  source_at?: string
  provider_model?: string
  provider_model_at?: string
  provider_model_status?: string
  provider_slow_blocked?: boolean
  provider_recovery_samples?: number
  provider_overload_blocked?: boolean
  provider_warning_blocks?: Record<string, { recovery_samples: number; source_at?: string }>
  provider_overload_recovery_samples?: number
}
export interface ModelHealthRuntime {
  route: string
  active_account_id?: number
  desired_route?: string
  desired_account_id?: number
  apply_status?: string
  reason: string
  switched_at: string | null
  next_probe_at: string | null
  observations: Record<string, ModelHealthObservation>
  error: string
  probing: boolean
  requested: boolean
  fresh: boolean
  headers?: Record<string, ModelHealthHeaderSignal>
  header_blocked?: boolean
  provider_block_reason?: string
}
export interface ModelHealthAccount {
  id: number
  name: string
  platform?: string
  status: string
  ready: boolean
  schedulable: boolean
  group_ids: number[] | null
  group_model_controls?: Record<string, Record<string, ModelHealthControl>>
  models: Record<string, string>
  rate_multiplier?: number
  model_controls?: Record<string, ModelHealthControl>
  provider_supported?: boolean
}
export interface ModelHealthControl {
  enabled: boolean
  model: string
  rule_id: string
}
export interface ModelHealthEvent {
  at: string
  rule_id: string
  rule_name?: string
  group_id?: number
  account_id?: number
  type: string
  status: string
  latency_ms?: number
  message: string
}
export interface ModelHealthState {
  provider_bindings?: Record<string, number>
  passive_only?: boolean
  apply_pending?: boolean
  missing_account_ids?: number[]
  metrics?: ModelHealthMetrics
  settings: ModelHealthSettings
  runtime: Record<string, ModelHealthRuntime>
  accounts: ModelHealthAccount[]
  events: ModelHealthEvent[]
  error: string
  providers?: ModelHealthProviders
}
export interface ModelHealthProviderMetrics {
  duration_ms: number | null
  sample_count: number
  success_rate: number | null
  tps: number | null
  cache_hit_rate: number | null
  input_price_per_million: number | null
  effective_multiplier: number | null
  effective_multiplier_expires_at?: string
  input_warning?: { excess_percent: number; multiplier: number; threshold: number; window: string }
  input_comparison?: SupplierInputComparison
}
export interface SupplierInputComparison {
  multiplier: number
  excess_percent: number
  models: string[]
  generated_at?: string
}
export interface ModelHealthProviderModel {
  model: string
  alias?: string
  health: string
  probe_state?: string
  sample_count: number
  average_ttft_ms?: number
  health_evaluated_at?: string
  health_expires_at?: string
  health_timeline?: { at: string; health: string }[]
}
export interface ModelHealthProviderTrigger {
  generated_at: string
  expires_at: string
  window: string
  model: string
  classification: string
  numerator: number
  denominator: number
  value: number
  threshold: number
  operator: string
  complete: boolean
  available: boolean
  observed_seconds: number
}
export interface ModelHealthProviderWarning {
  id: string
  status: string
  partial: boolean
  triggers: ModelHealthProviderTrigger[]
}
export interface ModelHealthProviderPoint {
  at: string
  failed_from?: string
  latency_ms: number | null
  sample_count: number
  has_data: boolean
}

export interface ModelHealthProviderGroup {
  catalog_known?: boolean
  group_id: number
  code: string
  platform: string
  rate_multiplier: number
  supported_models?: ModelHealthProviderPricing[]
  models: ModelHealthProviderModel[]
  warnings: ModelHealthProviderWarning[]
  warnings_at: string
  warnings_expires_at: string
  metrics: ModelHealthProviderMetrics
  model_metrics: Record<string, ModelHealthProviderMetrics>
  points?: ModelHealthProviderPoint[]
  series_at?: string
  series_range?: string
  series_period?: { from: string; to: string }
  probe_points?: ModelHealthProviderPoint[]
  detail?: string
  long_context?: boolean
  visible_in_hall?: boolean
  available?: boolean | null
  probe_expires_at?: string
  stars?: number | null
  review_count?: number | null
  popularity?: {
    status: string
    fires: number
    rank: number
    groups: number
    window: string
    increment?: number
    generated_at?: string
    expires_at: string
    history_partial?: boolean
  }
  detection?: {
    status: string
    model: string
    detected_at?: string
    image_title: Record<string, string> | null
    image_url: string
    preview_url: string
    has_image?: boolean
    has_preview?: boolean
    question: string
    answer: string
    passed: boolean | null
  }
}
export interface ModelHealthProviderPricing {
  model: string
  price: {
    input_per_million: number | null
    cache_input_per_million: number | null
    output_per_million: number | null
    cache_write_per_million: number | null
  }
}
export interface ModelHealthProviders {
  metrics_range?: ModelHealthMetricsRange
  metrics_updated_at?: string
  metrics_error?: string
  metrics_stale?: boolean
  source: string
  generated_at: string
  fetched_at: string
  stale: boolean
  error: string
  catalog: { id: number; code: string; platform: string }[]
  accounts: Record<string, ModelHealthProviderGroup>
}
export interface ModelHealthMetricPoint {
  at: string
  duration_ms: number | null
  successes: number
  errors: number
}
export interface ModelHealthChannelMetrics {
  successes: number
  errors: number
  cache_hit_rate: number | null
  success_rate: number | null
  tps: number | null
  tps_samples: number
  duration_ms: number | null
  duration_samples: number
  cost_per_million: number | null
  effective_multiplier: number | null
  points: ModelHealthMetricPoint[]
}
export interface ModelHealthMetrics {
  range?: ModelHealthMetricsRange
  from: string
  to: string
  accounts: Record<string, ModelHealthChannelMetrics>
  error: string
}
export type ModelHealthMetricsRange = '1h' | '24h' | '7d'
export async function getModelHealth(range: ModelHealthMetricsRange = '1h') {
  const { data } = await apiClient.get<ModelHealthState>('/admin/model-health', { params: { range } })
  return data
}
export async function getAccountModelHealthControls(id: number) {
  const { data } = await apiClient.get<Record<string, ModelHealthControl>>(`/admin/model-health/accounts/${id}/controls`)
  return data
}
export async function getModelHealthImage(id: number, preview: boolean, version: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<Blob>(`/admin/model-health/accounts/${id}/image`, {
    params: { preview, version }, responseType: 'blob', signal
  })
  return data
}
export async function saveModelHealth(settings: ModelHealthSettings, range: ModelHealthMetricsRange = '1h') {
  const { data } = await apiClient.put<ModelHealthState>('/admin/model-health', settings, { params: { range } })
  return data
}
export async function probeModelHealth(id: string, range: ModelHealthMetricsRange = '1h') {
  const { data } = await apiClient.post<ModelHealthState>(`/admin/model-health/rules/${encodeURIComponent(id)}/probe`, undefined, { params: { range } })
  return data
}
