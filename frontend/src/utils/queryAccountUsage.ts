import { adminAPI } from '@/api/admin'
import type { AccountListItem } from '@/types'
import type { UsageQueryOutcome } from '@/composables/useAllAccountUsage'
import { cnBalanceCellVisible, cnQuotaCellVisible } from '@/components/account/credentialsBuilder'

export async function queryAccountUsage(account: AccountListItem): Promise<UsageQueryOutcome> {
  const { id, platform, type } = account
  const ollama = account.ollama_cloud_usage
  if (ollama?.eligible) {
    if (!ollama.configured) return { skipped: 'ollamaSessionRequired' }
    const result = await adminAPI.accounts.refreshOllamaCloudUsage(id)
    if (result.snapshot?.status !== 'ok') throw new Error(result.snapshot?.last_error || 'Ollama Cloud usage query failed')
    return {}
  }
  if (cnQuotaCellVisible(account) || cnBalanceCellVisible(account)) {
    const result = cnQuotaCellVisible(account)
      ? await adminAPI.cnProviders.queryQuota(id)
      : await adminAPI.cnProviders.queryBalance(id)
    if (!result.success) throw new Error(result.error || 'Upstream usage query failed')
    if (!result.persisted) throw new Error('Usage was queried but its snapshot could not be saved')
    return {}
  }
  if ((platform === 'openai' && type === 'oauth') ||
      (platform === 'anthropic' && ['oauth', 'setup-token'].includes(type)) ||
      ['gemini', 'antigravity', 'grok'].includes(platform)) {
    const usage = await adminAPI.accounts.getUsage(id, 'active', true)
    if (usage.error || usage.error_code || usage.needs_reauth || usage.is_forbidden) {
      throw new Error(usage.error || usage.error_code || 'Account authorization required')
    }
    return { usage, local: platform === 'gemini' || type === 'setup-token' }
  }
  const stats = await adminAPI.accounts.getBatchTodayStats([id])
  if (!stats.stats || !Object.prototype.hasOwnProperty.call(stats.stats, String(id))) return { skipped: 'unsupported' }
  return { local: true }
}
