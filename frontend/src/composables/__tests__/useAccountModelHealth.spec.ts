import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useAccountModelHealth } from '../useAccountModelHealth'

const { getControls } = vi.hoisted(() => ({ getControls: vi.fn() }))
vi.mock('@/api/admin/modelHealth', () => ({ getAccountModelHealthControls: getControls }))
const control = (enabled: boolean) => ({ 'gpt-6.1-sol': { enabled, model: 'gpt-6.1-sol', rule_id: 'sol' } })

describe('account model health synchronization', () => {
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('updates an open modal, clears removed rules and stops polling when closed', async () => {
    vi.useFakeTimers()
    const account = ref({ id: 140, platform: 'openai', type: 'apikey', extra: { model_health_routes: control(false) } })
    const visible = ref(true)
    getControls.mockResolvedValue(control(true))
    let state!: ReturnType<typeof useAccountModelHealth>
    const wrapper = mount(defineComponent({ setup() { state = useAccountModelHealth(() => account.value, () => visible.value); return () => null } }))
    expect(state.controls.value['gpt-6.1-sol']?.enabled).toBe(false)
    await flushPromises()
    expect(state.controls.value['gpt-6.1-sol']?.enabled).toBe(true)
    getControls.mockResolvedValue(control(false))
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.controls.value['gpt-6.1-sol']?.enabled).toBe(false)
    getControls.mockResolvedValue({})
    await vi.advanceTimersByTimeAsync(5000)
    expect(state.controls.value).toEqual({})
    visible.value = false
    await flushPromises()
    const calls = getControls.mock.calls.length
    await vi.advanceTimersByTimeAsync(10000)
    expect(getControls).toHaveBeenCalledTimes(calls)
    expect(account.value.extra.model_health_routes).toEqual(control(false))
    wrapper.unmount()
  })

  it('ignores a stale response after switching to another account', async () => {
    vi.useFakeTimers()
    let resolve!: (value: unknown) => void
    getControls.mockImplementationOnce(() => new Promise(done => { resolve = done })).mockResolvedValue(control(false))
    const account = ref({ id: 140, platform: 'openai', type: 'apikey' })
    let state!: ReturnType<typeof useAccountModelHealth>
    const wrapper = mount(defineComponent({ setup() { state = useAccountModelHealth(() => account.value, () => true); return () => null } }))
    account.value = { id: 139, platform: 'openai', type: 'apikey' }
    await flushPromises()
    resolve(control(true))
    await flushPromises()
    expect(state.controls.value).toEqual(control(false))
    wrapper.unmount()
  })

  it('retains the last state with a refresh warning on failure', async () => {
    getControls.mockRejectedValue(new Error('offline'))
    let state!: ReturnType<typeof useAccountModelHealth>
    const wrapper = mount(defineComponent({ setup() { state = useAccountModelHealth(() => ({ id: 140, platform: 'openai', type: 'apikey', extra: { model_health_routes: control(true) } }), () => true); return () => null } }))
    await flushPromises()
    expect(state.controls.value).toEqual(control(true))
    expect(state.refreshFailed.value).toBe(true)
    wrapper.unmount()
  })
})
