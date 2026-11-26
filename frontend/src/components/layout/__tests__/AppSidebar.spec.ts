import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppSidebar.vue')
const componentSource = readFileSync(componentPath, 'utf8')
const stylePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../style.css')
const styleSource = readFileSync(stylePath, 'utf8')

describe('AppSidebar custom SVG styles', () => {
  it('does not override uploaded SVG fill or stroke colors', () => {
    expect(componentSource).toContain('.sidebar-svg-icon {')
    expect(componentSource).toContain('color: currentColor;')
    expect(componentSource).toContain('display: block;')
    expect(componentSource).not.toContain('stroke: currentColor;')
    expect(componentSource).not.toContain('fill: none;')
  })
})

describe('AppSidebar scroll position persistence', () => {
  it('binds a template ref to the sidebar nav element', () => {
    expect(componentSource).toContain('ref="sidebarNavRef"')
    expect(componentSource).toContain('sidebar-nav')
  })

  it('declares sidebarNavRef in script setup', () => {
    expect(componentSource).toContain("const sidebarNavRef = ref<HTMLElement | null>(null)")
  })

  it('saves scroll position on beforeUnmount', () => {
    expect(componentSource).toContain('onBeforeUnmount')
    expect(componentSource).toContain('appStore.sidebarScrollTop')
    expect(componentSource).toContain('sidebarNavRef.value.scrollTop')
  })

  it('restores scroll position on mount', () => {
    expect(componentSource).toContain('onMounted')
    expect(componentSource).toContain('appStore.sidebarScrollTop')
    expect(componentSource).toContain('nextTick')
  })
})

describe('AppSidebar collapsible groups', () => {
  it('lets the user collapse a group even while a child route is active', () => {
    // The expand state must come from the user's override first, falling back
    // to the active-route heuristic only when the user has not clicked yet.
    expect(componentSource).toContain('const groupExpandOverrides = ref<Map<string, boolean>>(new Map())')
    expect(componentSource).not.toContain('expandedGroups.value.has(item.path) || isGroupActive(item)')
  })
})

describe('AppSidebar header styles', () => {
  it('does not clip the version badge dropdown', () => {
    const sidebarHeaderBlockMatch = styleSource.match(/\.sidebar-header\s*\{[\s\S]*?\n {2}\}/)
    const sidebarBrandBlockMatch = componentSource.match(/\.sidebar-brand\s*\{[\s\S]*?\n\}/)

    expect(sidebarHeaderBlockMatch).not.toBeNull()
    expect(sidebarBrandBlockMatch).not.toBeNull()
    expect(sidebarHeaderBlockMatch?.[0]).not.toContain('@apply overflow-hidden;')
    expect(sidebarBrandBlockMatch?.[0]).not.toContain('overflow: hidden;')
  })
})

describe('AppSidebar personal navigation', () => {
  it('orders tools, usage and billing, then support and account entries', () => {
    const personalMenu = componentSource.split('function buildSelfNavItems')[1].split('// finalizeNav')[0]
    const paths = [
      '/keys', '/model-plaza', '/image-studio', '/batch-image', '/model-trace',
      '/available-channels', '/usage', '/buy-credits', '/purchase', '/redeem',
      '/orders', '/support', '/affiliate', '/profile',
    ]
    const positions = paths.map(path => personalMenu.indexOf(`path: '${path}'`))
    expect(positions.every(position => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('omits channel status and my subscriptions while keeping code redemption available', () => {
    expect(componentSource).not.toMatch(/path: '\/(monitor|subscriptions)'/)
    expect(componentSource).toContain("path: '/redeem'")
    for (const path of ['/keys', '/usage', '/profile']) {
      expect(componentSource).toContain(`path: '${path}'`)
    }
  })

  it('keeps model health without the retired admin probes', () => {
    expect(componentSource).not.toContain('/admin/codex-probes')
    expect(componentSource).toContain("path: '/admin/model-health'")
  })

  it('keeps administrator management entries', () => {
    for (const path of ['/admin/groups', '/admin/channels/monitor', '/admin/subscriptions', '/admin/redeem']) {
      expect(componentSource).toContain(`path: '${path}'`)
    }
  })

  it('places redemption records beside code management in the administrator menu', () => {
    const adminMenu = componentSource.split('const adminNavItems = computed')[1]
    expect(adminMenu.indexOf("path: '/admin/redeem-records'")).toBeGreaterThan(adminMenu.indexOf("path: '/admin/redeem'"))
    expect(adminMenu.indexOf("path: '/admin/redeem-records'")).toBeLessThan(adminMenu.indexOf("path: '/admin/promo-codes'"))
    expect(componentSource.split('function buildSelfNavItems')[1].split('// finalizeNav')[0]).not.toContain('/admin/redeem-records')
  })

  it('offers the credit shop popup to users and the administrator personal menu', () => {
    expect(componentSource).toMatch(/path: '\/buy-credits'[^\n]*label: t\('creditPurchase.title'\)/)
    expect(componentSource).toMatch(/path: '\/buy-credits'[^\n]*getCreditShopUrl\(appStore.cachedPublicSettings\)/)
    expect(componentSource).toContain('finalizeNav(buildSelfNavItems(true))')
    expect(componentSource).toContain('finalizeNav(buildSelfNavItems(false))')
    expect(componentSource.match(/:is="item.path === '\/buy-credits' \? 'button' : RouterLink"/g)).toHaveLength(2)
    expect(componentSource).toContain('openCreditShopPopup(getCreditShopUrl(appStore.cachedPublicSettings))')
    expect(componentSource).toContain("appStore.showWarning(t('creditPurchase.popupBlocked'))")
  })
})

describe('AppSidebar subscription feature flag', () => {
  it('uses the subscription public-settings flag for Subscription Management', () => {
    expect(componentSource).toContain('const flagSubscription = makeSidebarFlag(FeatureFlags.subscription)')
    expect(componentSource).toMatch(/path: '\/admin\/subscriptions'[^\n]*featureFlag: flagSubscription/)
  })

  it('also hides the admin Subscription Management entry on recharge-only sites', () => {
    expect(componentSource).toMatch(/path: '\/admin\/subscriptions'[^\n]*featureFlag: flagSubscription/)
  })

  it('derives the purchase entry label from the site billing mode', () => {
    expect(componentSource).toContain("import { resolveSiteBillingMode } from '@/utils/siteBillingMode'")
    expect(componentSource).toMatch(/case 'recharge_only':\s*return t\('nav\.recharge'\)/)
    expect(componentSource).toMatch(/case 'subscription_only':\s*return t\('nav\.subscribe'\)/)
    expect(componentSource).toMatch(/path: '\/purchase'[^\n]*label: purchaseNavLabel\.value/)
  })
})

describe('AppSidebar retired audit modules', () => {
  it('has no audit module navigation', () => {
    for (const path of ['/safety/', '/admin/risk-control', '/admin/prompt-audit', '/admin/security-audit', '/admin/probe-intercepts']) {
      expect(componentSource).not.toContain(path)
    }
  })
})

describe('AppSidebar MCP entry', () => {
  it('uses the MCP logo and shows the entry only when the deployment enables MCP', () => {
    expect(componentSource).toContain("render: () => h(Icon, { name: 'mcp' })")
    expect(componentSource).toContain('const flagMCP = makeSidebarFlag(FeatureFlags.mcp)')
    expect(componentSource).toMatch(/path: '\/settings\/mcp'[^\n]*icon: MCPIcon, featureFlag: flagMCP/)
    expect(componentSource).toMatch(/if \(flagMCP\(\)\) filtered\.push\(\{ path: '\/settings\/mcp'[^\n]*icon: MCPIcon/)
    expect(componentSource).not.toMatch(/path: '\/settings\/mcp'[^\n]*PluginIcon/)
  })
})
