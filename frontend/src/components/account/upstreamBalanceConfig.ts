export interface UpstreamBalanceConfig {
  provider: '' | 'newapi'
  accessToken: string
  userId: string
  quotaPerUnit: number | null
  currency: '' | 'USD' | 'CNY' | 'quota'
}

export const readUpstreamBalanceConfig = (credentials?: Record<string, unknown>): UpstreamBalanceConfig => ({
  provider: credentials?.upstream_balance_provider === 'newapi' ? 'newapi' : '',
  accessToken: '',
  userId: typeof credentials?.upstream_balance_user_id === 'string' || typeof credentials?.upstream_balance_user_id === 'number'
    ? String(credentials.upstream_balance_user_id) : '',
  quotaPerUnit: typeof credentials?.upstream_balance_quota_per_unit === 'number'
    ? credentials.upstream_balance_quota_per_unit : null,
  currency: ['USD', 'CNY', 'quota'].includes(String(credentials?.upstream_balance_currency))
    ? credentials!.upstream_balance_currency as UpstreamBalanceConfig['currency'] : ''
})

export const upstreamBalanceConfigError = (config: UpstreamBalanceConfig): string | null => {
  if (config.provider !== 'newapi') return null
  if (config.userId.trim() && (!/^[1-9]\d*$/.test(config.userId.trim()) || !Number.isSafeInteger(Number(config.userId)))) {
    return 'invalid_user_id'
  }
  if (config.quotaPerUnit != null && (!Number.isFinite(config.quotaPerUnit) || config.quotaPerUnit <= 0 || config.quotaPerUnit > 1e15)) {
    return 'invalid_quota_unit'
  }
  return null
}

export const applyUpstreamBalanceCredentials = (
  credentials: Record<string, unknown>,
  config: UpstreamBalanceConfig,
  hasStoredToken = false
) => {
  const wasConfigured = credentials.upstream_balance_provider === 'newapi'
  delete credentials.upstream_balance_provider
  delete credentials.upstream_balance_user_id
  delete credentials.upstream_balance_quota_per_unit
  delete credentials.upstream_balance_currency
  delete credentials.upstream_balance_access_token
  if (config.provider !== 'newapi') {
    if (wasConfigured || hasStoredToken) credentials.upstream_balance_access_token = ''
    return
  }
  credentials.upstream_balance_provider = 'newapi'
  if (config.accessToken.trim()) credentials.upstream_balance_access_token = config.accessToken.trim()
  if (config.userId.trim()) credentials.upstream_balance_user_id = config.userId.trim()
  if (config.quotaPerUnit != null) credentials.upstream_balance_quota_per_unit = config.quotaPerUnit
  if (config.currency) credentials.upstream_balance_currency = config.currency
}
