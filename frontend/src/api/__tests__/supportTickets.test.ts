import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../client'
import { supportTicketsAPI } from '../supportTickets'

vi.mock('../client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))

describe('support ticket API scopes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} })
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 42 } })
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} })
  })

  it('keeps personal and admin routes separate', async () => {
    await supportTicketsAPI.detail(false, 42)
    await supportTicketsAPI.detail(true, 42)
    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/support-tickets/42')
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/admin/support-tickets/42')
  })

  it('marks only the viewed message watermark', async () => {
    await supportTicketsAPI.markRead(false, 42, 99)
    expect(apiClient.post).toHaveBeenCalledWith('/support-tickets/42/read', { through_id: 99 })
  })

  it('loads attachments through the authenticated client as blobs', async () => {
    await supportTicketsAPI.attachment(true, 42, 9)
    expect(apiClient.get).toHaveBeenCalledWith('/admin/support-tickets/42/attachments/9', { responseType: 'blob' })
  })
})
