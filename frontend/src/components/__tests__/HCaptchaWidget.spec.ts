import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import HCaptchaWidget from '../HCaptchaWidget.vue'
import type { HCaptchaRenderOptions } from '@/utils/hcaptcha'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
const wrappers: VueWrapper[] = []
const widgetStubs = { 'i18n-t': { template: '<p><slot name="privacy" /><slot name="terms" /></p>' } }

function installSDK() {
  const render = vi.fn((_element: HTMLElement, _options: HCaptchaRenderOptions) => 'widget-1')
  window.hcaptcha = { render, reset: vi.fn(), remove: vi.fn(), execute: vi.fn() }
  return render
}

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  delete window.hcaptcha
  delete window.onSub2HCaptchaLoad
  document.querySelectorAll('script[data-sub2-hcaptcha]').forEach(script => script.remove())
  vi.restoreAllMocks()
})

describe('HCaptchaWidget', () => {
  function actionWidget() {
    const wrapper = mount(HCaptchaWidget, {
      props: { siteKey: 'site-key', action: true },
      global: { stubs: widgetStubs }
    })
    wrappers.push(wrapper)
    return wrapper as typeof wrapper & { vm: { verify: () => Promise<string | null>; reset: () => void } }
  }

  it('waits for submit before rendering and executing an invisible challenge', async () => {
    const render = installSDK()
    const wrapper = actionWidget()
    await flushPromises()
    expect(render).not.toHaveBeenCalled()
    expect(window.hcaptcha!.execute).not.toHaveBeenCalled()
    expect(wrapper.classes()).not.toContain('min-h-[78px]')

    const proof = wrapper.vm.verify()
    expect(wrapper.vm.verify()).toBe(proof)
    await flushPromises()
    expect(render).toHaveBeenCalledOnce()
    expect(render.mock.calls[0]![1].size).toBe('invisible')
    expect(window.hcaptcha!.execute).toHaveBeenCalledOnce()
    render.mock.calls[0]![1].callback('submit-proof')
    await expect(proof).resolves.toBe('submit-proof')
    expect(wrapper.emitted('verify')).toEqual([['submit-proof']])
  })

  it('cancels without an error when closed, and allows a fresh attempt', async () => {
    const render = installSDK()
    const wrapper = actionWidget()
    const proof = wrapper.vm.verify()
    await flushPromises()
    render.mock.calls[0]![1]['close-callback']!()
    await expect(proof).resolves.toBeNull()
    expect(wrapper.emitted('error')).toBeUndefined()
    wrapper.vm.reset()
    const retry = wrapper.vm.verify()
    await flushPromises()
    render.mock.calls[1]![1].callback('retry-proof')
    await expect(retry).resolves.toBe('retry-proof')
    expect(window.hcaptcha!.execute).toHaveBeenCalledTimes(2)
  })

  it.each(['error-callback', 'expired-callback', 'chalexpired-callback'] as const)(
    'settles an action when %s occurs',
    async (callback) => {
      const render = installSDK()
      const wrapper = actionWidget()
      const proof = wrapper.vm.verify()
      await flushPromises()
      render.mock.calls[0]![1][callback]()
      await expect(proof).resolves.toBeNull()
    }
  )

  it('cancels pending execution when navigation occurs before SDK loading finishes', async () => {
    const wrapper = actionWidget()
    const proof = wrapper.vm.verify()
    wrapper.unmount()
    await expect(proof).resolves.toBeNull()
    const render = installSDK()
    window.onSub2HCaptchaLoad?.()
    await flushPromises()
    expect(render).not.toHaveBeenCalled()
    expect(window.hcaptcha!.execute).not.toHaveBeenCalled()
  })

  it('ignores results from a removed action widget after its sitekey changes', async () => {
    const render = installSDK()
    const wrapper = actionWidget()
    const proof = wrapper.vm.verify()
    await flushPromises()
    const oldCallbacks = render.mock.calls[0]![1]
    await wrapper.setProps({ siteKey: 'new-site-key' })
    await expect(proof).resolves.toBeNull()
    oldCallbacks.callback('obsolete-proof')
    expect(wrapper.emitted('verify')).toBeUndefined()
  })

  it('ignores late results from a reset challenge while another attempt is pending', async () => {
    const render = installSDK()
    const wrapper = actionWidget()
    const first = wrapper.vm.verify()
    await flushPromises()
    const oldCallbacks = render.mock.calls[0]![1]
    wrapper.vm.reset()
    await expect(first).resolves.toBeNull()

    const retry = wrapper.vm.verify()
    await flushPromises()
    oldCallbacks.callback('obsolete-proof')
    oldCallbacks['close-callback']!()
    expect(wrapper.emitted('verify')).toBeUndefined()
    render.mock.calls[1]![1].callback('fresh-proof')
    await expect(retry).resolves.toBe('fresh-proof')
    expect(wrapper.emitted('verify')).toEqual([['fresh-proof']])
  })

  it('shares SDK loading between widgets and removes only its own instance on navigation', async () => {
    wrappers.push(mount(HCaptchaWidget, { props: { siteKey: 'site-a' }, global: { stubs: widgetStubs } }))
    wrappers.push(mount(HCaptchaWidget, { props: { siteKey: 'site-b' }, global: { stubs: widgetStubs } }))
    expect(document.querySelectorAll('script[data-sub2-hcaptcha]')).toHaveLength(1)
    const render = installSDK()
    window.onSub2HCaptchaLoad?.()
    await flushPromises()
    expect(render).toHaveBeenCalledTimes(2)
    expect(wrappers[0]!.find('[role="status"]').exists()).toBe(false)
    wrappers.shift()!.unmount()
    expect(window.hcaptcha!.remove).toHaveBeenCalledWith('widget-1')
  })

  it('forwards proof, expiry and error, and resets consumed tokens', async () => {
    const render = installSDK()
    const wrapper = mount(HCaptchaWidget, { props: { siteKey: 'site-key' }, global: { stubs: widgetStubs } })
    wrappers.push(wrapper)
    await flushPromises()
    const callbacks = render.mock.calls[0]![1]
    callbacks.callback('proof')
    callbacks['expired-callback']()
    callbacks['error-callback']()
    expect(wrapper.emitted('verify')).toEqual([['proof']])
    expect(wrapper.emitted('expire')).toEqual([[]])
    expect(wrapper.emitted('error')).toEqual([[]])
    ;(wrapper.vm as unknown as { reset: () => void }).reset()
    expect(window.hcaptcha!.reset).toHaveBeenCalledWith('widget-1')
  })

  it('reports SDK failures and allows a later widget to retry', async () => {
    wrappers.push(mount(HCaptchaWidget, { props: { siteKey: 'site-key' }, global: { stubs: widgetStubs } }))
    document.querySelector('script[data-sub2-hcaptcha]')!.dispatchEvent(new Event('error'))
    await flushPromises()
    expect(wrappers[0]!.emitted('error')).toEqual([[]])
    expect(wrappers[0]!.find('[role="status"]').exists()).toBe(false)
    wrappers.push(mount(HCaptchaWidget, { props: { siteKey: 'site-key' }, global: { stubs: widgetStubs } }))
    expect(document.querySelectorAll('script[data-sub2-hcaptcha]')).toHaveLength(1)
    installSDK()
    window.onSub2HCaptchaLoad?.()
    await flushPromises()
  })

  it('does not render after an SDK finishes loading on a page that was left', async () => {
    const wrapper = mount(HCaptchaWidget, { props: { siteKey: 'site-key' }, global: { stubs: widgetStubs } })
    wrapper.unmount()
    const render = installSDK()
    window.onSub2HCaptchaLoad?.()
    await flushPromises()
    expect(render).not.toHaveBeenCalled()
  })
})
