import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { AccountListItem } from '@/types'
import { useAllAccountUsage } from '../useAllAccountUsage'

const account = (id: number) => ({ id, name: `Account ${id}`, platform: 'openai', type: 'oauth' }) as AccountListItem

describe('query all account usage', () => {
  it('queries every page with stable IDs and no current filters', async () => {
    const list = vi.fn().mockImplementation(async (page: number) => ({
      items: page === 1 ? Array.from({ length: 1000 }, (_, i) => account(i + 1)) : [account(1001)],
      total: 1001, pages: 2
    }))
    const query = vi.fn().mockResolvedValue({})
    const state = useAllAccountUsage({ list, query })
    await state.run()
    expect(list).toHaveBeenNthCalledWith(2, 2, 1000, { lite: '1', include_scheduler_score: '0', sort_by: 'id', sort_order: 'asc' })
    expect(query).toHaveBeenCalledTimes(1001)
    expect(state.counts.value).toMatchObject({ total: 1001, completed: 1001, success: 1001 })
  })

  it('continues after failures, counts skipped rows and retries only failures', async () => {
    const list = vi.fn().mockResolvedValue({ items: [account(1), account(2), account(3)], total: 3 })
    const query = vi.fn().mockImplementation(async (a: AccountListItem) => {
      if (a.id === 2) throw { message: 'upstream 503' }
      return a.id === 3 ? { skipped: 'unsupported' } : { local: true }
    })
    const state = useAllAccountUsage({ list, query })
    await state.run()
    expect(state.counts.value).toMatchObject({ success: 1, failed: 1, skipped: 1 })
    expect(state.rows.value[1].message).toBe('upstream 503')
    query.mockClear().mockResolvedValue({})
    await state.run(true)
    expect(list).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledOnce()
    expect(query.mock.calls[0][0].id).toBe(2)
    expect(state.counts.value.failed).toBe(0)
  })

  it('limits active requests, rejects duplicate starts, and stops queued work', async () => {
    const list = vi.fn().mockResolvedValue({ items: Array.from({ length: 8 }, (_, i) => account(i)), total: 8 })
    const releases: Array<() => void> = []
    const query = vi.fn().mockImplementation(() => new Promise(resolve => releases.push(() => resolve({}))))
    const state = useAllAccountUsage({ list, query })
    const done = state.run()
    await flushPromises()
    expect(query).toHaveBeenCalledTimes(3)
    await state.run()
    expect(list).toHaveBeenCalledOnce()
    state.stop()
    releases.forEach(release => release())
    await done
    expect(query).toHaveBeenCalledTimes(3)
    expect(state.counts.value).toMatchObject({ success: 3, cancelled: 5, completed: 8 })
    expect(state.running.value).toBe(false)
  })

  it('does not start queries if an account page fails or the scan is incomplete', async () => {
    const list = vi.fn().mockResolvedValueOnce({ items: [account(1)], total: 1001, pages: 2 }).mockRejectedValueOnce(new Error('page failed'))
    const query = vi.fn()
    const state = useAllAccountUsage({ list, query })
    await state.run()
    expect(state.error.value).toBe('page failed')
    expect(query).not.toHaveBeenCalled()
    list.mockReset().mockResolvedValue({ items: [account(1), account(1)], total: 2 })
    await state.run()
    expect(state.error.value).toContain('incomplete')
    expect(query).not.toHaveBeenCalled()
  })

  it('stopping during enumeration sends no usage requests', async () => {
    let release!: (value: { items: AccountListItem[]; total: number }) => void
    const list = vi.fn().mockImplementation(() => new Promise(resolve => { release = resolve }))
    const query = vi.fn()
    const state = useAllAccountUsage({ list, query })
    const done = state.run()
    state.stop()
    release({ items: [account(1)], total: 1 })
    await done
    expect(query).not.toHaveBeenCalled()
    expect(state.running.value).toBe(false)
  })
})
