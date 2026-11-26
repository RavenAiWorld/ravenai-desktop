import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { setup } from './fixture'

test('real public model catalog renders in native modules', async ({ page, request }) => {
  test.skip(process.env.RAVENAI_LIVE_QA !== '1', 'Explicit read-only production smoke test')
  const response = await request.get('https://ravenaiworld.org/api/v1/model-plaza')
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  expect(body.code).toBe(0)
  expect(body.data.groups.length).toBeGreaterThan(0)
  await setup(page)
  await page.goto('/')
  await page.evaluate(data => { (window as any).qa.plaza = data }, body.data)
  const navigation = page.getByRole('navigation', { name: '主要导航' })
  await page.setViewportSize({ width: 1240, height: 820 })
  for (const label of ['渠道状态', '模型广场']) {
    await navigation.getByRole('button', { name: label, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.locator('.empty[role=status]')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.screenshot({ path: `qa-results/live-${label}.png` })
  }
  await navigation.getByRole('button', { name: '渠道状态', exact: true }).click()
  expect(await page.locator('.status-row-item').first().evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy()
  await page.locator('.channel-name').first().click()
  await expect(page.locator('.channel-row table').first()).toBeVisible()
  await page.screenshot({ path: 'qa-results/live-channel-expanded.png' })
  await page.setViewportSize({ width: 860, height: 640 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  expect(await page.locator('.status-row-item').first().evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy()
  await page.screenshot({ path: 'qa-results/live-channel-860.png' })
  fs.writeFileSync('qa-results/live-public.json', JSON.stringify({ checked_at: new Date().toISOString(), status: response.status(), groups: body.data.groups.length, models: body.data.groups.flatMap((g: any) => g.models).length, monitored: body.data.groups.flatMap((g: any) => g.models).filter((m: any) => m.route_stats).length, note: 'Real public catalog; account shell and other workflows use isolated test records.', passed: true }, null, 2))
})
