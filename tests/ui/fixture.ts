import type { Page } from '@playwright/test'

// Only the isolated test runner injects these records. None are imported by client/.
export async function setup(page: Page, authenticated = true) {
  await page.addInitScript(({ authenticated }) => {
    const win = window as any
    let id = 0
    const callbacks = new Map(), listeners = new Map()
    const user = { id: 7, username: '视觉验收账号', email: 'desktop-qa@example.invalid', balance: 28.5, concurrency: 5, role: 'user', status: 'active', created_at: '2026-10-01T10:00:00Z' }
    const group = { id: 1, name: 'OpenAI 标准线路', platform: 'openai', status: 'active', rate_multiplier: 0.2, subscription_type: 'standard' }
    const key = { id: 1, key: 'sk-qa-placeholder-never-a-production-key', name: '开发环境', group_id: 1, group, status: 'active', quota: 30, quota_used: 1.26, expires_at: null, created_at: '2026-11-20T12:00:00Z', last_used_at: '2026-11-26T07:00:00Z', ip_whitelist: [], ip_blacklist: [], rate_limit_5h: 0, rate_limit_1d: 0, rate_limit_7d: 0 }
    const usage = { id: 1, request_id: 'qa-request-0001', model: 'gpt-6.1-sol', created_at: '2026-11-26T07:00:00Z', input_tokens: 18500, output_tokens: 1250, cache_read_tokens: 12000, cache_creation_tokens: 500, actual_cost: .01725, total_cost: .08625, rate_multiplier: .2, duration_ms: 2400, first_token_ms: 350, api_key: key, group, billing_mode: 'token' }
    const ticket = { id: 1, title: '调用响应咨询', category: 'api', priority: 'normal', status: 'waiting', request_id: 'qa-request-0001', unread: true, last_message_id: 2, last_message_preview: '请提供请求时间，我们会继续核查。', created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-26T07:00:00Z' }
    const records = { keys: [key], tickets: [ticket], messages: [{ id: 1, author_role: 'user', kind: 'reply', content: '请帮忙检查这条调用记录。', created_at: '2026-11-25T12:00:00Z', attachments: [] }, { id: 2, author_role: 'admin', kind: 'reply', content: '请提供请求时间，我们会继续核查。', created_at: '2026-11-26T07:00:00Z', attachments: [] }] }
    const paged = (items: any[], params: URLSearchParams) => ({ items, total: items.length, page: Number(params.get('page') || 1), page_size: Number(params.get('page_size') || 20), pages: 1 })
    win.qa = { authenticated, calls: [], records, failures: {}, complete: (success: boolean, error?: string) => { win.qa.authenticated = success; for (const handler of listeners.values()) callbacks.get(handler)?.({ event: 'auth-complete', payload: { success, error } }) } }
    win.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: (_event: string, listener: number) => listeners.delete(listener) }
    win.__TAURI_INTERNALS__ = {
      transformCallback: (callback: any) => { callbacks.set(++id, callback); return id },
      unregisterCallback: (callback: number) => callbacks.delete(callback),
      invoke: async (command: string, args: any = {}) => {
        win.qa.calls.push({ command, args })
        if (command === 'plugin:event|listen') { listeners.set(args.handler, args.handler); return args.handler }
        if (command === 'plugin:event|unlisten') { listeners.delete(args.eventId); return }
        if (command === 'client_state') return { version: '3.0.0', authenticated: win.qa.authenticated, user: win.qa.authenticated ? user : null, server: 'https://ravenaiworld.org' }
        if (command === 'public_settings') return { site_name: 'Ravenai', api_base_url: 'https://api.ravenaiworld.org/v1', registration_enabled: true }
        if (command === 'logout') { win.qa.authenticated = false; return }
        if (command === 'export_csv') return true
        if (command !== 'api_request') return
        const url = new URL(args.path, 'https://test.invalid'), path = url.pathname, body = args.body || {}, method = args.method
        if (win.qa.failures[path]) throw win.qa.failures[path]
        if (!win.qa.authenticated) throw '登录已失效'
        if (path === '/auth/me') return user
        if (path === '/usage/dashboard/stats') return { total_api_keys: records.keys.length, active_api_keys: 1, total_requests: 14960, total_tokens: 20218000, total_actual_cost: 42.17, today_requests: 128, today_tokens: 1975040, today_actual_cost: .825, average_duration_ms: 2400, rpm: 2 }
        if (path === '/usage/dashboard/trend') return { trend: Array.from({ length: 14 }, (_, i) => ({ date: `2026-11-${String(i + 12).padStart(2, '0')}`, requests: i * 17 + 10, actual_cost: (i % 5 + 1) * .17 })) }
        if (path === '/groups/available') return [group, { ...group, id: 2, name: '维护中的分组', status: 'maintenance' }]
        if (path === '/keys' && method === 'POST') { const item = { ...key, ...body, id: records.keys.length + 1 }; records.keys.push(item); return item }
        if (path === '/keys') return paged(records.keys.filter(k => (!url.searchParams.get('search') || k.name.includes(url.searchParams.get('search')!)) && (!url.searchParams.get('status') || k.status === url.searchParams.get('status'))), url.searchParams)
        if (/^\/keys\/\d+$/.test(path)) { const keyId = Number(path.split('/').at(-1)), item = records.keys.find(k => k.id === keyId)!; if (method === 'DELETE') { records.keys = records.keys.filter(k => k.id !== keyId); return {} } if (method === 'PUT') Object.assign(item, body); return item }
        if (path === '/usage') return paged([usage, { ...usage, id: 2, model: 'claude-opus-4.6', input_tokens: 9200, actual_cost: .03546 }], url.searchParams)
        if (path === '/usage/errors') return paged([{ ...usage, status_code: 429, message: '请求超过当前速率限制', key_name: key.name }], url.searchParams)
        if (path.startsWith('/usage/errors/')) return { ...usage, status_code: 429, message: '请求超过当前速率限制', error_body: 'rate_limit_exceeded' }
        if (/^\/usage\/\d+$/.test(path)) return usage
        if (path === '/model-plaza') return { description: '', groups: [{ ...group, description: '标准模型线路', peak_rate_enabled: false, image_rate_independent: false, video_rate_independent: false, long_context_pricing_enabled: true, models: [{ name: 'gpt-6.1-sol', platform: 'openai', pricing: { billing_mode: 'token', input_price: .000003, output_price: .000015, cache_read_price: .0000003, cache_write_price: null, per_request_price: null, intervals: [] }, official_pricing: null, info: { context_window: 200000, max_output_tokens: 64000, description: '用于布局与定价验证的测试模型记录。' } }] }] }
        if (path === '/payment/orders/my') return paged([{ id: 1, out_trade_no: 'QA20261126001', amount: 20, pay_amount: 140, currency: 'CNY', status: 'PENDING', payment_type: 'alipay', order_type: 'balance', created_at: usage.created_at }], url.searchParams)
        if (path === '/redeem') { user.balance += 10; return { message: '兑换成功', new_balance: user.balance } }
        if (path === '/redeem/history') return paged([{ id: 1, type: 'balance', value: 10, used_at: usage.created_at }], url.searchParams)
        if (path === '/subscriptions/summary') return { active_count: 1, subscriptions: [{ id: 1, group_name: group.name, status: 'active', daily_progress: 25, weekly_progress: 16, monthly_progress: 8, expires_at: '2026-12-26T12:00:00Z' }] }
        if (path === '/user/aff') return { aff_code: 'qa-code', aff_count: 3, aff_quota: 2, aff_history_quota: 10, effective_rebate_rate_percent: 10, invitees: [] }
        if (path === '/user' && method === 'PUT') { Object.assign(user, body); return user }
        if (path === '/support-tickets' && method === 'POST') { const item = { ...ticket, ...body, id: records.tickets.length + 1 }; records.tickets.push(item); return { id: item.id } }
        if (path === '/support-tickets') return paged(records.tickets, url.searchParams)
        if (/^\/support-tickets\/\d+$/.test(path)) { const ticketId = Number(path.split('/').at(-1)), item = records.tickets.find(t => t.id === ticketId)!; if (method === 'PATCH') Object.assign(item, body); return { ticket: item, messages: records.messages } }
        if (path.endsWith('/replies')) { records.messages.push({ id: records.messages.length + 1, author_role: 'user', kind: 'reply', content: body.content, created_at: usage.created_at, attachments: [] }); return {} }
        if (path.endsWith('/read') || path.endsWith('/cancel') || path.endsWith('/transfer')) return {}
        throw `No isolated fixture for ${method} ${path}`
      },
    }
  }, { authenticated })
}
