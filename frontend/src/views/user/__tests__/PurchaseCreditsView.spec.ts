import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { reactive } from 'vue'
import PurchaseCreditsView from '../PurchaseCreditsView.vue'

const mocks = vi.hoisted(() => ({
  openPopup: vi.fn(),
  fetchPublicSettings: vi.fn(),
  store: null as null | {
    publicSettingsLoaded: boolean
    cachedPublicSettings: {
      purchase_subscription_enabled: boolean
      purchase_subscription_url: string
    } | null
    fetchPublicSettings: ReturnType<typeof vi.fn>
  },
}))

vi.mock('@/stores/app', () => ({ useAppStore: () => mocks.store! }))
vi.mock('@/components/layout/AppLayout.vue', () => ({
  default: { template: '<main><slot /></main>' },
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 7, balance: 12.5 }, token: 'private-account-token' }),
}))
vi.mock('@/utils/creditShop', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/utils/creditShop')>(),
  openCreditShopPopup: mocks.openPopup,
}))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))

const wrappers: ReturnType<typeof mount>[] = []
const settings = () => ({
  purchase_subscription_enabled: true,
  purchase_subscription_url: 'https://wzyp.cn/shop/ravenai',
})

function mountPage() {
  const wrapper = mount(PurchaseCreditsView, {
    global: { stubs: {
      AppLayout: { template: '<main><slot /></main>' },
      Icon: true,
      RouterLink: RouterLinkStub,
    } },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('PurchaseCreditsView popup', () => {
  beforeEach(() => {
    mocks.fetchPublicSettings.mockReset()
    mocks.openPopup.mockReset().mockReturnValue(true)
    mocks.store = reactive({
      publicSettingsLoaded: true,
      cachedPublicSettings: settings(),
      fetchPublicSettings: mocks.fetchPublicSettings,
    })
  })

  afterEach(() => {
    wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('never embeds or automatically opens the store', () => {
    const wrapper = mountPage()
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('$12.50')
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toBe('/redeem')
    expect(mocks.openPopup).not.toHaveBeenCalled()
    expect(mocks.fetchPublicSettings).not.toHaveBeenCalled()
  })

  it('opens the configured store only in response to the purchase button', async () => {
    const wrapper = mountPage()
    await wrapper.get('[data-test="open-credit-shop"]').trigger('click')
    expect(mocks.openPopup).toHaveBeenCalledWith('https://wzyp.cn/shop/ravenai')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('offers a normal link after popup blocking and clears the warning on retry', async () => {
    mocks.openPopup.mockReturnValueOnce(false).mockReturnValueOnce(true)
    const wrapper = mountPage()
    await wrapper.get('[data-test="open-credit-shop"]').trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toBe('creditPurchase.popupBlocked')
    const fallback = wrapper.get('a[target="_blank"]')
    expect(fallback.attributes('href')).toBe('https://wzyp.cn/shop/ravenai')
    expect(fallback.attributes('rel')).toBe('noopener noreferrer')
    expect(fallback.attributes('referrerpolicy')).toBe('no-referrer')
    await wrapper.get('[data-test="open-credit-shop"]').trigger('click')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('a[target="_blank"]').exists()).toBe(false)
  })

  it.each(['disabled', 'empty', 'unsafe', 'missing'])('does not open a %s shop', (mode) => {
    if (mode === 'missing') mocks.store!.cachedPublicSettings = null
    else if (mode === 'disabled') mocks.store!.cachedPublicSettings!.purchase_subscription_enabled = false
    else mocks.store!.cachedPublicSettings!.purchase_subscription_url = mode === 'empty' ? '' : 'javascript:alert(1)'
    const wrapper = mountPage()
    expect(wrapper.find('[data-test="open-credit-shop"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('creditPurchase.unavailable')
  })

  it('loads missing settings and retries a failed settings request in place', async () => {
    mocks.store!.publicSettingsLoaded = false
    mocks.store!.cachedPublicSettings = null
    mocks.fetchPublicSettings.mockResolvedValueOnce(null).mockImplementationOnce(async () => {
      mocks.store!.cachedPublicSettings = settings()
      mocks.store!.publicSettingsLoaded = true
      return mocks.store!.cachedPublicSettings
    })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('creditPurchase.loadFailed')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(mocks.fetchPublicSettings).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-test="open-credit-shop"]').exists()).toBe(true)
    expect(wrapper.find('iframe').exists()).toBe(false)
  })
})
