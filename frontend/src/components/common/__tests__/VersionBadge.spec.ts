import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import VersionBadge from '../VersionBadge.vue'

const stores = vi.hoisted(() => ({
  auth: { isAdmin: true },
  app: {
    currentVersion: '',
    latestVersion: '0.2.8',
    hasUpdate: false,
    versionLoading: false,
    releaseInfo: null,
    buildType: 'source',
    fetchVersion: vi.fn(),
    clearVersionCache: vi.fn()
  }
}))

vi.mock('@/stores', () => ({
  useAuthStore: () => stores.auth,
  useAppStore: () => stores.app
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/api/admin/system', () => ({
  performUpdate: vi.fn(),
  restartService: vi.fn(),
  getRollbackVersions: vi.fn(),
  rollback: vi.fn()
}))
vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copied: false, copyToClipboard: vi.fn() })
}))

enableAutoUnmount(afterEach)

beforeEach(() => {
  vi.clearAllMocks()
  stores.auth = reactive({ isAdmin: true })
  stores.app = reactive({
    currentVersion: '',
    latestVersion: '0.2.8',
    hasUpdate: false,
    versionLoading: false,
    releaseInfo: null,
    buildType: 'source',
    fetchVersion: vi.fn(),
    clearVersionCache: vi.fn()
  })
})

function mountBadge(version?: string) {
  return mount(VersionBadge, { props: { version }, global: { stubs: { Icon: true, transition: true } } })
}

describe('VersionBadge compact display', () => {
  it.each([true, false])('keeps custom builds compact for admin=%s with the full version in its title', (isAdmin) => {
    stores.auth.isAdmin = isAdmin
    const version = '0.2.8-custom-20260923-access-token'
    stores.app.currentVersion = version
    const wrapper = mountBadge(version)
    const badge = wrapper.get(isAdmin ? 'button' : 'span')

    expect(badge.text()).toBe('v0.2.8')
    expect(badge.attributes('title')).toContain(`v${version}`)
    expect(stores.app.currentVersion).toBe(version)
    expect(stores.app.fetchVersion).toHaveBeenCalledTimes(isAdmin ? 1 : 0)
    if (isAdmin) expect(badge.attributes('title')).toContain('version.upToDate')
  })

  it.each([
    ['0.2.8', 'v0.2.8'],
    ['v0.2.8', 'v0.2.8'],
    [' 0.2.8-custom-20260924-version-badge ', 'v0.2.8'],
    ['0.2.8-custom', 'v0.2.8'],
    ['0.2.8-custom.20260924+abcdef', 'v0.2.8'],
    ['0.2.8+abcdef', 'v0.2.8'],
    ['0.2.9-beta.1', 'v0.2.9-beta.1'],
    ['0.2.9-rc.1+abcdef', 'v0.2.9-rc.1'],
    ['0.2.9-customized', 'v0.2.9-customized'],
    ['dev-build-with-an-unusually-long-identifier', 'vdev-build-with-an-unusually-long-identifier']
  ])('formats %s as %s without hiding prerelease versions', (version, expected) => {
    const wrapper = mountBadge(version)
    expect(wrapper.get('button').text()).toBe(expected)
    expect(wrapper.get('button').attributes('title')).toContain(version.trim().replace(/^v?/, 'v'))
  })

  it('constrains long fallback labels without clipping the dropdown container', () => {
    const wrapper = mountBadge('dev-build-with-an-unusually-long-identifier')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['min-w-0', 'max-w-full']))
    expect(wrapper.classes()).not.toContain('overflow-hidden')
    expect(wrapper.get('button').classes()).toEqual(expect.arrayContaining(['min-w-0', 'max-w-full']))
    expect(wrapper.get('button > span').classes()).toEqual(expect.arrayContaining(['min-w-0', 'truncate']))
  })

  it('constrains non-admin labels and follows prop changes instead of the admin cache', async () => {
    stores.auth.isAdmin = false
    stores.app.currentVersion = '0.1.0'
    const wrapper = mountBadge('0.2.8-custom-long-build')
    expect(wrapper.get('span').classes()).toEqual(expect.arrayContaining(['max-w-full', 'truncate']))
    await wrapper.setProps({ version: '0.2.9-rc.1+abcdef' })
    expect(wrapper.get('span').text()).toBe('v0.2.9-rc.1')
    expect(wrapper.get('span').attributes('title')).toBe('v0.2.9-rc.1+abcdef')
  })

  it('shows the full wrapping build identifier inside the existing dropdown', async () => {
    const version = '0.2.8-custom-20260923-access-token'
    const wrapper = mountBadge(version)
    const badge = wrapper.get('button')
    expect(badge.attributes('aria-expanded')).toBe('false')

    await badge.trigger('click')
    expect(badge.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.text-2xl').text()).toBe('v0.2.8')
    const fullBuild = wrapper.findAll('p').find((node) => node.text() === `v${version}`)
    expect(fullBuild).toBeDefined()
    expect(fullBuild!.classes()).toContain('break-all')
    expect(wrapper.get('.absolute.left-0').classes()).toContain('w-64')

    await badge.trigger('click')
    expect(badge.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.absolute.left-0').exists()).toBe(false)
  })

  it('keeps the update indicator visible and the original update state intact', () => {
    stores.app.hasUpdate = true
    stores.app.currentVersion = '0.2.8-custom-20260923-access-token'
    stores.app.latestVersion = '0.2.9'
    const wrapper = mountBadge()
    const badge = wrapper.get('button')
    expect(badge.text()).toBe('v0.2.8')
    expect(badge.attributes('title')).toContain('version.updateAvailable')
    expect(badge.get('.animate-ping').element.parentElement?.classList.contains('shrink-0')).toBe(true)
    expect(stores.app.hasUpdate).toBe(true)
    expect(stores.app.latestVersion).toBe('0.2.9')
  })

  it('uses the existing loading placeholder when a version has not arrived yet', () => {
    const wrapper = mountBadge()
    expect(wrapper.get('button').text()).toBe('')
    expect(wrapper.get('.animate-pulse').exists()).toBe(true)
    expect(wrapper.get('button').attributes('title')).toBe('version.upToDate')
  })

  it('does not show a version badge for a non-admin with no version', () => {
    stores.auth.isAdmin = false
    const wrapper = mountBadge()
    expect(wrapper.find('span').exists()).toBe(false)
  })
})
