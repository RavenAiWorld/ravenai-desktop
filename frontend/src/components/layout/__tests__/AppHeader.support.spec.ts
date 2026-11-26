import { enableAutoUnmount, mount, RouterLinkStub } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppHeader from '../AppHeader.vue'

const state = vi.hoisted(() => ({
  auth: { user: null as { id: number; role: string; email: string; balance: number } | null, isAdmin: false, isSimpleMode: false },
  badges: { userUnread: 0, adminUnread: 0 },
}))

vi.mock('@/stores', () => ({
  useAuthStore: () => state.auth,
  useAppStore: () => ({ contactInfo: '', docUrl: '', mobileOpen: false }),
  useOnboardingStore: () => ({}),
}))
vi.mock('@/stores/supportTickets', () => ({ useSupportTicketStore: () => state.badges }))
vi.mock('vue-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-router')>(),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/utils/featureFlags', () => ({
  FeatureFlags: { modelPlaza: 'modelPlaza', subscription: 'subscription' },
  isFeatureFlagEnabled: () => false,
}))
vi.mock('@/composables/usePageMeta', () => ({
  usePageMeta: () => ({ pageTitle: 'Dashboard', sectionLabel: 'Personal' }),
}))

enableAutoUnmount(afterEach)
beforeEach(() => {
  state.auth.user = { id: 7, role: 'user', email: 'user@example.test', balance: 10 }
  state.badges.userUnread = 0
  state.badges.adminUnread = 0
})

function render() {
  return mount(AppHeader, {
    global: {
      stubs: { RouterLink: RouterLinkStub, Icon: true, LocaleSwitcher: true, AnnouncementBell: true, SubscriptionProgressMini: true },
    },
  })
}

describe('AppHeader support shortcut', () => {
  it('links authenticated users to their ticket center with an accessible icon label', () => {
    const wrapper = render()
    const link = wrapper.get('[data-testid="support-topbar-link"]')
    expect(link.attributes('title')).toBe('support.title')
    expect(link.attributes('aria-label')).toBe('support.title')
    expect(link.findComponent(RouterLinkStub).props('to')).toBe('/support')
    expect(link.find('icon-stub').attributes('name')).toBe('chatBubble')
    expect(link.find('.ticket-topbar-badge').exists()).toBe(false)
  })

  it('uses the personal unread count, capped at 99+', () => {
    state.badges.userUnread = 123
    state.badges.adminUnread = 4
    expect(render().get('.ticket-topbar-badge').text()).toBe('99+')
  })

  it('does not show a ticket shortcut before login', () => {
    state.auth.user = null
    expect(render().find('[data-testid="support-topbar-link"]').exists()).toBe(false)
  })
})
