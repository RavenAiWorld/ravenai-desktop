/**
 * Admin Usage API endpoints
 * Handles admin-level usage logs and statistics retrieval
 */

import { apiClient } from '../client'
import type { AdminUsageLog, UsageQueryParams, PaginatedResponse, UsageRequestType } from '@/types'
import type { EndpointStat } from '@/types'

// ==================== Types ====================

export interface AdminUsageStatsResponse {
  total_requests: number
  total_input_tokens: number
  total_output_tokens: number
  total_cache_tokens: number
  total_cache_creation_tokens: number
  total_cache_read_tokens: number
  total_tokens: number
  total_cost: number
  total_actual_cost: number
  total_account_cost: number
  average_duration_ms: number
  endpoints?: EndpointStat[]
  upstream_endpoints?: EndpointStat[]
  endpoint_paths?: EndpointStat[]
}

export interface SimpleUser {
  id: number
  email: string
  deleted: boolean
}

export interface SimpleApiKey {
  id: number
  name: string
  user_id: number
}

export interface UsageCleanupFilters {
  start_time: string
  end_time: string
  user_id?: number
  api_key_id?: number
  account_id?: number
  group_id?: number
  model?: string | null
  request_type?: UsageRequestType | null
  stream?: boolean | null
  billing_type?: number | null
}

export interface UsageCleanupTask {
  id: number
  status: string
  filters: UsageCleanupFilters
  created_by: number
  deleted_rows: number
  error_message?: string | null
  canceled_by?: number | null
  canceled_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  created_at: string
  updated_at: string
}

export interface CreateUsageCleanupTaskRequest {
  start_date: string
  end_date: string
  user_id?: number
  api_key_id?: number
  account_id?: number
  group_id?: number
  model?: string | null
  request_type?: UsageRequestType | null
  stream?: boolean | null
  billing_type?: number | null
  timezone?: string
}

export interface AdminUsageQueryParams extends UsageQueryParams {
  user_id?: number
  exact_total?: boolean
  billing_mode?: string
  upstream_model_mismatch?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  // 错误请求 tab 专属筛选(仅传给错误列表接口;共用同一 filters 对象)
  error_phase?: string | null
  error_category?: string | null
  status_code?: number | null
}

export type ImageGenerationSource = 'image_studio' | 'nova_studio' | 'external_api' | 'historical_unknown'

export interface ImageGenerationRecord {
  id: number
  request_id: string
  user_id: number
  api_key_id: number
  group_id: number
  account_id?: number
  model: string
  source: ImageGenerationSource
  endpoint: string
  status: 'success' | 'failed'
  requested_images: number
  actual_images: number
  reference_count: number
  requested_size?: string
  quality?: string
  total_cost: number
  actual_cost: number
  http_status: number
  duration_ms: number
  user_email?: string
  user_name?: string
  api_key_name?: string
  group_name?: string
  account_name?: string
  created_at: string
  completed_at: string
}

export interface ImageGenerationRecordQuery {
  page: number
  page_size: number
  user_id?: number
  group_id?: number
  source?: ImageGenerationSource
  status?: 'success' | 'failed'
  search?: string
  start_date?: string
  end_date?: string
  timezone?: string
}

export async function listImageRecords(
  params: ImageGenerationRecordQuery,
  options?: { signal?: AbortSignal }
): Promise<PaginatedResponse<ImageGenerationRecord>> {
  const { data } = await apiClient.get<PaginatedResponse<ImageGenerationRecord>>('/admin/usage/image-records', {
    params,
    signal: options?.signal
  })
  return data
}

export interface BalanceBillingDailyPoint {
  date: string
  total_cost: number
  requests: number
  users: number
  input_tokens: number
  output_tokens: number
  cache_tokens: number
  total_tokens: number
}

export interface BalanceBillingHourlyPoint {
  hour: number
  total_cost: number
  requests: number
  total_tokens: number
}

export interface BalanceBillingUserRow {
  user_id: number
  username: string
  email: string
  total_cost: number
  requests: number
  input_tokens: number
  output_tokens: number
  cache_tokens: number
  total_tokens: number
  last_at: string
}

export interface BalanceBillingModelRow {
  model: string
  total_cost: number
  requests: number
  users: number
  input_tokens: number
  output_tokens: number
  cache_tokens: number
  total_tokens: number
}

export interface BalanceBillingModelUserRow {
  model: string
  user_id: number
  username: string
  email: string
  total_cost: number
  requests: number
  input_tokens: number
  output_tokens: number
  cache_tokens: number
  total_tokens: number
  last_at: string
}

export interface BalanceBillingReport {
  timezone: string
  start_date: string
  end_date: string
  billing_start_date: string
  today_date: string
  today_total: number
  yesterday_total: number
  period_total: number
  today_users: number
  today_requests: number
  today_tokens: number
  period_users: number
  period_requests: number
  period_input_tokens: number
  period_output_tokens: number
  period_cache_tokens: number
  period_tokens: number
  daily: BalanceBillingDailyPoint[]
  hourly: BalanceBillingHourlyPoint[]
  users: BalanceBillingUserRow[]
  today_ranking: BalanceBillingUserRow[]
  models: BalanceBillingModelRow[]
  model_users: BalanceBillingModelUserRow[]
  generated_at: string
}

// ==================== API Functions ====================

/**
 * List all usage logs with optional filters (admin only)
 * @param params - Query parameters for filtering and pagination
 * @returns Paginated list of usage logs
 */
export async function list(
  params: AdminUsageQueryParams,
  options?: { signal?: AbortSignal }
): Promise<PaginatedResponse<AdminUsageLog>> {
  const { data } = await apiClient.get<PaginatedResponse<AdminUsageLog>>('/admin/usage', {
    params,
    signal: options?.signal
  })
  return data
}

/**
 * Get usage statistics with optional filters (admin only)
 * @param params - Query parameters for filtering
 * @returns Usage statistics
 */
export async function getStats(params: {
  user_id?: number
  api_key_id?: number
  account_id?: number
  group_id?: number
  model?: string
  request_type?: UsageRequestType
  stream?: boolean
  native_compaction_v2?: boolean | null
  upstream_model_mismatch?: boolean
  period?: string
  start_date?: string
  end_date?: string
  timezone?: string
  nocache?: number
}): Promise<AdminUsageStatsResponse> {
  const { data } = await apiClient.get<AdminUsageStatsResponse>('/admin/usage/stats', {
    params
  })
  return data
}

export async function getBalanceBillingReport(
  params: { days?: number; timezone?: string; start_date?: string; end_date?: string; nocache?: boolean },
  options?: { signal?: AbortSignal }
): Promise<BalanceBillingReport> {
  const { data } = await apiClient.get<BalanceBillingReport>('/admin/usage/balance-billing-report', {
    params,
    signal: options?.signal
  })
  return data
}

/**
 * Search users by email keyword (admin only)
 * @param keyword - Email keyword to search
 * @returns List of matching users (max 30)
 */
export async function searchUsers(keyword: string): Promise<SimpleUser[]> {
  const { data } = await apiClient.get<SimpleUser[]>('/admin/usage/search-users', {
    params: { q: keyword }
  })
  return data
}

/**
 * Search API keys by user ID and/or keyword (admin only)
 * @param userId - Optional user ID to filter by
 * @param keyword - Optional keyword to search in key name
 * @returns List of matching API keys (max 30)
 */
export async function searchApiKeys(userId?: number, keyword?: string): Promise<SimpleApiKey[]> {
  const params: Record<string, unknown> = {}
  if (userId !== undefined) {
    params.user_id = userId
  }
  if (keyword) {
    params.q = keyword
  }
  const { data } = await apiClient.get<SimpleApiKey[]>('/admin/usage/search-api-keys', {
    params
  })
  return data
}

/**
 * List usage cleanup tasks (admin only)
 * @param params - Query parameters for pagination
 * @returns Paginated list of cleanup tasks
 */
export async function listCleanupTasks(
  params: { page?: number; page_size?: number },
  options?: { signal?: AbortSignal }
): Promise<PaginatedResponse<UsageCleanupTask>> {
  const { data } = await apiClient.get<PaginatedResponse<UsageCleanupTask>>('/admin/usage/cleanup-tasks', {
    params,
    signal: options?.signal
  })
  return data
}

/**
 * Create a usage cleanup task (admin only)
 * @param payload - Cleanup task parameters
 * @returns Created cleanup task
 */
export async function createCleanupTask(payload: CreateUsageCleanupTaskRequest): Promise<UsageCleanupTask> {
  const { data } = await apiClient.post<UsageCleanupTask>('/admin/usage/cleanup-tasks', payload)
  return data
}

/**
 * Cancel a usage cleanup task (admin only)
 * @param taskId - Task ID to cancel
 */
export async function cancelCleanupTask(taskId: number): Promise<{ id: number; status: string }> {
  const { data } = await apiClient.post<{ id: number; status: string }>(
    `/admin/usage/cleanup-tasks/${taskId}/cancel`
  )
  return data
}

export const adminUsageAPI = {
  list,
  getStats,
  getBalanceBillingReport,
  searchUsers,
  searchApiKeys,
  listCleanupTasks,
  createCleanupTask,
  cancelCleanupTask
}

export default adminUsageAPI
