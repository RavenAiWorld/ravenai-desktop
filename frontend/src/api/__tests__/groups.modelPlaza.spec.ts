import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../client'
import { saveModelAllowlist, syncUpstreamModels } from '../admin/groups'
import { MODEL_PLAZA_CHANGED } from '@/utils/modelPlazaEvents'

vi.mock('../client', () => ({ apiClient: { put: vi.fn(), post: vi.fn() } }))

const onChange = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  window.addEventListener(MODEL_PLAZA_CHANGED, onChange)
})
afterEach(() => window.removeEventListener(MODEL_PLAZA_CHANGED, onChange))

describe('saved group catalog notifications', () => {
  it('publishes a change after an allowlist save succeeds', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { id: 15 } })
    await saveModelAllowlist(15, { enabled: true, models: ['gpt-6.1-sol'] }, 'revision')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(MODEL_PLAZA_CHANGED)).toBeTruthy()
  })

  it('publishes a change after upstream synchronization succeeds', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { group_id: 15 } })
    await syncUpstreamModels(15)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('does not publish a failed or conflicted save', async () => {
    vi.mocked(apiClient.put).mockRejectedValueOnce({ status: 409 })
    await expect(saveModelAllowlist(15, { enabled: true, models: ['gpt-6.1-sol'] }, 'old')).rejects.toEqual({ status: 409 })
    expect(onChange).not.toHaveBeenCalled()
    expect(localStorage.getItem(MODEL_PLAZA_CHANGED)).toBeNull()
  })
})
