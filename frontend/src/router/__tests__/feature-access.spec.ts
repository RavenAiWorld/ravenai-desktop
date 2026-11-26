import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter } from 'vue-router'

type NavigationGuard = (
  to: Record<string, any>,
  from: Record<string, any>,
  next: ReturnType<typeof vi.fn>
) => Promise<void>

const routerHarness = vi.hoisted(() => ({
  guard: null as NavigationGuard | null,
  routes: [] as Array<{ path: string; meta?: Record<string, unknown> }>,
}))

const authStore = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  isAuthenticated: true,
  isAdmin: false,
  isSimpleMode: false,
  hasPendingAuthSession: false,
}))

const appStore = vi.hoisted(() => ({
  siteName: 'Sub2API',
  backendModeEnabled: false,
  publicSettingsLoaded: false,
  cachedPublicSettings: null as null | {
    payment_enabled?: boolean
    subscription_enabled?: boolean
    custom_menu_items?: []
  },
  fetchPublicSettings: vi.fn(),
}))

vi.mock('vue-router', () => ({
  createWebHistory: vi.fn(() => ({})),
  createRouter: vi.fn((options) => {
    routerHarness.routes = options.routes
    return {
    beforeEach: vi.fn((guard: NavigationGuard) => {
      routerHarness.guard = guard
    }),
    afterEach: vi.fn(),
    onError: vi.fn(),
    }
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStore,
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => appStore,
}))

vi.mock('@/stores/adminSettings', () => ({
  useAdminSettingsStore: () => ({ customMenuItems: [] }),
}))

vi.mock('@/stores/adminCompliance', () => ({
  useAdminComplianceStore: () => ({
    initialized: true,
    fetchStatus: vi.fn(),
    requireAcknowledgement: vi.fn(),
  }),
}))

vi.mock('@/composables/useNavigationLoading', () => ({
  useNavigationLoadingState: () => ({
    startNavigation: vi.fn(),
    endNavigation: vi.fn(),
    isLoading: { value: false },
  }),
}))

vi.mock('@/composables/useRoutePrefetch', () => ({
  useRoutePrefetch: () => ({
    triggerPrefetch: vi.fn(),
    cancelPendingPrefetch: vi.fn(),
    resetPrefetchState: vi.fn(),
  }),
}))

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function runGuard(meta: Record<string, unknown>, path: string) {
  if (!routerHarness.guard) {
    throw new Error('router guard was not registered')
  }

  const next = vi.fn()
  const navigation = routerHarness.guard(
    {
      path,
      fullPath: path,
      name: 'FeatureRoute',
      params: {},
      meta: { requiresAuth: true, ...meta },
    },
    {},
    next
  )
  return { navigation, next }
}

describe('feature route guard', () => {
  beforeAll(async () => {
    await import('@/router')
  })

  beforeEach(() => {
    authStore.isAuthenticated = true
    authStore.isAdmin = false
    authStore.isSimpleMode = false
    appStore.publicSettingsLoaded = false
    appStore.cachedPublicSettings = null
    appStore.fetchPublicSettings.mockReset()
  })

  it('does not register retired audit routes', () => {
    for (const path of ['/admin/risk-control', '/admin/prompt-audit', '/admin/security-audit', '/admin/probe-intercepts']) {
      expect(routerHarness.routes.some(route => route.path === path)).toBe(false)
    }
  })

  it('allows a signed-in ordinary user to access the report and gates it before sign-in', async () => {
    expect(routerHarness.routes.some(route => route.path === '/admin/codex-probes')).toBe(false)
    const trace = routerHarness.routes.find(route => route.path === '/model-trace')
    expect(trace?.meta).toMatchObject({ requiresAuth: true, requiresAdmin: false })
    const signedIn = runGuard(trace!.meta!, '/model-trace')
    await signedIn.navigation
    expect(signedIn.next).toHaveBeenCalledWith()
    authStore.isAuthenticated = false
    const guest = runGuard(trace!.meta!, '/model-trace')
    await guest.navigation
    expect(guest.next).toHaveBeenCalledWith(expect.objectContaining({ path: '/login' }))
  })

  it('waits for the first public-settings request before deciding payment access', async () => {
    const deferred = createDeferred<{ payment_enabled: boolean }>()
    appStore.fetchPublicSettings.mockImplementation(async () => {
      const settings = await deferred.promise
      appStore.cachedPublicSettings = settings
      appStore.publicSettingsLoaded = true
      return settings
    })

    const { navigation, next } = runGuard({ requiresPayment: true }, '/purchase')

    await vi.waitFor(() => expect(appStore.fetchPublicSettings).toHaveBeenCalledTimes(1))
    expect(next).not.toHaveBeenCalled()

    deferred.resolve({ payment_enabled: true })
    await navigation
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith()
  })

  it.each([
    ['payment', { requiresPayment: true }, '/purchase'],
    ['subscription', { requiresSubscription: true }, '/subscriptions'],
  ])('does not treat a failed %s settings load as explicitly disabled', async (_name, meta, path) => {
    authStore.isAdmin = false
    appStore.fetchPublicSettings.mockResolvedValue(null)

    const { navigation, next } = runGuard(meta, path)
    await navigation

    expect(appStore.publicSettingsLoaded).toBe(false)
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith()
  })

  it.each([
    ['payment', { requiresPayment: true }, { payment_enabled: false }, '/dashboard'],
    ['subscription', { requiresSubscription: true }, { subscription_enabled: false }, '/dashboard'],
  ])('redirects when loaded settings explicitly disable %s', async (_name, meta, settings, target) => {
    authStore.isAdmin = false
    appStore.cachedPublicSettings = settings
    appStore.publicSettingsLoaded = true

    const { navigation, next } = runGuard(meta, '/feature')
    await navigation

    expect(appStore.fetchPublicSettings).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith(target)
  })
})

describe('administrator redemption records', () => {
  beforeEach(() => {
    authStore.isAuthenticated = true
    authStore.isAdmin = true
    authStore.isSimpleMode = false
    appStore.backendModeEnabled = false
    appStore.publicSettingsLoaded = true
    appStore.cachedPublicSettings = {}
  })

  function visitRecords() {
    const route = routerHarness.routes.find(route => route.path === '/admin/redeem-records')!
    expect(route.meta?.requiresAuth).toBe(true)
    expect(route.meta?.requiresAdmin).toBe(true)
    return runGuard(route.meta!, route.path)
  }

  it('allows administrators', async () => {
    const { navigation, next } = visitRecords()
    await navigation
    expect(next).toHaveBeenCalledWith()
  })

  it('rejects ordinary users', async () => {
    authStore.isAdmin = false
    const { navigation, next } = visitRecords()
    await navigation
    expect(next).toHaveBeenCalledWith('/dashboard')
  })

  it('requires login for direct links', async () => {
    authStore.isAuthenticated = false
    authStore.isAdmin = false
    const { navigation, next } = visitRecords()
    await navigation
    expect(next).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/admin/redeem-records' } })
  })

  it('preserves code-management restrictions in simple mode', async () => {
    authStore.isSimpleMode = true
    const { navigation, next } = visitRecords()
    await navigation
    expect(next).toHaveBeenCalledWith('/admin/dashboard')
  })
})

describe('administrator image generation records', () => {
  beforeEach(() => {
    authStore.isAuthenticated = true
    authStore.isAdmin = true
    authStore.isSimpleMode = false
    appStore.publicSettingsLoaded = true
    appStore.cachedPublicSettings = {}
  })

  afterEach(() => {
    authStore.isAuthenticated = true
    authStore.isAdmin = true
    authStore.isSimpleMode = false
  })

  function visitRecords() {
    const route = routerHarness.routes.find(route => route.path === '/admin/image-records')!
    expect(route.meta?.requiresAuth).toBe(true)
    expect(route.meta?.requiresAdmin).toBe(true)
    return runGuard(route.meta!, route.path)
  }

  it('allows administrators', async () => {
    const { navigation, next } = visitRecords()
    await navigation
    expect(next).toHaveBeenCalledWith()
  })

  it('rejects ordinary users', async () => {
    authStore.isAdmin = false
    const { navigation, next } = visitRecords()
    await navigation
    expect(next).toHaveBeenCalledWith('/dashboard')
  })

  it('requires login for direct links', async () => {
    authStore.isAuthenticated = false
    const { navigation, next } = visitRecords()
    await navigation
    expect(next).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/admin/image-records' } })
  })
})

describe('subscription route guard (opt-out flag)', () => {
  beforeEach(() => {
    authStore.isAdmin = false
    authStore.isSimpleMode = false
    appStore.publicSettingsLoaded = true
    appStore.fetchPublicSettings.mockReset()
  })

  it.each([
    ['missing key', {}],
    ['explicit true', { subscription_enabled: true }],
  ])('lets /subscriptions through when the flag is %s', async (_name, settings) => {
    appStore.cachedPublicSettings = settings

    const { navigation, next } = runGuard({ requiresSubscription: true }, '/subscriptions')
    await navigation

    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith()
  })

  it('sends admins to the admin dashboard when subscriptions are disabled', async () => {
    authStore.isAdmin = true
    appStore.cachedPublicSettings = { subscription_enabled: false }

    const { navigation, next } = runGuard({ requiresSubscription: true }, '/subscriptions')
    await navigation

    expect(next).toHaveBeenCalledWith('/admin/dashboard')
  })
})

describe('pages kept for admins only', () => {
  const routeMeta = (path: string) =>
    vi.mocked(createRouter).mock.calls[0][0].routes.find((route) => route.path === path)?.meta

  beforeEach(() => {
    authStore.isAuthenticated = true
    authStore.isSimpleMode = false
    appStore.publicSettingsLoaded = true
    appStore.cachedPublicSettings = {}
    appStore.fetchPublicSettings.mockReset()
  })

  it.each(['/monitor', '/subscriptions'])('marks %s as hidden for regular users', (path) => {
    expect(routeMeta(path)?.hiddenForRegularUsers).toBe(true)
  })

  it.each(['/dashboard', '/keys', '/usage', '/profile', '/redeem'])('keeps %s open to regular users', (path) => {
    expect(routeMeta(path)?.hiddenForRegularUsers).toBeFalsy()
  })

  it('sends regular users back to the dashboard', async () => {
    authStore.isAdmin = false
    const { navigation, next } = runGuard({ hiddenForRegularUsers: true }, '/monitor')
    await navigation

    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith('/dashboard')
  })

  it('lets admins through', async () => {
    authStore.isAdmin = true
    const { navigation, next } = runGuard({ hiddenForRegularUsers: true }, '/monitor')
    await navigation

    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith()
  })
})

describe('embedded credit purchase route', () => {
  beforeEach(() => {
    authStore.isAuthenticated = true
    authStore.isAdmin = false
    authStore.isSimpleMode = false
    appStore.publicSettingsLoaded = true
    appStore.cachedPublicSettings = { payment_enabled: false }
  })

  it('is available without enabling native payments', async () => {
    const route = routerHarness.routes.find(route => route.path === '/buy-credits')!
    expect(route.meta?.requiresAuth).toBe(true)
    expect(route.meta?.requiresAdmin).toBe(false)
    expect(route.meta?.requiresPayment).toBeUndefined()
    const { navigation, next } = runGuard(route.meta!, route.path)
    await navigation
    expect(next).toHaveBeenCalledWith()
  })

  it('requires login before loading the shop', async () => {
    authStore.isAuthenticated = false
    const { navigation, next } = runGuard({}, '/buy-credits')
    await navigation
    expect(next).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/buy-credits' } })
  })

  it('honors simple-mode restrictions', async () => {
    authStore.isSimpleMode = true
    const { navigation, next } = runGuard({}, '/buy-credits')
    await navigation
    expect(next).toHaveBeenCalledWith('/dashboard')
  })
})
