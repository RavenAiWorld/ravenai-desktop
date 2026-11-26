'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')

exports.run = async ({ app, win, session, vault, evaluate, waitFor, capture, result }) => {
  // Test-only API boundary. Every API is intercepted before disposable credentials are created.
  const original = await session.protocol.isProtocolHandled('https')
  assert(original)
  const renderer = path.resolve(__dirname, '../renderer')
  const { isLocalPage } = require('../desktop/policy.cjs')
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
  const publicSettings = await evaluate("fetch('/api/v1/settings/public').then(r=>r.json()).then(r=>r.data)")
  const publicModels = await evaluate("fetch('/api/v1/model-plaza').then(r=>r.json()).then(r=>r.data)")
  const user = { id: 91000001, username: 'Workspace QA', email: 'workspace-qa@example.invalid', role: 'user', balance: 25, frozen_balance: 0, concurrency: 5, status: 'active', allowed_groups: [], balance_notify_enabled: false, balance_notify_threshold: null, balance_notify_extra_emails: [], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
  const stats = Object.fromEntries(['total_api_keys', 'active_api_keys', 'total_requests', 'total_input_tokens', 'total_output_tokens', 'total_cache_creation_tokens', 'total_cache_read_tokens', 'total_tokens', 'total_cost', 'total_actual_cost', 'today_requests', 'today_input_tokens', 'today_output_tokens', 'today_cache_creation_tokens', 'today_cache_read_tokens', 'today_tokens', 'today_cost', 'today_actual_cost', 'average_duration_ms', 'rpm', 'tpm'].map(key => [key, 0]))
  Object.assign(stats, { total_api_keys: 2, active_api_keys: 2, today_requests: 128, today_tokens: 98452, today_actual_cost: .4286, total_actual_cost: 4.7632 })
  const group = { id: 1, name: 'OpenAI Standard', platform: 'openai', status: 'active', subscription_type: 'standard', rate_multiplier: 1 }
  const baseKey = { id: 1, user_id: user.id, name: 'Development', key: 'sk-qa-disposable-not-a-real-key', group_id: 1, group, status: 'active', quota: 20, quota_used: 4.7632, expires_at: null, created_at: '2026-11-20T10:00:00Z', updated_at: '2026-11-20T10:00:00Z', last_used_at: '2026-11-26T04:30:00Z', ip_whitelist: [], ip_blacklist: [], rate_limit_5h: 0, rate_limit_1d: 5, rate_limit_7d: 20, usage_5h: .2, usage_1d: .4286, usage_7d: 4.7632 }
  let keyRows = [{ ...baseKey }, { ...baseKey, id: 2, name: 'Personal projects', key: 'sk-qa-second-disposable-not-real', quota: 0, quota_used: .035 }]
  const usageRows = Array.from({ length: 6 }, (_, index) => ({ id: 100 + index, user_id: user.id, api_key_id: 1, api_key: baseKey, group, model: index % 2 ? 'gpt-5.1' : 'gpt-5.2', input_tokens: 1200 + index * 900, output_tokens: 800 + index * 200, cache_read_tokens: 2000, cache_creation_tokens: 0, total_cost: .021, actual_cost: .021, rate_multiplier: 1, duration_ms: 2150, first_token_ms: 145, stream: true, request_type: 'stream', request_id: 'qa-request-' + index, created_at: `2026-11-26T04:${String(30 - index).padStart(2, '0')}:00Z` }))
  const trend = Array.from({ length: 7 }, (_, index) => ({ date: `2026-11-${20 + index}`, requests: [21, 42, 30, 81, 69, 103, 128][index], total_tokens: 30000, actual_cost: .3 }))
  const errorRow = { id: 41, model: 'gpt-5.2', key_name: 'Development', created_at: '2026-11-26T04:00:00Z', status_code: 429, category: 'rate_limit', message: 'Fixture rate limit', inbound_endpoint: '/v1/responses', error_body: '{"error":"fixture only"}' }
  let usageFailure = false
  let created = false
  let changed = false
  let toggled = false
  let deleted = false
  let signedIn = false
  let refreshes = 0
  let logout = false
  const calls = []
  const unknown = new Set()
  const json = (data, status = 200) => new Response(JSON.stringify({ code: status === 200 ? 0 : status, data, message: status === 200 ? '' : 'Unauthorized' }), { status, headers: { 'content-type': 'application/json' } })
  session.protocol.unhandle('https')
  session.protocol.handle('https', async request => {
    const url = new URL(request.url)
    if (url.origin !== 'https://ravenaiworld.org') return new Response('', { status: 204 })
    const route = url.pathname.replace('/api/v1', '')
    if (url.pathname.startsWith('/api/')) {
      calls.push({ method: request.method, route })
      if (route === '/settings/public') return json({ ...publicSettings, turnstile_enabled: false, login_agreement_enabled: false })
      if (route === '/model-plaza') return json(publicModels)
      if (route === '/auth/login') {
        const input = await request.json()
        assert.equal(input.email, user.email)
        signedIn = true
        return json({ access_token: 'qa-disposable-access', refresh_token: 'qa-disposable-refresh', expires_in: 3600, user })
      }
      if (route === '/auth/refresh') {
        refreshes++
        return json({ access_token: 'qa-rotated-access', refresh_token: 'qa-rotated-refresh', expires_in: 3600, user })
      }
      if (route === '/auth/logout') { logout = true; signedIn = false; return json({}) }
      if (!signedIn) return json(null, 401)
      if (route === '/auth/me' || route === '/user/profile') return json({ ...user, run_mode: 'standard' })
      if (route === '/usage/dashboard/stats' || route === '/usage/stats') return json(stats)
      if (route === '/usage/dashboard/trend') return json({ trend })
      if (route === '/usage/dashboard/models') return json({ models: [] })
      if (route === '/usage/dashboard/api-keys-usage') return json({ stats: {} })
      if (route === '/user/platform-quotas') return json({ platform_quotas: [] })
      if (route === '/subscriptions/summary') return json({ total_subscriptions: 0, active_subscriptions: 0, subscriptions: [] })
      if (route === '/groups/available') return json([group])
      if (['/subscriptions', '/subscriptions/active', '/subscriptions/progress', '/groups', '/announcements', '/user/passkeys', '/user/auth-bindings', '/models'].includes(route)) return json([])
      if (route === '/keys' && request.method === 'POST') { const input = await request.json(); assert.equal(input.name, 'QA Created'); created = true; const key = { ...baseKey, ...input, id: 3, key: 'sk-qa-new-disposable' }; keyRows.unshift(key); return json(key) }
      if (/^\/keys\/\d+$/.test(route)) { const id = Number(route.split('/').pop()); if (request.method === 'PUT') { const input = await request.json(); const key = keyRows.find(item => item.id === id); Object.assign(key, input); if (input.name) { assert.equal(input.name, 'QA Renamed'); changed = true } if (input.status) toggled = true; return json(key) } if (request.method === 'DELETE') { keyRows = keyRows.filter(item => item.id !== id); deleted = true; return json({}) } }
      if (route === '/keys') { const search = url.searchParams.get('search'); const status = url.searchParams.get('status'); const items = keyRows.filter(item => (!search || item.name.includes(search)) && (!status || item.status === status)); return json({ items, total: items.length, page: 1, page_size: 20, pages: 1 }) }
      if (route === '/usage') { if (usageFailure) return json(null, 503); return json({ items: usageRows, total: usageRows.length, page: 1, page_size: 30, pages: 1 }) }
      if (/^\/usage\/\d+$/.test(route)) return json(usageRows.find(item => item.id === Number(route.split('/').pop())))
      if (route === '/usage/errors') return json({ items: [errorRow], total: 1, page: 1, page_size: 30, pages: 1 })
      if (route === '/usage/errors/41') return json(errorRow)
      if (route === '/orders') return json({ items: [], total: 0, page: 1, page_size: 20, pages: 0 })
      if (route === '/payment/config') return json({ enabled: false, payment_methods: [] })
      if (route === '/support-tickets/summary') return json({ user_unread: 0, admin_unread: 0, open_count: 0 })
      if (route === '/groups/rates') return json({})
      if (route === '/user/totp/status') return json({ enabled: false, feature_enabled: false })
      if (route === '/usage/dashboard/snapshot-v2') return json({ stats, trend: [], models: [], groups: [], api_keys: [] })
      unknown.add(route)
      return json({})
    }
    if (url.pathname === '/setup/status') return json({ needs_setup: false })
    const file = isLocalPage(url.pathname) ? path.join(renderer, 'index.html') : path.join(renderer, url.pathname)
    if (!file.startsWith(renderer + path.sep)) return new Response('', { status: 404 })
    try { return new Response(await fs.readFile(file), { headers: { 'content-type': mime[path.extname(file)] || 'application/octet-stream' } }) } catch { return new Response('', { status: 404 }) }
  })
  await evaluate("localStorage.clear();sessionStorage.clear()")
  await vault.write({ sub2api_locale: 'zh' })
  await win.loadURL('https://ravenaiworld.org/login')
  win.setSize(1320, 920)
  await waitFor("!!document.querySelector('#email') && !document.querySelector('#email').disabled")
  await evaluate(`(() => { for (const [id, value] of [['email',${JSON.stringify(user.email)}], ['password','qa-only-disposable-password']]) { const field = document.getElementById(id); field.value = value; field.dispatchEvent(new Event('input',{bubbles:true})) } })()`)
  await evaluate("document.querySelector('form').requestSubmit()")
  await waitFor("location.pathname==='/dashboard' && !!document.querySelector('#console-sidebar')")
  await waitFor("document.querySelector('.desktop-connection')?.textContent.includes('已连接')")
  await capture('fixture-dashboard-desktop')
  assert.equal(await evaluate("localStorage.getItem('auth_token')"), 'qa-disposable-access')
  await vault.flush()
  const saved = await vault.read()
  assert.equal(saved.auth_token, 'qa-disposable-access')
  const { createVault } = require('../desktop/vault.cjs')
  const { safeStorage } = require('electron')
  assert.deepEqual(await createVault(app.getPath('userData'), safeStorage).read(), saved)
  const encrypted = await fs.readFile(path.join(app.getPath('userData'), 'account.vault'))
  assert.equal(encrypted.includes(Buffer.from('qa-disposable')), false)
  result.checks.push('Isolated fixture: native password login, dashboard and encrypted token persistence')
  for (const [route, name] of [['/keys', 'keys'], ['/usage', 'usage'], ['/profile', 'profile'], ['/subscriptions', 'subscriptions'], ['/orders', 'orders']]) {
    await win.loadURL('https://ravenaiworld.org' + route)
    await waitFor("!!document.querySelector('#console-sidebar') && !!document.querySelector('h1') && document.querySelector('.desktop-connection')?.textContent.includes('已连接')")
    await capture('fixture-' + name)
  }
  await win.loadURL('https://ravenaiworld.org/keys')
  await waitFor("document.querySelectorAll('.client-key-row').length===2")
  await evaluate("document.querySelector('[data-testid=create-key]').click()")
  await waitFor("!!document.querySelector('[name=key-name]')")
  await evaluate("(()=>{const input=document.querySelector('[name=key-name]');input.value='QA Created';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#client-key-form').requestSubmit()})()")
  await waitFor("document.querySelectorAll('.client-key-row').length===3 && !document.querySelector('#client-key-form')")
  assert(created)
  await evaluate("document.querySelector('[aria-label=编辑密钥]').click()")
  await waitFor("!!document.querySelector('[name=key-name]')")
  await evaluate("(()=>{const input=document.querySelector('[name=key-name]');input.value='QA Renamed';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#client-key-form').requestSubmit()})()")
  await waitFor("document.querySelector('.client-detail-heading h2')?.textContent==='QA Renamed' && !document.querySelector('#client-key-form')")
  assert(changed)
  await evaluate("Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='停用密钥').click()")
  await waitFor("document.querySelector('.client-detail-status')?.textContent.includes('已停用')")
  assert(toggled)
  await evaluate("Array.from(document.querySelectorAll('.client-tabs button')).find(e=>e.textContent==='接入配置').click()")
  await waitFor("!!document.querySelector('.client-secret input[type=password]')")
  assert.equal(await evaluate("document.querySelector('.client-config').textContent.includes('sk-qa-')"), false)
  await capture('fixture-key-connection')
  await evaluate("Array.from(document.querySelectorAll('.client-tabs button')).find(e=>e.textContent==='概览').click()")
  await evaluate("document.querySelector('[aria-label=删除密钥]').click()")
  await waitFor("!!document.querySelector('.modal-overlay')")
  await evaluate("Array.from(document.querySelectorAll('.modal-footer button')).find(e=>e.textContent==='删除密钥').click()")
  await waitFor("document.querySelectorAll('.client-key-row').length===2 && !document.querySelector('.modal-overlay')")
  assert(deleted)
  result.checks.push('Desktop key workspace: create, edit, disable, masked connection settings and confirmed delete use expected APIs')
  await win.loadURL('https://ravenaiworld.org/usage')
  await waitFor("document.querySelectorAll('.client-table tbody tr').length===6")
  await evaluate("document.querySelector('.client-table tbody tr').click()")
  await waitFor("!!document.querySelector('.client-usage-detail .client-detail-model')")
  await capture('fixture-usage-detail')
  await evaluate("Array.from(document.querySelectorAll('.client-tabs button')).find(e=>e.textContent==='错误记录').click()")
  await waitFor("document.querySelectorAll('.client-table tbody tr').length===1")
  await evaluate("document.querySelector('.client-table tbody tr').click()")
  await waitFor("document.querySelector('.client-usage-detail')?.textContent.includes('Fixture rate limit')")
  await capture('fixture-usage-errors')
  usageFailure = true
  await evaluate("Array.from(document.querySelectorAll('.client-tabs button')).find(e=>e.textContent==='请求记录').click()")
  await waitFor("!!document.querySelector('.client-error')")
  usageFailure = false
  await evaluate("document.querySelector('.client-error button').click()")
  await waitFor("!document.querySelector('.client-error') && document.querySelectorAll('.client-table tbody tr').length===6")
  result.checks.push('Desktop usage workspace: details, error details, failure message and retry verified')
  await win.loadURL('https://ravenaiworld.org/desktop-settings')
  await waitFor("!!document.querySelector('.client-settings')")
  await evaluate("Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='检测连接').click()")
  await waitFor("document.querySelector('.client-settings [role=status]')?.textContent.includes('已连接')")
  await capture('fixture-client-settings')
  await evaluate("document.querySelector('.client-search').click()")
  await waitFor("!!document.querySelector('.client-command input')")
  await evaluate("(()=>{const input=document.querySelector('.client-command input');input.value='API';input.dispatchEvent(new Event('input',{bubbles:true}))})()")
  await waitFor("document.querySelectorAll('.client-command-results button').length===1")
  await evaluate("document.querySelector('.client-command-results button').click()")
  await waitFor("location.pathname==='/keys'")
  result.checks.push('Desktop preferences connectivity and command search navigation verified')
  await win.loadURL('https://ravenaiworld.org/model-plaza')
  await waitFor("!!document.querySelector('[data-testid=plaza-price-table]')")
  await capture('fixture-model-catalog')
  await evaluate("document.querySelector('[data-testid=plaza-price-table] tbody button').click()")
  await waitFor("!!document.querySelector('[role=dialog]')")
  await capture('fixture-model-details')
  result.checks.push('Desktop model catalog and detail pricing rendered from real public catalog captured before disposable sign-in')
  win.setSize(860, 700)
  await win.loadURL('https://ravenaiworld.org/dashboard')
  await waitFor("!!document.querySelector('#console-sidebar')")
  await capture('fixture-dashboard-compact')
  await evaluate("document.querySelector('#app').__vue_app__?.config.globalProperties.$router.push('/admin/dashboard')")
  await waitFor("location.pathname==='/dashboard'")
  result.checks.push('Isolated fixture: ordinary user cannot enter admin routes')
  await evaluate("localStorage.setItem('token_expires_at','0')")
  await win.loadURL('https://ravenaiworld.org/dashboard')
  await waitFor("localStorage.getItem('auth_token')==='qa-rotated-access'")
  assert.equal(refreshes, 1)
  result.checks.push('Isolated fixture: expired session performs native refresh rotation')
  await evaluate("document.querySelector('.console-avatar').closest('button').click()")
  await waitFor("Array.from(document.querySelectorAll('button')).some(e=>e.textContent?.includes('退出登录'))")
  await evaluate("Array.from(document.querySelectorAll('button')).find(e=>e.textContent?.includes('退出登录')).click()")
  await waitFor("location.pathname==='/login' && !localStorage.getItem('auth_token')")
  await vault.flush()
  assert.equal((await vault.read()).auth_token, undefined)
  assert.equal(logout, true)
  result.checks.push('Isolated fixture: native sign-out revokes refresh session and clears encrypted credentials')
  result.fixture = { routes: [...new Set(calls.map(call => call.route))], unknown: [...unknown] }
  assert.equal(unknown.size, 0)
  result.checks.push('Test fixtures removed; production release contains no fixture handler')
}
