import { test, expect, type Page } from '@playwright/test'
import { setup } from './fixture'
import fs from 'node:fs'

const nav = (page: Page, label: string) => page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: label, exact: true }).click()

test('complete local studio opens without browser navigation and preserves its state', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await setup(page); await page.goto('/'); await nav(page, '生图平台')
  const studio = page.frameLocator('iframe[title="Ravenai 生图平台"]')
  await expect(studio.getByText('Nova Studio', { exact: true }).first()).toBeVisible()
  await expect(studio.locator('textarea').first()).toBeVisible()
  await studio.locator('textarea').first().fill('保留在本机的草稿')
  await page.screenshot({ path: 'qa-results/studio-desktop.png' })
  await nav(page, '模型广场'); await nav(page, '生图平台')
  await expect(studio.locator('textarea').first()).toHaveValue('保留在本机的草稿')
  expect(await page.evaluate(() => (window as any).qa.calls.filter((call: any) => call.command === 'open_site'))).toEqual([])
  expect(errors).toEqual([])
})

test('studio submits one priced task, retrieves and saves the image, then survives reload', async ({ page }) => {
  await setup(page); await page.goto('/'); await nav(page, '生图平台')
  const studio = page.frameLocator('.studio-frame')
  await studio.getByPlaceholder('描述你想要生成的图像...').fill('一张用于独立测试的绿色图标')
  await studio.getByRole('button', { name: '按文生图提交', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).qa.studioTasks?.length)).toBe(1)
  const task = await page.evaluate(() => (window as any).qa.studioTasks[0])
  expect(task).toMatchObject({ model: 'gpt-image-2.6-flare', baseUrl: 'https://raven-session.invalid/groups/1', expectedPrice: .05, parallelCount: 1, images: [] })
  expect(task.requestID).toMatch(/^[a-z0-9-]{36}$/)
  await expect.poll(() => page.evaluate(() => (window as any).qa.calls.filter((call: any) => call.command === 'studio_request' && call.args.input.path.includes('/images/')).length)).toBeGreaterThan(0)
  await expect.poll(async () => studio.locator('img[src^="blob:"]').count()).toBeGreaterThan(0)
  await expect.poll(() => studio.locator('img[src^="blob:"]').first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await page.screenshot({ path: 'qa-results/studio-generated.png' })
  await studio.getByTitle('下载', { exact: true }).first().click()
  await expect.poll(() => page.evaluate(() => (window as any).qa.calls.filter((call: any) => call.command === 'studio_save').length)).toBe(1)
  await page.reload(); await nav(page, '生图平台')
  await expect.poll(() => studio.locator('img[src^="blob:"]').count()).toBeGreaterThan(0)
  expect(await page.evaluate(() => (window as any).qa.studioTasks?.length || 0)).toBe(0)
})

test('studio streams text and uploads multipart image edits through native authentication', async ({ page }) => {
  await setup(page); await page.goto('/'); await nav(page, '生图平台')
  await expect(page.frameLocator('.studio-frame').getByText('Nova Studio', { exact: true }).first()).toBeVisible()
  const frame = page.frames().find(frame => frame.url().includes('/assets/studio/'))!
  const result = await frame.evaluate(async () => {
    const text = await fetch('/api/nova/proxy/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stream: true }) })
    const streamed = await text.text()
    const form = new FormData(); form.append('model', 'gpt-image-2.6-flare'); form.append('image', new Blob(['isolated-image'], { type: 'image/png' }), 'reference.png')
    const edited = await fetch('/api/nova/proxy/image-edit', { method: 'POST', headers: { 'X-Nova-Base-Url': 'https://raven-session.invalid/groups/1', 'X-Nova-Expected-Price': '.05' }, body: form })
    return { streamed, image: (await edited.json()).data[0].b64_json.length }
  })
  expect(result.streamed).toContain('流式测试')
  expect(result.image).toBeGreaterThan(100)
  const input = await page.evaluate(() => (window as any).qa.calls.find((call: any) => call.args.input?.path.endsWith('/proxy/image-edit')).args.input)
  expect(input.headers['content-type']).toContain('multipart/form-data; boundary=')
  expect(input.headers.authorization).toBeUndefined()
  expect(Buffer.from(input.body, 'base64').toString()).toContain('reference.png')
})

test('reference upload switches to image-to-image and respects the selected price', async ({ page }) => {
  await setup(page); await page.goto('/'); await nav(page, '生图平台')
  const studio = page.frameLocator('.studio-frame')
  await studio.locator('input[type=file]').first().setInputFiles('assets/icon.png')
  await studio.locator('textarea').first().fill('把参考图背景换成纯白色')
  await studio.getByRole('button', { name: '1K', exact: true }).click()
  await studio.getByRole('button', { name: '2K', exact: true }).click()
  await studio.getByRole('button', { name: '按图生图提交', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).qa.studioTasks?.length)).toBe(1)
  const task = await page.evaluate(() => (window as any).qa.studioTasks[0])
  expect(task).toMatchObject({ mode: 'image-to-image', outputSize: '2K', expectedPrice: .1 })
  expect(task.images).toHaveLength(1)
  expect(task.images[0].data.length).toBeGreaterThan(100)
})

test('studio does not retry rejected paid tasks and handles session expiry', async ({ page }) => {
  await setup(page); await page.goto('/'); await nav(page, '生图平台')
  const studio = page.frameLocator('.studio-frame')
  await studio.getByPlaceholder('描述你想要生成的图像...').fill('不可重复提交的测试任务')
  await page.evaluate(() => { (window as any).qa.studioReject = true })
  await studio.getByRole('button', { name: '按文生图提交', exact: true }).click()
  await expect(studio.getByText('图片价格已变更，请重新确认。', { exact: false }).first()).toBeVisible()
  expect(await page.evaluate(() => (window as any).qa.studioTasks.length)).toBe(1)
  await page.evaluate(() => { (window as any).qa.authenticated = false })
  const frame = page.frames().find(frame => frame.url().includes('/assets/studio/'))!
  await frame.evaluate(() => { void fetch('/api/nova/queue-status').catch(() => {}) })
  await expect(page.getByRole('button', { name: '通过官网登录' })).toBeVisible()
  await expect(page.locator('.studio-frame')).toHaveCount(0)
})

test('studio tools and embedded store fit compact windows and dark theme', async ({ page }) => {
  await page.route('https://wzyp.cn/**', route => route.fulfill({ contentType: 'text/html', body: '<main style="padding:20px">Ravenai shop fixture</main>' }))
  await setup(page); await page.goto('/'); await nav(page, '生图平台')
  const studio = page.frameLocator('.studio-frame')
  await expect(studio.getByText('Nova Studio', { exact: true }).first()).toBeVisible()
  for (const label of ['Agent', '无限画布', 'UI设计模式', '我的素材', '反推提示词', '动图生成', '生图工作台']) {
    await studio.getByRole('tab', { name: label, exact: true }).click()
    await expect(studio.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true')
  }
  for (const viewport of [{ width: 860, height: 640 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    const frame = page.frames().find(frame => frame.url().includes('/assets/studio/'))!
    expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.screenshot({ path: `qa-results/studio-${viewport.width}.png` })
  }
  await page.setViewportSize({ width: 1240, height: 820 })
  await page.getByRole('button', { name: '切换深色外观' }).click()
  await expect(studio.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(studio.locator('body')).toHaveCSS('color', 'rgb(241, 245, 249)')
  await page.screenshot({ path: 'qa-results/studio-dark.png' })
  await studio.getByRole('button', { name: /余额/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('购买额度')
  await expect(page.locator('.shop-frame')).toBeVisible()
  await page.screenshot({ path: 'qa-results/purchase-embedded.png' })
  expect(await page.evaluate(() => (window as any).qa.calls.some((call: any) => call.command === 'open_site'))).toBe(false)
})

test('studio bootstrap failure is visible and retry reloads the real bundled interface', async ({ page }) => {
  await setup(page); await page.goto('/')
  await page.evaluate(() => { (window as any).qa.failures['/image-studio/catalog'] = '生图线路暂时不可用' })
  await nav(page, '生图平台')
  await expect(page.getByRole('alert')).toContainText('生图线路暂时不可用')
  await page.evaluate(() => { delete (window as any).qa.failures['/image-studio/catalog'] })
  await page.getByRole('button', { name: '重新连接', exact: true }).click()
  await expect(page.frameLocator('.studio-frame').getByText('Nova Studio', { exact: true }).first()).toBeVisible()
})

test('generated HTML preview executes locally but cannot access parent or network', async ({ page }) => {
  await page.route('http://raven-preview.localhost/preview', route => route.fulfill({
    contentType: 'text/html',
    headers: { 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; sandbox allow-scripts" },
    body: fs.readFileSync('src-tauri/preview.html', 'utf8'),
  }))
  await setup(page); await page.goto('/'); await nav(page, '生图平台')
  await expect(page.frameLocator('.studio-frame').getByText('Nova Studio', { exact: true }).first()).toBeVisible()
  const studio = page.frames().find(frame => frame.url().includes('/assets/studio/'))!
  await studio.evaluate(() => {
    const preview = document.createElement('iframe')
    preview.title = 'Isolated preview QA'
    preview.sandbox.add('allow-scripts')
    preview.src = 'http://raven-preview.localhost/preview'
    preview.onload = () => preview.contentWindow!.postMessage({ channel: 'raven-replica-preview', html: `<html><body><p id="rendered">Preview test</p><script>
      document.body.dataset.script = 'ran';
      try { parent.document.body.dataset.compromised = 'yes'; document.body.dataset.isolation = 'failed' } catch { document.body.dataset.isolation = 'passed' }
      fetch('https://example.invalid/probe').then(() => document.body.dataset.network = 'failed').catch(() => document.body.dataset.network = 'blocked');
    <\/script></body></html>` }, '*')
    document.body.append(preview)
  })
  const preview = page.frameLocator('.studio-frame').frameLocator('iframe[title="Isolated preview QA"]')
  await expect(preview.locator('body')).toHaveAttribute('data-script', 'ran')
  await expect(preview.locator('body')).toHaveAttribute('data-isolation', 'passed')
  await expect(preview.locator('body')).toHaveAttribute('data-network', 'blocked')
})
