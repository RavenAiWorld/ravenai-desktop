import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountListItem } from '@/types'
import { adminAPI } from '@/api/admin'
import { queryAccountUsage } from '../queryAccountUsage'

vi.mock('@/api/admin', () => ({ adminAPI: {
  accounts: { getUsage: vi.fn(), getBatchTodayStats: vi.fn(), refreshOllamaCloudUsage: vi.fn(), resetOpenAIQuota: vi.fn(), resetQuota: vi.fn() },
  cnProviders: { queryQuota: vi.fn(), queryBalance: vi.fn() }
} }))

const account = (platform: string, type = 'oauth', extra = {}) => ({ id: 7, name: 'account', platform, type, ...extra }) as AccountListItem

describe('account usage query dispatch', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it.each(['openai', 'anthropic', 'antigravity', 'grok'])('uses the active query for %s', async platform => {
    vi.mocked(adminAPI.accounts.getUsage).mockResolvedValue({ error: '' } as never)
    await queryAccountUsage(account(platform))
    expect(adminAPI.accounts.getUsage).toHaveBeenCalledWith(7, 'active', true)
    expect(adminAPI.accounts.resetOpenAIQuota).not.toHaveBeenCalled()
    expect(adminAPI.accounts.resetQuota).not.toHaveBeenCalled()
  })

  it('queries CN coding quota and PAYG balance', async () => {
    vi.mocked(adminAPI.cnProviders.queryQuota).mockResolvedValue({ success: true, persisted: true } as never)
    vi.mocked(adminAPI.cnProviders.queryBalance).mockResolvedValue({ success: true, persisted: true } as never)
    await queryAccountUsage(account('kimi', 'apikey', { credentials: { account_mode: 'coding' } }))
    await queryAccountUsage(account('deepseek', 'apikey'))
    expect(adminAPI.cnProviders.queryQuota).toHaveBeenCalledWith(7)
    expect(adminAPI.cnProviders.queryBalance).toHaveBeenCalledWith(7)
  })

  it('reports provider failures even when HTTP succeeds', async () => {
    vi.mocked(adminAPI.cnProviders.queryBalance).mockResolvedValue({ success: false, error: 'unauthorized' } as never)
    await expect(queryAccountUsage(account('deepseek', 'apikey'))).rejects.toThrow('unauthorized')
    vi.mocked(adminAPI.accounts.getUsage).mockResolvedValue({ error: 'stale quota' } as never)
    await expect(queryAccountUsage(account('anthropic'))).rejects.toThrow('stale quota')
  })

  it.each(['command_code', 'cline'])('refreshes official %s subscription and credits together', async platform => {
    vi.mocked(adminAPI.cnProviders.queryQuota).mockResolvedValue({ success: true, persisted: true } as never)
    await queryAccountUsage(account(platform, 'apikey'))
    expect(adminAPI.cnProviders.queryQuota).toHaveBeenCalledWith(7)
    expect(adminAPI.cnProviders.queryBalance).not.toHaveBeenCalled()
  })

  it.each(['command_code', 'cline'])('uses local statistics for custom %s endpoints', async platform => {
    vi.mocked(adminAPI.accounts.getBatchTodayStats).mockResolvedValue({ stats: { '7': {} } } as never)
    expect(await queryAccountUsage(account(platform, 'apikey', {
      credentials: { base_url: 'https://relay.example.test/v1' }
    }))).toEqual({ local: true })
    expect(adminAPI.cnProviders.queryQuota).not.toHaveBeenCalled()
    expect(adminAPI.cnProviders.queryBalance).not.toHaveBeenCalled()
  })

  it('skips unconfigured Ollama and validates refresh results', async () => {
    expect(await queryAccountUsage(account('openai', 'apikey', { ollama_cloud_usage: { eligible: true, configured: false } }))).toEqual({ skipped: 'ollamaSessionRequired' })
    expect(adminAPI.accounts.refreshOllamaCloudUsage).not.toHaveBeenCalled()
    vi.mocked(adminAPI.accounts.refreshOllamaCloudUsage).mockResolvedValue({ snapshot: { status: 'failed', last_error: 'session expired' } } as never)
    await expect(queryAccountUsage(account('openai', 'apikey', { ollama_cloud_usage: { eligible: true, configured: true } }))).rejects.toThrow('session expired')
  })

  it('labels ordinary API key statistics and Gemini estimates as local', async () => {
    vi.mocked(adminAPI.accounts.getBatchTodayStats).mockResolvedValue({ stats: { '7': {} } } as never)
    expect(await queryAccountUsage(account('openai', 'apikey'))).toEqual({ local: true })
    vi.mocked(adminAPI.accounts.getUsage).mockResolvedValue({} as never)
    expect((await queryAccountUsage(account('gemini'))).local).toBe(true)
  })
})
