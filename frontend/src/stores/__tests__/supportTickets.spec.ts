import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useSupportTicketStore } from '../supportTickets'
import { useAuthStore } from '../auth'
import type { TicketSummary } from '@/api/supportTickets'

const summary = vi.hoisted(() => vi.fn())
vi.mock('@/api/supportTickets', () => ({ supportTicketsAPI: { summary } }))
vi.mock('../auth', async () => {
  const { defineStore } = await import('pinia')
  const { ref } = await import('vue')
  return {
    useAuthStore: defineStore('auth', () => ({
      user: ref<{ id: number } | null>({ id: 7 }),
      isAdmin: ref(false),
      isAuthenticated: ref(true),
    })),
  }
})

const counts = (unread: number): TicketSummary => ({ total: unread, open: unread, waiting: 0, resolved: 0, closed: 0, unread })
function pendingSummary() {
  let resolve!: (value: TicketSummary) => void
  const promise = new Promise<TicketSummary>(done => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})
afterEach(() => vi.restoreAllMocks())

describe('support ticket badges', () => {
  it('loads only personal counts for users and throttles repeated refreshes', async () => {
    summary.mockResolvedValue(counts(3))
    const store = useSupportTicketStore()
    await store.refresh()
    await store.refresh()
    expect(summary).toHaveBeenCalledTimes(1)
    expect(store.userUnread).toBe(3)
    expect(store.adminUnread).toBe(0)
  })

  it('loads the administrator inbox separately', async () => {
    const auth = useAuthStore()
    auth.isAdmin = true
    summary.mockImplementation((admin?: boolean) => Promise.resolve(counts(admin ? 5 : 2)))
    const store = useSupportTicketStore()
    await store.refresh()
    expect(store.userUnread).toBe(2)
    expect(store.adminUnread).toBe(5)
  })

  it('queues a forced read-state refresh while an earlier request is pending', async () => {
    const first = pendingSummary()
    const second = pendingSummary()
    summary.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const store = useSupportTicketStore()
    const initial = store.refresh()
    void store.refresh(true)
    first.resolve(counts(3))
    await initial
    expect(summary).toHaveBeenCalledTimes(2)
    second.resolve(counts(0))
    await store.refresh()
    expect(store.userUnread).toBe(0)
  })

  it('does not restore old-user counts after switching accounts', async () => {
    const old = pendingSummary()
    summary.mockReturnValueOnce(old.promise).mockResolvedValue(counts(1))
    const store = useSupportTicketStore()
    const initial = store.refresh()
    const auth = useAuthStore()
    auth.user = { id: 8 } as typeof auth.user
    await nextTick()
    await store.refresh()
    old.resolve(counts(9))
    await initial
    expect(store.userUnread).toBe(1)
  })

  it('skips requests when logged out or when the page is hidden', async () => {
    const auth = useAuthStore()
    const store = useSupportTicketStore()
    auth.isAuthenticated = false
    await store.refresh(true)
    auth.isAuthenticated = true
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    await store.refresh(true)
    expect(summary).not.toHaveBeenCalled()
  })
})
