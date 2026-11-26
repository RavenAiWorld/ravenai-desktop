import { apiClient } from '../client'
import type { ModelHealthMetricsRange, ModelHealthProviderGroup, ModelHealthProviderPoint, SupplierInputComparison } from './modelHealth'

export type SupplierSummaryRange = ModelHealthMetricsRange | '6h'
export type SupplierTrendRange = SupplierSummaryRange | '30d'

export interface SupplierHallItem extends ModelHealthProviderGroup {
  probe?: {
    model: string
    chart_models?: string[]
    ttft_ms: number | null
    e2e_ttft_ms: number | null
    success_6h: number | null
    last_probed_at?: string
  }
  input_comparison?: SupplierInputComparison
}

export interface SupplierTrend {
  generated_at: string
  period?: { from: string; to: string }
  user_latency: ModelHealthProviderPoint[] | null
  probe: ModelHealthProviderPoint[] | null
}

export interface SupplierRateHistory {
  group_id: number
  start: string
  end: string
  source_at?: string
  expires_at: string
  points: { at: string; rate: number }[]
}

export interface SupplierHall {
  range: SupplierSummaryRange
  trend_range?: SupplierTrendRange
  platform_tabs?: string[] | null
  generated_at: string
  catalog_at: string
  stale: boolean
  catalog_stale: boolean
  total: number
  items: SupplierHallItem[]
  connected: Record<string, number[]>
  pending?: number[]
}

export interface SupplierReview {
  public_id: string
  floor_number: number
  author_label: string
  stars: number
  comment: string
  date: string
  edited: boolean
  removed: boolean
}

export interface SupplierConnectInput {
  provider_id: number
  group_id: number
  group_name: string
  group_description?: string
  sell_rate: number
  max_rate: number
  models: string[]
}

export interface SupplierConnection {
  provider_id: number
  group_id: number
  account_id: number
  key_id: number
  models: string[]
  phase: string
  input: SupplierConnectInput
}

export interface SupplierRetirement {
  account_id: number
  account_name: string
  provider_id: number
  key_id: number
  key_name: string
  groups: { id: number; name: string; accounts: number; customer_keys: number; can_delete: boolean }[]
  models: string[]
  fingerprint: string
  delete_groups: boolean
  phase: string
}

export async function getSupplierHall(range: SupplierSummaryRange, signal?: AbortSignal) {
  const { data } = await apiClient.get<SupplierHall>('/admin/supplier-hall', { params: { range }, signal })
  return data
}

export async function getSupplierSeries(ids: number[], range: SupplierTrendRange, signal?: AbortSignal) {
  const { data } = await apiClient.get<Record<string, SupplierTrend>>('/admin/supplier-hall/series', {
    params: { range, group_ids: ids.join(',') }, signal
  })
  return data
}

export async function getSupplierRateHistory(id: number, signal?: AbortSignal) {
  const { data } = await apiClient.get<SupplierRateHistory>(`/admin/supplier-hall/providers/${id}/multiplier-history`, { signal })
  return data
}

export async function getSupplierImage(id: number, preview: boolean, version: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<Blob>(`/admin/supplier-hall/providers/${id}/image`, {
    params: { preview, version }, responseType: 'blob', signal
  })
  return data
}
export async function getSupplierReviews(id: number, page: number, signal?: AbortSignal) {
  const { data } = await apiClient.get<{ items: SupplierReview[] | null; total: number }>(
    `/admin/supplier-hall/providers/${id}/reviews`, { params: { page }, signal })
  return data
}

export async function getSupplierConnection(id: number) {
  const { data } = await apiClient.get<SupplierConnection | null>(`/admin/supplier-hall/providers/${id}/connection`)
  return data
}

export async function connectSupplier(input: SupplierConnectInput) {
  const { data } = await apiClient.post<SupplierConnection>('/admin/supplier-hall/connect', input, { timeout: 120_000 })
  return data
}

export async function getRetirement(id: number) {
  const { data } = await apiClient.get<SupplierRetirement>(`/admin/model-health/accounts/${id}/retirement`)
  return data
}

export async function retireSupplier(id: number, plan: SupplierRetirement, deleteGroups: boolean) {
  const { data } = await apiClient.post<SupplierRetirement>(`/admin/model-health/accounts/${id}/retirement`, {
    fingerprint: plan.fingerprint, delete_groups: deleteGroups
  }, { timeout: 120_000 })
  return data
}

export function supplierErrorText(cause: unknown): string | undefined {
  return (cause as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
    || (cause as { message?: string })?.message
}
