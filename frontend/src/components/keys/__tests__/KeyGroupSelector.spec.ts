import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import KeyGroupSelector from '../KeyGroupSelector.vue'
import type { ApiKey, Group } from '@/types'

const { updateKey, showSuccess, showError } = vi.hoisted(() => ({
  updateKey: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn()
}))
vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showSuccess, showError, cachedPublicSettings: { server_utc_offset: '+08:00' }
  })
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const group = (id: number, name = `Group ${id}`, description: string | null = null) =>
  ({ id, name, description, platform: 'openai', status: 'active', subscription_type: 'standard' }) as Group
const key = (overrides: Partial<ApiKey> = {}) => ({
  id: 1, name: 'My key', group_id: 3, group: group(3), quota: 20, quota_used: 11,
  rate_limit_5h: 2, status: 'active', ...overrides
}) as ApiKey
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}

const wrappers: VueWrapper[] = []
const mountSelector = (
  apiKey = key(),
  groups = [group(3), group(8, 'ALL')],
  userGroupRates: Record<number, number> = {}
) => {
  const wrapper = mount(KeyGroupSelector, {
    attachTo: document.body,
    props: {
      apiKey,
      groups,
      userGroupRates,
      saveGroup: (keyId: number, groupId: number) => updateKey(keyId, { group_id: groupId })
    },
    global: {
      stubs: {
        Icon: { template: '<span />' },
        PlatformIcon: true
      }
    }
  })
  wrappers.push(wrapper)
  return wrapper
}
const trigger = (wrapper: VueWrapper) => wrapper.get('[data-test="key-inline-group-trigger"]')
const menu = () => {
  const element = document.querySelector<HTMLElement>('[data-test="key-inline-group-menu"]')
  if (!element) throw new Error('Group menu is not open')
  return new DOMWrapper(element)
}
const option = (id: number | 'none') => menu().get<HTMLButtonElement>(`[data-test="key-inline-group-option-${id}"]`)
const open = async (wrapper: VueWrapper) => {
  await trigger(wrapper).trigger('click')
  await nextTick()
}
const press = async (key: string, extra: KeyboardEventInit = {}) => {
  document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {
    key, bubbles: true, cancelable: true, ...extra
  }))
  await nextTick()
}

beforeEach(() => {
  updateKey.mockReset()
  showSuccess.mockReset()
  showError.mockReset()
  vi.stubGlobal('innerWidth', 1280)
  vi.stubGlobal('innerHeight', 800)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('KeyGroupSelector', () => {
  it('marks a maintained current group, skips it and restores it when maintenance ends', async () => {
    const maintained = { ...group(3), status: 'maintenance' as const }
    const wrapper = mountSelector(key(), [maintained, group(8)])
    expect(trigger(wrapper).text()).toContain('common.groupMaintenance')
    await open(wrapper)
    expect(option(3).text()).toContain('common.groupMaintenance')
    expect(option(3).element.disabled).toBe(true)
    await option(3).trigger('click')
    expect(updateKey).not.toHaveBeenCalled()
    expect(option(8).element.disabled).toBe(false)
    await wrapper.setProps({ groups: [{ ...maintained, status: 'active' }, group(8)] })
    expect(trigger(wrapper).text()).not.toContain('common.groupMaintenance')
    expect(option(3).element.disabled).toBe(false)
  })

  it('shows each real group multiplier in the current badge and native options', async () => {
    const current = { ...group(3), rate_multiplier: 0.2 }
    const other = { ...group(8, 'ALL'), rate_multiplier: 1.5 }
    const wrapper = mountSelector(key({ group: current }), [current, other])

    expect(trigger(wrapper).text()).toContain('0.2x')
    await open(wrapper)
    expect(option(3).text()).toContain('0.2x')
    expect(option(8).text()).toContain('1.5x')
    expect(updateKey).not.toHaveBeenCalled()
  })

  it.each([0, 0.15])('shows an absolute custom multiplier of %s without multiplying the base', async (rate) => {
    const current = { ...group(3), rate_multiplier: 0.2 }
    const wrapper = mountSelector(key({ group: current }), [current], { 3: rate })

    expect(trigger(wrapper).get('.line-through').text()).toBe('0.2x')
    expect(trigger(wrapper).text()).toContain(`${rate}x`)
    await open(wrapper)
    expect(option(3).get('.line-through').text()).toBe('0.2x')
    expect(option(3).text()).toContain(`${rate}x`)
    expect(updateKey).not.toHaveBeenCalled()
  })

  it('shows a subscription multiplier instead of replacing it with the subscription label', async () => {
    const current = {
      ...group(3), rate_multiplier: 0.3, subscription_type: 'subscription' as const
    }
    const wrapper = mountSelector(key({ group: current }), [current])

    expect(trigger(wrapper).text()).toContain('0.3x')
    expect(trigger(wrapper).text()).not.toContain('groups.subscription')
    await open(wrapper)
    expect(option(3).text()).toContain('0.3x')
  })

  it('preserves the native peak-rate window and server timezone in both surfaces', async () => {
    const current = {
      ...group(3), rate_multiplier: 0.2, subscription_type: 'subscription' as const,
      peak_rate_enabled: true, peak_start: '18:00', peak_end: '22:00', peak_rate_multiplier: 1.5
    }
    const wrapper = mountSelector(key({ group: current }), [current])

    expect(trigger(wrapper).text()).toContain('18:00-22:00')
    expect(trigger(wrapper).text()).toContain('1.5')
    expect(trigger(wrapper).text()).toContain('UTC+08:00')
    await open(wrapper)
    expect(option(3).text()).toContain('18:00-22:00')
    expect(option(3).text()).toContain('UTC+08:00')
  })

  it('does not invent a multiplier when the group response has none', async () => {
    const wrapper = mountSelector()

    expect(trigger(wrapper).text()).not.toMatch(/\d+(?:\.\d+)?x/)
    await open(wrapper)
    expect(option(3).text()).not.toMatch(/\d+(?:\.\d+)?x/)
  })

  it('updates the displayed rate when custom rates arrive or the selected group changes', async () => {
    const first = { ...group(3), rate_multiplier: 0.2 }
    const second = { ...group(8, 'ALL'), rate_multiplier: 0.5 }
    const wrapper = mountSelector(key({ group: first }), [first, second])

    expect(trigger(wrapper).text()).toContain('0.2x')
    await wrapper.setProps({ userGroupRates: { 3: 0.1, 8: 0 } })
    expect(trigger(wrapper).text()).toContain('0.1x')
    await wrapper.setProps({ apiKey: key({ group_id: 8, group: second }) })
    expect(trigger(wrapper).text()).toContain('0x')
    expect(trigger(wrapper).text()).not.toContain('0.1x')
    await open(wrapper)
    expect(option(8).text()).toContain('0x')
  })

  it('opens one searchable, teleported menu directly from the group badge', async () => {
    const wrapper = mountSelector()
    expect(trigger(wrapper).text()).toBe('Group 3')
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false')
    await open(wrapper)

    expect(wrapper.find('[data-test="key-inline-group-menu"]').exists()).toBe(false)
    expect(menu().findAll('[role="option"]')).toHaveLength(2)
    expect(document.activeElement).toBe(menu().get('input').element)
    expect(option(3).attributes('aria-selected')).toBe('true')
    expect(updateKey).not.toHaveBeenCalled()
  })

  it.each([null, 99])('preserves unavailable current group %s as a disabled option', async (groupId) => {
    const wrapper = mountSelector(key({
      group_id: groupId, group: groupId === null ? undefined : group(99, 'Existing group')
    }))
    await open(wrapper)
    const unavailable = option(groupId ?? 'none')
    expect(unavailable.attributes('disabled')).toBeDefined()
    expect(unavailable.attributes('aria-selected')).toBe('true')
    await unavailable.trigger('click')
    expect(updateKey).not.toHaveBeenCalled()

    updateKey.mockResolvedValue(key({ group_id: 8, group: group(8) }))
    await option(8).trigger('click')
    await flushPromises()
    expect(updateKey).toHaveBeenCalledOnce()
    expect(updateKey).toHaveBeenCalledWith(1, { group_id: 8 })
  })

  it('does not offer an unrelated group or send a patch when no authorized groups exist', async () => {
    const wrapper = mountSelector(key({ group_id: 99, group: group(99, 'Old group') }), [])
    await open(wrapper)
    expect(menu().findAll('[role="option"]')).toHaveLength(1)
    expect(option(99).attributes('disabled')).toBeDefined()
    await press('Enter')
    expect(updateKey).not.toHaveBeenCalled()
    expect(wrapper.emitted('updated')).toBeUndefined()
  })

  it('filters by name or description without exposing groups outside the available list', async () => {
    const wrapper = mountSelector(key(), [group(3), group(8, 'ALL', 'Shared routing')])
    await open(wrapper)
    await menu().get('input').setValue('routing')
    expect(menu().findAll('[role="option"]')).toHaveLength(1)
    expect(option(8).text()).toContain('ALL')
    await menu().get('input').setValue('unavailable')
    expect(menu().text()).toContain('keys.noGroupFound')
    expect(menu().findAll('[role="option"]')).toHaveLength(0)
  })

  it('treats the current authorized group as a no-op and restores trigger focus', async () => {
    const wrapper = mountSelector()
    await open(wrapper)
    await option(3).trigger('click')
    await flushPromises()

    expect(updateKey).not.toHaveBeenCalled()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger(wrapper).element)
  })

  it('sends only group_id, prevents duplicate submissions, and emits the server response', async () => {
    const pending = deferred<ApiKey>()
    const original = key()
    const updated = key({ group_id: 8, group: group(8, 'Server group'), updated_at: '2026-10-23' })
    updateKey.mockReturnValue(pending.promise)
    const wrapper = mountSelector(original)
    await open(wrapper)
    await option(8).trigger('click')

    expect(trigger(wrapper).attributes('aria-disabled')).toBe('true')
    expect(trigger(wrapper).attributes('aria-busy')).toBe('true')
    expect(menu().findAll('button[role="option"]:disabled')).toHaveLength(2)
    await option(8).trigger('click')
    await press('Enter')
    expect(updateKey).toHaveBeenCalledOnce()
    expect(updateKey).toHaveBeenCalledWith(1, { group_id: 8 })
    expect(original).toMatchObject({ group_id: 3, quota: 20, quota_used: 11, rate_limit_5h: 2, status: 'active' })
    expect(wrapper.emitted('updated')).toBeUndefined()

    pending.resolve(updated)
    await flushPromises()
    expect(wrapper.emitted('updated')).toEqual([[updated]])
    expect(showSuccess).toHaveBeenCalledWith('keys.groupChangedSuccess')
    expect(trigger(wrapper).attributes('aria-disabled')).toBe('false')
    expect(document.querySelector('[data-test="key-inline-group-menu"]')).toBeNull()
    expect(document.activeElement).toBe(trigger(wrapper).element)
  })

  it.each([undefined, 'Subscription expired'])('keeps the original group and menu after failure (%s), then allows retry', async (detail) => {
    const pending = deferred<ApiKey>()
    updateKey.mockReturnValueOnce(pending.promise)
    const wrapper = mountSelector()
    await open(wrapper)
    await option(8).trigger('click')
    pending.reject(detail ? { response: { data: { detail } } } : new Error('Network unavailable'))
    await flushPromises()

    expect(wrapper.props('apiKey').group_id).toBe(3)
    expect(wrapper.emitted('updated')).toBeUndefined()
    expect(option(3).attributes('aria-selected')).toBe('true')
    expect(showError).toHaveBeenCalledWith(detail ?? 'keys.failedToChangeGroup')
    expect(document.activeElement).toBe(menu().get('input').element)
    updateKey.mockResolvedValueOnce(key({ group_id: 8, group: group(8) }))
    await option(8).trigger('click')
    await flushPromises()
    expect(updateKey).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('updated')).toHaveLength(1)
  })

  it.each(['Escape', 'Cancel', 'outside', 'Tab'])('cancels with %s without changing the key', async (action) => {
    const wrapper = mountSelector()
    await open(wrapper)
    if (action === 'Cancel') {
      await menu().get('[data-test="key-inline-group-cancel"]').trigger('click')
    } else if (action === 'outside') {
      document.body.click()
      await nextTick()
    } else {
      await press(action)
    }

    expect(document.querySelector('[data-test="key-inline-group-menu"]')).toBeNull()
    expect(updateKey).not.toHaveBeenCalled()
    if (action === 'Cancel' || action === 'Escape') {
      expect(document.activeElement).toBe(trigger(wrapper).element)
    }
  })

  it('moves focus from a mouse-selected option to search during saving so Escape can dismiss the menu', async () => {
    const pending = deferred<ApiKey>()
    updateKey.mockReturnValue(pending.promise)
    const wrapper = mountSelector()
    await open(wrapper)
    const selectedOption = option(8)
    selectedOption.element.focus()
    expect(document.activeElement).toBe(selectedOption.element)
    await selectedOption.trigger('click')
    const input = menu().get('input')
    expect(input.attributes('readonly')).toBeDefined()
    expect(input.attributes('disabled')).toBeUndefined()
    expect(document.activeElement).toBe(input.element)
    await press('Escape')
    expect(document.querySelector('[data-test="key-inline-group-menu"]')).toBeNull()
    expect(document.activeElement).toBe(trigger(wrapper).element)
    expect(updateKey).toHaveBeenCalledOnce()
    pending.resolve(key({ group_id: 8, group: group(8) }))
    await flushPromises()
  })

  it.each([false, true])('anchors pending Tab navigation without losing document focus (shift=%s)', async (shiftKey) => {
    const pending = deferred<ApiKey>()
    updateKey.mockReturnValue(pending.promise)
    const wrapper = mountSelector()
    await open(wrapper)
    const selectedOption = option(8)
    selectedOption.element.focus()
    await selectedOption.trigger('click')
    expect(document.activeElement).toBe(menu().get('input').element)
    expect(trigger(wrapper).attributes('disabled')).toBeUndefined()
    expect(trigger(wrapper).attributes('aria-disabled')).toBe('true')
    await press('Tab', { shiftKey })

    expect(document.querySelector('[data-test="key-inline-group-menu"]')).toBeNull()
    expect(document.activeElement).toBe(trigger(wrapper).element)
    expect(document.activeElement).not.toBe(document.body)
    await trigger(wrapper).trigger('click')
    await press('ArrowDown')
    await press('Enter')
    expect(document.querySelector('[data-test="key-inline-group-menu"]')).toBeNull()
    expect(updateKey).toHaveBeenCalledOnce()
    pending.resolve(key({ group_id: 8, group: group(8) }))
    await flushPromises()
  })

  it('opens with the keyboard, skips the unavailable group, and selects using arrows and Enter', async () => {
    updateKey.mockResolvedValue(key({ group_id: 8, group: group(8) }))
    const wrapper = mountSelector(key({ group_id: 99, group: group(99) }))
    trigger(wrapper).element.focus()
    await press('ArrowDown')
    expect(document.activeElement).toBe(menu().get('input').element)
    await press('ArrowDown')
    await press('Enter')
    await flushPromises()
    expect(updateKey).toHaveBeenCalledOnce()
    expect(updateKey).toHaveBeenCalledWith(1, { group_id: 8 })
  })

  it('does not submit Enter or close Escape while an IME composition is active', async () => {
    const wrapper = mountSelector()
    await open(wrapper)
    await press('ArrowDown')
    await press('Enter', { isComposing: true })
    await press('Escape', { isComposing: true })
    expect(updateKey).not.toHaveBeenCalled()
    expect(document.querySelector('[data-test="key-inline-group-menu"]')).not.toBeNull()
  })

  it('does not close another key menu when a pending request completes', async () => {
    const first = deferred<ApiKey>()
    updateKey.mockReturnValueOnce(first.promise)
    const one = mountSelector()
    const two = mountSelector(key({ id: 2, name: 'Second key' }))
    await open(one)
    await option(8).trigger('click')
    await open(two)
    expect(document.querySelectorAll('[data-test="key-inline-group-menu"]')).toHaveLength(1)

    first.resolve(key({ group_id: 8, group: group(8) }))
    await flushPromises()
    expect(one.emitted('updated')).toHaveLength(1)
    expect(two.emitted('updated')).toBeUndefined()
    expect(trigger(two).attributes('aria-expanded')).toBe('true')
    expect(menu().get('[role="listbox"]').attributes('id')).toBe('key-group-menu-2')
    expect(document.activeElement).toBe(menu().get('input').element)
  })

  it('ignores a completion after the component switches to a different key', async () => {
    const pending = deferred<ApiKey>()
    updateKey.mockReturnValue(pending.promise)
    const wrapper = mountSelector()
    await open(wrapper)
    await option(8).trigger('click')
    await wrapper.setProps({ apiKey: key({ id: 2, name: 'Second key' }) })
    await open(wrapper)
    pending.resolve(key({ group_id: 8, group: group(8) }))
    await flushPromises()
    expect(wrapper.emitted('updated')).toBeUndefined()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('true')
  })

  it('ignores a pending result after unmount', async () => {
    const pending = deferred<ApiKey>()
    updateKey.mockReturnValue(pending.promise)
    const wrapper = mountSelector()
    await open(wrapper)
    await option(8).trigger('click')
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    pending.resolve(key({ group_id: 8, group: group(8) }))
    await flushPromises()
    expect(wrapper.emitted('updated')).toBeUndefined()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()
  })

  it.each([
    { width: 1280, height: 800, rect: { left: 1200, top: 700, bottom: 728 }, left: 888, bottom: '104px' },
    { width: 360, height: 640, rect: { left: 300, top: 100, bottom: 128 }, left: 8, top: '132px' },
    { width: 320, height: 240, rect: { left: 200, top: 100, bottom: 128 }, left: 8, top: '132px' }
  ])('keeps the menu within a $width x $height viewport', async ({ width, height, rect, left, top, bottom }) => {
    vi.stubGlobal('innerWidth', width)
    vi.stubGlobal('innerHeight', height)
    const wrapper = mountSelector()
    vi.spyOn(trigger(wrapper).element, 'getBoundingClientRect')
      .mockReturnValue({ ...rect, width: 100, height: 28, right: rect.left + 100 } as DOMRect)
    await open(wrapper)
    const element = menu().element as HTMLElement
    expect(element.style.left).toBe(`${left}px`)
    expect(parseFloat(element.style.width) + left).toBeLessThanOrEqual(width - 8)
    expect(parseFloat(element.style.maxHeight)).toBeLessThanOrEqual(height - 16)
    if (top) expect(element.style.top).toBe(top)
    if (bottom) expect(element.style.bottom).toBe(bottom)
  })

  it('repositions on scroll and resize and removes listeners after unmount', async () => {
    const wrapper = mountSelector()
    const rect = { left: 120, top: 100, bottom: 128, right: 220, width: 100, height: 28 }
    const getRect = vi.spyOn(trigger(wrapper).element, 'getBoundingClientRect')
      .mockImplementation(() => rect as DOMRect)
    const remove = vi.spyOn(window, 'removeEventListener')
    await open(wrapper)
    expect((menu().element as HTMLElement).style.left).toBe('120px')
    rect.left = 50
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect((menu().element as HTMLElement).style.left).toBe('50px')
    vi.stubGlobal('innerWidth', 360)
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect((menu().element as HTMLElement).style.left).toBe('8px')
    expect(getRect).toHaveBeenCalledTimes(3)
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true })
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('filters bound keys strictly by true platform (OpenAI vs Anthropic and DeepSeek vs Kimi)', async () => {
    const openAI1 = { ...group(3, 'Claude-Named-OpenAI'), platform: 'openai' as const }
    const openAI2 = { ...group(8, 'OpenAI Pro'), platform: 'openai' as const }
    const anthropic = { ...group(10, 'Claude Official'), platform: 'anthropic' as const }
    const deepseek1 = { ...group(20, 'DeepSeek V3'), platform: 'deepseek' as const }
    const deepseek2 = { ...group(21, 'DeepSeek R1'), platform: 'deepseek' as const }
    const kimi = { ...group(22, 'Kimi K2'), platform: 'kimi' as const }
    const allGroups = [openAI1, openAI2, anthropic, deepseek1, deepseek2, kimi]

    // OpenAI key sees only OpenAI groups
    const openAIWrapper = mountSelector(key({ group_id: 3, group: openAI1 }), allGroups)
    await open(openAIWrapper)
    expect(menu().findAll('[role="option"]').map((el) => el.attributes('data-test')))
      .toEqual(['key-inline-group-option-3', 'key-inline-group-option-8'])
    openAIWrapper.unmount()
    wrappers.splice(wrappers.indexOf(openAIWrapper), 1)

    // DeepSeek key sees only DeepSeek groups, never Kimi (even though both are domestic)
    const deepseekWrapper = mountSelector(key({ id: 2, group_id: 20, group: deepseek1 }), allGroups)
    await open(deepseekWrapper)
    expect(menu().findAll('[role="option"]').map((el) => el.attributes('data-test')))
      .toEqual(['key-inline-group-option-20', 'key-inline-group-option-21'])
  })

  it('allows an unbound key to choose any authorized platform on first bind', async () => {
    const openAI = { ...group(3, 'OpenAI'), platform: 'openai' as const }
    const anthropic = { ...group(10, 'Anthropic'), platform: 'anthropic' as const }
    const kimi = { ...group(22, 'Kimi'), platform: 'kimi' as const }
    const wrapper = mountSelector(key({ group_id: null, group: undefined }), [openAI, anthropic, kimi])
    await open(wrapper)
    expect(menu().findAll('[role="option"]').map((el) => el.attributes('data-test')))
      .toEqual([
        'key-inline-group-option-none',
        'key-inline-group-option-3',
        'key-inline-group-option-10',
        'key-inline-group-option-22'
      ])
    expect(option('none').element.disabled).toBe(true)
    updateKey.mockResolvedValueOnce(key({ group_id: 22, group: kimi }))
    await option(22).trigger('click')
    await flushPromises()
    expect(updateKey).toHaveBeenCalledWith(1, { group_id: 22 })
  })

  it('shows only the current disabled choice when the bound platform cannot be resolved', async () => {
    const wrapper = mountSelector(key({ group_id: 99, group: undefined }))
    await open(wrapper)
    expect(menu().findAll('[role="option"]').map((el) => el.attributes('data-test')))
      .toEqual(['key-inline-group-option-99'])
    expect(option(99).element.disabled).toBe(true)
    await press('Enter')
    expect(updateKey).not.toHaveBeenCalled()
  })

  it('shows backend structured error message and keeps original group on rejection', async () => {
    updateKey.mockRejectedValueOnce({ status: 400, message: 'cannot switch API key to a group on a different platform' })
    const wrapper = mountSelector()
    await open(wrapper)
    await option(8).trigger('click')
    await flushPromises()
    expect(showError).toHaveBeenCalledWith('cannot switch API key to a group on a different platform')
    expect(wrapper.props('apiKey').group_id).toBe(3)
    expect(option(3).attributes('aria-selected')).toBe('true')
  })
})
