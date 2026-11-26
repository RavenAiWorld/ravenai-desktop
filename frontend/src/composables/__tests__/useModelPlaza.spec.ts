import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, reactive } from 'vue'
import { getModelPlaza, type ModelPlazaResponse } from '@/api/modelPlaza'
import { MODEL_PLAZA_REFRESH_MS, useModelPlaza } from '../useModelPlaza'
import { MODEL_PLAZA_CHANGED, notifyModelPlazaChanged } from '@/utils/modelPlazaEvents'

vi.mock('@/api/modelPlaza', () => ({ getModelPlaza: vi.fn() }))
const session = reactive({ isAuthenticated: false, user: null as { id: number } | null })
vi.mock('@/stores/auth', () => ({ useAuthStore: () => session }))

const snapshot = (description: string): ModelPlazaResponse => ({ description, groups: [] })
let wrapper: VueWrapper | undefined
let state: ReturnType<typeof useModelPlaza>

function start() {
  wrapper = mount(defineComponent({
    setup() { state = useModelPlaza(); return () => null }
  }))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(getModelPlaza).mockReset().mockResolvedValue(snapshot('initial'))
  session.isAuthenticated = false
  session.user = null
  localStorage.clear()
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('live model plaza', () => {
  it('loads immediately, then refreshes a visible page without showing a loading screen', async () => {
    start()
    await flushPromises()
    expect(state.data.value).toEqual(snapshot('initial'))
    vi.mocked(getModelPlaza).mockResolvedValueOnce(snapshot('saved group'))
    await vi.advanceTimersByTimeAsync(MODEL_PLAZA_REFRESH_MS)
    expect(getModelPlaza).toHaveBeenCalledTimes(2)
    expect(state.data.value).toEqual(snapshot('saved group'))
    expect(state.loading.value).toBe(false)
  })

  it('refreshes immediately on a successful save and a cross-tab notification', async () => {
    start()
    await flushPromises()
    notifyModelPlazaChanged()
    await flushPromises()
    expect(getModelPlaza).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem(MODEL_PLAZA_CHANGED)).toBeTruthy()
    window.dispatchEvent(new StorageEvent('storage', { key: MODEL_PLAZA_CHANGED, newValue: 'next' }))
    await flushPromises()
    expect(getModelPlaza).toHaveBeenCalledTimes(3)
  })

  it('ignores an older in-flight response after the group was changed', async () => {
    let finishOld!: (value: ModelPlazaResponse) => void
    vi.mocked(getModelPlaza).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    start()
    const signal = vi.mocked(getModelPlaza).mock.calls[0][0]!.signal!
    vi.mocked(getModelPlaza).mockResolvedValueOnce(snapshot('new selection'))
    notifyModelPlazaChanged()
    await flushPromises()
    expect(signal.aborted).toBe(true)
    finishOld(snapshot('removed models'))
    await flushPromises()
    expect(state.data.value).toEqual(snapshot('new selection'))
  })

  it('pauses hidden pages and refreshes when returning to the page', async () => {
    start()
    await flushPromises()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    await vi.advanceTimersByTimeAsync(2 * MODEL_PLAZA_REFRESH_MS)
    notifyModelPlazaChanged()
    expect(getModelPlaza).toHaveBeenCalledTimes(1)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(getModelPlaza).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(getModelPlaza).toHaveBeenCalledTimes(3)
  })

  it('does not overlap polling requests and retains the last snapshot on transient failure', async () => {
    start()
    await flushPromises()
    let reject!: (reason: Error) => void
    vi.mocked(getModelPlaza).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
    await vi.advanceTimersByTimeAsync(3 * MODEL_PLAZA_REFRESH_MS)
    expect(getModelPlaza).toHaveBeenCalledTimes(2)
    expect(state.loading.value).toBe(false)
    reject(new Error('offline'))
    await flushPromises()
    expect(state.data.value).toEqual(snapshot('initial'))
    expect(state.loadFailed.value).toBe(true)
    await vi.advanceTimersByTimeAsync(MODEL_PLAZA_REFRESH_MS)
    expect(state.loadFailed.value).toBe(false)
  })

  it.each([401, 403, 404])('drops stale visible groups on HTTP %i', async status => {
    start()
    await flushPromises()
    vi.mocked(getModelPlaza).mockRejectedValueOnce({ status })
    await state.load()
    expect(state.data.value).toBeNull()
    expect(state.fetchedAt.value).toBeNull()
    expect(state.loadFailed.value).toBe(true)
  })

  it('clears private data before reloading a changed identity', async () => {
    start()
    await flushPromises()
    vi.mocked(getModelPlaza).mockImplementationOnce(() => new Promise(() => {}))
    session.isAuthenticated = true
    session.user = { id: 2 }
    await flushPromises()
    expect(state.data.value).toBeNull()
    expect(state.fetchedAt.value).toBeNull()
    expect(getModelPlaza).toHaveBeenCalledTimes(2)
  })

  it('cleans up timers, listeners and pending requests on unmount', async () => {
    vi.mocked(getModelPlaza).mockImplementationOnce(() => new Promise(() => {}))
    start()
    const signal = vi.mocked(getModelPlaza).mock.calls[0][0]!.signal!
    wrapper!.unmount()
    wrapper = undefined
    expect(signal.aborted).toBe(true)
    notifyModelPlazaChanged()
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new StorageEvent('storage', { key: MODEL_PLAZA_CHANGED }))
    await vi.advanceTimersByTimeAsync(2 * MODEL_PLAZA_REFRESH_MS)
    expect(getModelPlaza).toHaveBeenCalledTimes(1)
  })
})
