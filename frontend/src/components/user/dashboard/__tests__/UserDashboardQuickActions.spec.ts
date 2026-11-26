import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

import UserDashboardQuickActions from '../UserDashboardQuickActions.vue'

const { push, authState, appState } = vi.hoisted(() => ({
  push: vi.fn(),
  authState: { isAdmin: false, isSimpleMode: false },
  appState: { cachedPublicSettings: { affiliate_enabled: false } },
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/stores', () => ({ useAuthStore: () => authState, useAppStore: () => appState }))
vi.mock('@/stores/app', () => ({ useAppStore: () => appState }))
vi.mock('@/composables/useBatchImageAccess', () => ({
  useBatchImageAccess: () => ({ canUseBatchImage: ref(false), refreshBatchImageAccess: vi.fn() }),
}))

const mountActions = () => mount(UserDashboardQuickActions, { global: { stubs: { Icon: true } } })
const actionLabels = (wrapper: ReturnType<typeof mountActions>) => wrapper.findAll('button').map((button) => button.text())

describe('UserDashboardQuickActions', () => {
  beforeEach(() => {
    push.mockReset()
    authState.isAdmin = false
    authState.isSimpleMode = false
    appState.cachedPublicSettings.affiliate_enabled = false
  })

  it('offers the redeem page to regular users', () => {
    const labels = actionLabels(mountActions())

    expect(labels.some((label) => label.includes('dashboard.createApiKey'))).toBe(true)
    expect(labels.some((label) => label.includes('dashboard.viewUsage'))).toBe(true)
    expect(labels.some((label) => label.includes('dashboard.redeemCode'))).toBe(true)
  })

  it('keeps the redeem shortcut for admins', async () => {
    authState.isAdmin = true
    const wrapper = mountActions()
    const redeem = wrapper.findAll('button').find((button) => button.text().includes('dashboard.redeemCode'))

    expect(redeem).toBeDefined()
    await redeem!.trigger('click')
    expect(push).toHaveBeenCalledWith('/redeem')
  })

  it('opens the personal invitation module when enabled', async () => {
    appState.cachedPublicSettings.affiliate_enabled = true
    const wrapper = mountActions()
    await wrapper.get('[data-test="personal-invite-action"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/affiliate')
  })

  it('hides personal invitation when disabled or in simple mode', () => {
    expect(mountActions().find('[data-test="personal-invite-action"]').exists()).toBe(false)
    appState.cachedPublicSettings.affiliate_enabled = true
    authState.isSimpleMode = true
    expect(mountActions().find('[data-test="personal-invite-action"]').exists()).toBe(false)
  })
})
