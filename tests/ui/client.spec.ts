import { test, expect } from '@playwright/test'
import { setup } from './fixture'
import fs from 'node:fs'

test('website login waits, reopens, cancels, and handles denial without embedding a login page', async ({ page }) => {
  await setup(page, false); await page.goto('/')
  await expect(page.getByRole('button', { name: '通过官网登录' })).toBeVisible()
  await expect(page.locator('input[type=password],iframe')).toHaveCount(0)
  await page.screenshot({ path: 'qa-results/login.png' })
  await page.getByRole('button', { name: '通过官网登录' }).click()
  await expect(page.getByText('等待官网授权')).toBeVisible()
  await page.getByRole('button', { name: '重新打开官网' }).click()
  await page.getByRole('button', { name: '取消登录' }).click()
  await expect(page.getByRole('button', { name: '通过官网登录' })).toBeVisible()
  await page.getByRole('button', { name: '通过官网登录' }).click()
  await page.evaluate(() => (window as any).qa.complete(false, '你已取消官网授权。'))
  await expect(page.getByRole('alert')).toContainText('取消官网授权')
  const calls = await page.evaluate(() => (window as any).qa.calls.map((c: any) => c.command))
  expect(calls.filter((c: string) => c === 'login')).toHaveLength(2)
  expect(calls).toContain('reopen_login'); expect(calls).toContain('cancel_login')
})

test('all primary screens render, resize, and preserve an independent desktop layout', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.route('https://wzyp.cn/**', route => route.fulfill({ contentType: 'text/html', body: '<main style="padding:20px">Isolated shop fixture</main>' }))
  await setup(page); await page.goto('/')
  await expect(page.getByText('视觉验收账号，你好')).toBeVisible()
  await expect(page.getByText('$28.50', { exact: true })).toBeVisible()
  fs.mkdirSync('qa-results', { recursive: true })
  await page.screenshot({ path: 'qa-results/dashboard.png' })
  for (const [label, heading] of [
    ['模型广场', '模型广场'],
    ['渠道状态', '渠道状态'],
    ['GPT分组降智检测', 'GPT分组降智检测'],
    ['模型指纹检测', '模型指纹检测'],
    ['API 密钥', 'API 密钥'],
    ['用量记录', '用量记录'],
    ['应用推荐', '应用推荐'],
    ['购买额度', '购买额度'],
    ['兑换额度', '兑换额度'],
    ['支持工单', '支持工单'],
    ['我的账号', '我的账号'],
  ]) {
    await page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: label, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.screenshot({ path: `qa-results/${label}.png` })
  }
  await page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: '模型广场', exact: true }).click()
  await page.getByRole('button', { name: '偏好设置', exact: true }).click()
  await page.getByRole('button', { name: '深色', exact: true }).click()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.screenshot({ path: 'qa-results/dark.png' })
  for (const viewport of [{ width: 860, height: 640 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.screenshot({ path: `qa-results/compact-${viewport.width}.png` })
  }
  expect(errors).toEqual([])
})

test('key create, edit, setup drawer, and delete require the expected form and confirmation', async ({ page }) => {
  await setup(page); await page.goto('/')
  await page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: 'API 密钥', exact: true }).click()
  await page.getByRole('button', { name: '创建密钥', exact: true }).click()
  await page.getByLabel('名称', { exact: true }).fill('验收创建的密钥')
  await page.getByRole('button', { name: '分组', exact: true }).click()
  await expect(page.getByRole('option', { name: /维护中的分组/ })).toBeDisabled()
  await page.getByRole('option', { name: /OpenAI 标准线路/ }).click()
  await page.getByLabel('额度上限 (USD)').fill('5')
  await page.getByRole('switch', { name: '自定义密钥' }).click()
  await expect(page.getByPlaceholder('输入自定义密钥（至少 16 个字符）')).toBeVisible()
  await page.getByRole('switch', { name: '自定义密钥' }).click()
  await page.getByRole('switch', { name: '密钥有效期' }).click()
  await page.screenshot({ path: 'qa-results/create-key-drawer.png' })
  await page.getByRole('button', { name: '保存密钥', exact: true }).click()
  await expect(page.getByRole('button', { name: '验收创建的密钥', exact: true })).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: '验收创建的密钥' })
  await row.getByRole('button', { name: '切换分组：验收创建的密钥' }).click()
  await expect(page.getByRole('option', { name: /维护中的分组/ })).toBeDisabled()
  await page.screenshot({ path: 'qa-results/keys-group-picker.png' })
  await page.getByRole('option', { name: /Claude 专属线路/ }).click()
  await expect(row).toContainText('Claude 专属线路')
  await row.getByRole('button', { name: '接入配置' }).click()
  await expect(page.getByRole('dialog')).toContainText('settings.json')
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await row.getByRole('button', { name: '编辑密钥' }).click()
  await page.getByRole('button', { name: '启用状态', exact: true }).click()
  await page.getByRole('option', { name: /停用/ }).click()
  await page.getByRole('button', { name: '保存密钥', exact: true }).click()
  await expect(row).toContainText('已停用')
  await row.getByRole('button', { name: '删除密钥' }).click()
  expect(await page.evaluate(() => (window as any).qa.calls.filter((c: any) => c.args.method === 'DELETE').length)).toBe(0)
  await page.getByRole('dialog').getByRole('button', { name: '删除密钥', exact: true }).click()
  await expect(page.getByRole('button', { name: '验收创建的密钥', exact: true })).toHaveCount(0)
})

test('usage detail, CSV export, and actual model pricing are connected', async ({ page }) => {
  await setup(page); await page.goto('/')
  await page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: '用量记录' }).click()
  await page.setViewportSize({ width: 1240, height: 820 })
  await expect(page.locator('.usage-table')).toBeVisible()
  expect(await page.locator('.table-scroll').first().evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy()
  await page.getByRole('button', { name: 'gpt-6.1-sol', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('qa-request-0001')
  await expect(page.getByRole('dialog')).toContainText('$0.017250')
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.getByRole('button', { name: '导出当前页' }).click()
  const csv = await page.evaluate(() => (window as any).qa.calls.find((c: any) => c.command === 'export_csv')?.args.content)
  expect(csv).toContain('qa-request-0001'); expect(csv).toContain('0.01725')
  await page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: '模型广场' }).click()
  await expect(page.getByRole('cell', { name: '$0.60', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '$3.00', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'gpt-6.1-sol', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('200K')
  await page.screenshot({ path: 'qa-results/model-detail.png' })
})

test('model fingerprint detector runs live API detection and offline scoring', async ({ page }) => {
  await setup(page); await page.goto('/')
  await page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: '模型指纹检测', exact: true }).click()
  await page.getByLabel('目标模型 ID', { exact: true }).fill('gpt-6.1-sol')
  await page.getByRole('button', { name: '开始指纹检测', exact: true }).click()
  await expect(page.getByText('GPT-6.1 Sol').first()).toBeVisible()
  await expect(page.getByText('96.2%').first()).toBeVisible()
  await page.screenshot({ path: 'qa-results/模型指纹检测-结果.png' })
  await page.getByRole('tab', { name: '离线手动评分' }).click()
  await page.getByLabel('采样 #1 回答').fill(Array.from({ length: 100 }, (_, i) => (i % 300) + 1).join(' '))
  await page.getByRole('button', { name: '本地评分分析' }).click()
  await expect(page.getByText('指纹匹配完成').first()).toBeVisible()
  await page.screenshot({ path: 'qa-results/模型指纹检测-离线.png' })
})

test('update center shows version v1.00, update reminder, manual check, and real-UI ecosystem recommendations', async ({ page }) => {
  await setup(page); await page.goto('/')
  await expect(page.getByRole('button', { name: '版本与更新' })).toContainText('v1.00')
  await page.evaluate(() => {
    (window as any).qa.mockUpdate = {
      current_version: '1.0.0',
      latest_version: '1.0.1',
      display_version: 'v1.0.1',
      has_update: true,
      release_url: 'https://github.com/RavenAiWorld/ravenai-desktop/releases/tag/v1.0.1',
      download_url: 'https://github.com/RavenAiWorld/ravenai-desktop/releases/download/v1.0.1/Ravenai_1.0.1_x64-setup.exe',
      asset_name: 'Ravenai_1.0.1_x64-setup.exe',
      file_size: 10510000,
      sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      release_notes: '## v1.0.1 更新说明\n- **界面升级**：优化侧边栏层次与生态项目实景展示\n- 修复部分网络波动重试问题',
      published_at: '2026-11-26T08:30:00Z',
      source: 'ravenai',
    }
  })
  await page.getByRole('button', { name: '版本与更新' }).click()
  await page.getByRole('button', { name: '立即检查更新' }).click()
  await expect(page.getByRole('dialog')).toContainText('一键下载并更新到 v1.0.1')
  await expect(page.getByRole('dialog')).not.toContainText('##')
  await page.screenshot({ path: 'qa-results/版本与更新.png' })
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByRole('region', { name: '发现新版本提醒' })).toBeVisible()
  await page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: '应用推荐', exact: true }).click()
  for (const name of ['Codex++', 'Cockpit Tools', 'CC Switch', 'CodexHost']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  const previewImgs = page.locator('.eco-preview-img')
  await expect(previewImgs).toHaveCount(4)
  for (let i = 0; i < 4; i++) {
    expect(await previewImgs.nth(i).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 200)).toBeTruthy()
  }
  await page.screenshot({ path: 'qa-results/应用推荐.png', fullPage: true })
  await page.getByRole('button', { name: '查看大图：Codex++' }).click()
  await expect(page.getByRole('dialog', { name: 'Codex++ 界面大图' })).toBeVisible()
  await page.getByRole('button', { name: '关闭大图预览' }).click()
  await expect(page.getByRole('dialog', { name: 'Codex++ 界面大图' })).toHaveCount(0)
})

test('support create and reply use server actions', async ({ page }) => {
  await setup(page); await page.goto('/')
  await page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: '支持工单' }).click()
  await page.getByRole('button', { name: '新建工单' }).click()
  await page.getByLabel('标题', { exact: true }).fill('新的验收工单')
  await page.getByLabel('问题描述').fill('这是独立测试中的请求内容。')
  await page.getByRole('button', { name: '提交工单' }).click()
  await expect(page.getByRole('dialog')).toContainText('新的验收工单')
  await page.getByLabel('回复', { exact: true }).fill('补充测试信息。')
  await page.getByRole('button', { name: '发送回复' }).click()
  await expect(page.getByRole('dialog')).toContainText('补充测试信息。')
})

test('server failures are visible and session expiry returns to website login', async ({ page }) => {
  await setup(page); await page.goto('/')
  await page.evaluate(() => { (window as any).qa.failures['/keys'] = '暂时无法连接，请重试。' })
  await page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: 'API 密钥', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('暂时无法连接')
  await page.evaluate(() => { (window as any).qa.authenticated = false })
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.getByRole('button', { name: '通过官网登录' })).toBeVisible()
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toMatch(/access_token|refresh_token|sk-qa/)
})
