export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface User {
  id: number
  username: string
  email: string
  balance: number
  frozen_balance?: number
  concurrency: number
  status: string
  role: string
  created_at: string
}

export interface CustomEndpoint {
  name: string
  endpoint: string
  description?: string
}

export interface Settings {
  site_name?: string
  api_base_url?: string
  custom_endpoints?: CustomEndpoint[]
  model_plaza_enabled?: boolean
  payment_enabled?: boolean
  registration_enabled?: boolean
  [key: string]: unknown
}

export interface ClientState {
  version: string
  authenticated: boolean
  user: User | null
  server: string
  verify_studio?: boolean
}

export interface Group {
  id: number
  name: string
  platform: string
  status: string
  rate_multiplier: number
  subscription_type: string
  description?: string
  is_exclusive?: boolean
}

export interface ApiKey {
  id: number
  key: string
  name: string
  group_id: number | null
  status: string
  quota: number
  quota_used: number
  expires_at: string | null
  last_used_at: string | null
  created_at: string
  ip_whitelist: string[]
  ip_blacklist: string[]
  rate_limit_5h: number
  rate_limit_1d: number
  rate_limit_7d: number
  usage_5h?: number
  usage_1d?: number
  usage_7d?: number
  reset_5h_at?: string | null
  reset_1d_at?: string | null
  reset_7d_at?: string | null
  group?: Group
}

export interface Usage {
  id: number
  request_id: string
  model: string
  created_at: string
  input_tokens: number
  output_tokens: number
  cache_creation_tokens: number
  cache_read_tokens: number
  actual_cost: number
  total_cost: number
  duration_ms: number | null
  first_token_ms: number | null
  rate_multiplier: number
  billing_mode?: string
  billing_type?: number
  stream?: boolean
  request_type?: string
  service_tier?: string
  reasoning_effort?: string
  api_key?: ApiKey
  group?: Group
  error_message?: string
  status_code?: number
  category?: string
  [key: string]: unknown
}

export interface UsageStats {
  total_requests: number
  total_input_tokens?: number
  total_output_tokens?: number
  total_cache_tokens?: number
  total_cache_read_tokens?: number
  total_cache_creation_tokens?: number
  total_tokens: number
  total_cost: number
  total_actual_cost: number
  average_duration_ms: number
}

export interface PlatformDashboardStats {
  platform: string
  total_requests: number
  total_tokens: number
  total_actual_cost: number
  today_requests: number
  today_tokens: number
  today_actual_cost: number
}

export interface Stats {
  total_api_keys: number
  active_api_keys: number
  total_requests: number
  total_input_tokens?: number
  total_output_tokens?: number
  total_cache_creation_tokens?: number
  total_cache_read_tokens?: number
  total_tokens: number
  total_cost?: number
  total_actual_cost: number
  today_requests: number
  today_input_tokens?: number
  today_output_tokens?: number
  today_cache_creation_tokens?: number
  today_cache_read_tokens?: number
  today_tokens: number
  today_cost?: number
  today_actual_cost: number
  average_duration_ms: number
  rpm: number
  tpm?: number
  by_platform?: PlatformDashboardStats[]
}

export interface PlatformQuotaItem {
  platform: string
  daily_limit_usd?: number | null
  daily_usage_usd?: number | null
  daily_window_resets_at?: string | null
  weekly_limit_usd?: number | null
  weekly_usage_usd?: number | null
  weekly_window_resets_at?: string | null
  monthly_limit_usd?: number | null
  monthly_usage_usd?: number | null
  monthly_window_resets_at?: string | null
}

export interface ModelStat {
  model: string
  requests: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost: number
  actual_cost: number
}

export interface Trend {
  date: string
  requests: number
  actual_cost: number
  total_cost: number
  total_tokens?: number
  [key: string]: unknown
}

export interface Order {
  id: number
  out_trade_no: string
  amount: number
  pay_amount: number
  currency: string
  status: string
  payment_type: string
  created_at: string
  order_type: string
}

export interface Ticket {
  id: number
  title: string
  category: string
  priority: string
  status: string
  request_id: string
  unread: boolean
  last_message_id: number
  last_message_preview: string
  created_at: string
  updated_at: string
}

export interface TicketDetail {
  ticket: Ticket
  messages: {
    id: number
    author_role: string
    kind: string
    content: string
    created_at: string
    attachments: { id: number; name: string }[]
  }[]
}

export interface TicketSummary {
  unread_count?: number
  open_count?: number
  waiting_count?: number
}

export interface Announcement {
  id: number
  title: string
  content: string
  status?: string
  created_at: string
  updated_at?: string
  read_at?: string | null
  is_read?: boolean
}
