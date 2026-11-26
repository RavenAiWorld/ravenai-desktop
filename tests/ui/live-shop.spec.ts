import { test, expect } from '@playwright/test'
import { setup } from './fixture'

test('live storefront reaches its own page or verification inside the purchase module', async ({ page }) => {
  test.skip(process.env.RAVENAI_LIVE_SHOP !== '1', 'Explicit read-only storefront smoke test')
  await setup(page); await page.goto('/')
  await page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: '购买额度', exact: true }).click()
  const frame = page.frameLocator('.shop-frame')
  await expect(frame.locator('body')).toBeVisible()
  await expect.poll(async () => {
    const shop = page.frames().find(frame => frame.url().startsWith('https://wzyp.cn/'))
    return shop ? (await shop.locator('body').innerText()).trim().length : 0
  }, { timeout: 20_000 }).toBeGreaterThan(5)
  const shop = page.frames().find(frame => frame.url().startsWith('https://wzyp.cn/'))!
  const text = await shop.locator('body').innerText()
  console.log('Live storefront:', { loaded: true, verificationRequired: /验证|verify|verification/i.test(text), title: await shop.title() })
  await page.screenshot({ path: 'qa-results/purchase-live.png' })
  expect(await page.evaluate(() => (window as any).qa.calls.some((call: any) => call.command === 'open_site'))).toBe(false)
})
