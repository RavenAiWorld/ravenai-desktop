import type { Page } from '@playwright/test'
import fs from 'node:fs'

// Only the isolated test runner injects these records. None are imported by client/.
export async function setup(page: Page, authenticated = true) {
  const imageData = 'data:' + 'image/png;base64,' + fs.readFileSync('assets/icon.png').toString('base64')
  await page.addInitScript(({ authenticated, imageData }) => {
    const win = window as any
    let id = 0
    const callbacks = new Map(), listeners = new Map()
    const user = { id: 7, username: '视觉验收账号', email: 'desktop-qa@example.invalid', balance: 28.5, concurrency: 5, role: 'user', status: 'active', created_at: '2026-10-01T10:00:00Z' }
    const group = { id: 1, name: 'OpenAI 标准线路', platform: 'openai', status: 'active', rate_multiplier: 0.2, subscription_type: 'standard' }
    const key = { id: 1, key: 'sk-qa-placeholder-never-a-production-key', name: '开发环境', group_id: 1, group, status: 'active', quota: 30, quota_used: 1.26, expires_at: null, created_at: '2026-11-20T12:00:00Z', last_used_at: '2026-11-26T07:00:00Z', ip_whitelist: [], ip_blacklist: [], rate_limit_5h: 0, rate_limit_1d: 0, rate_limit_7d: 0 }
    const usage = { id: 1, request_id: 'qa-request-0001', model: 'gpt-6.1-sol', created_at: '2026-11-26T07:00:00Z', input_tokens: 18500, output_tokens: 1250, cache_read_tokens: 12000, cache_creation_tokens: 500, actual_cost: .01725, total_cost: .08625, rate_multiplier: .2, duration_ms: 2400, first_token_ms: 350, api_key: key, group, billing_mode: 'token' }
    const ticket = { id: 1, title: '调用响应咨询', category: 'api', priority: 'normal', status: 'waiting', request_id: 'qa-request-0001', unread: true, last_message_id: 2, last_message_preview: '请提供请求时间，我们会继续核查。', created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-26T07:00:00Z' }
    const announcements = [
      { id: 1, title: 'Ravenai Desktop v1.00 正式发布', content: '全新暖纸编辑风格与内置 Nova 创作工作台、模型指纹检测、生态应用推荐及自动更新已就绪。', status: 'active', created_at: '2026-11-26T06:00:00Z', is_read: false, read_at: null },
    ]
    const records = { keys: [key], tickets: [ticket], messages: [{ id: 1, author_role: 'user', kind: 'reply', content: '请帮忙检查这条调用记录。', created_at: '2026-11-25T12:00:00Z', attachments: [] }, { id: 2, author_role: 'admin', kind: 'reply', content: '请提供请求时间，我们会继续核查。', created_at: '2026-11-26T07:00:00Z', attachments: [] }] }
    const paged = (items: any[], params: URLSearchParams) => ({ items, total: items.length, page: Number(params.get('page') || 1), page_size: Number(params.get('page_size') || 20), pages: 1 })
    const reportId = '0123456789abcdef0123456789abcdef'
    const oldReportId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const report = (reportId: string) => ({ id: reportId, status: reportId === oldReportId ? 'suspected' : 'passed', completed_at: new Date(Date.now() - (reportId === oldReportId ? 3600000 : 60000)).toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(), stages: [{ key: 'detection', model: 'gpt-6-sol', reasoning_effort: 'max' }, { key: 'text', model: 'gpt-6-sol' }, { key: 'image', model: 'image-model' }], text: { question: '计算 17 乘以 23。', answer: reportId === oldReportId ? '390' : '391', result_label: reportId === oldReportId ? '待复核' : '回答正确', passed: reportId !== oldReportId }, image: { title: '检测图片', url: `/api/v1/model-trace/reports/${reportId}/stages/image` } })
    const nowIso = new Date().toISOString()
    const model = {
      name: 'gpt-6.1-sol',
      platform: 'openai',
      pricing: { billing_mode: 'token', input_price: .000003, output_price: .000015, cache_read_price: .0000003, cache_write_price: null, per_request_price: null, intervals: [] },
      official_pricing: { input_price: .000003, output_price: .000015, cache_read_price: .0000003, cache_write_price: null },
      info: { context_window: 200000, max_output_tokens: 64000, reasoning: true, input_modalities: ['text', 'image'], description: '用于布局与定价验证的测试模型记录。' },
      route_stats: { updated_at: nowIso, stale: false, group_average: false, history: Array(24).fill('operational'), success_rate: .995, latency_ms: 1200, tps: 65 },
    }
    const extraModels = [
      {
        name: 'gpt-5.4',
        platform: 'openai',
        pricing: { billing_mode: 'token', input_price: .000005, output_price: .00002, cache_read_price: .0000005, cache_write_price: .00000625, per_request_price: null, intervals: [] },
        official_pricing: { input_price: .000005, output_price: .00002, cache_read_price: .0000005, cache_write_price: .00000625 },
        info: { context_window: 400000, max_output_tokens: 128000, reasoning: true, input_modalities: ['text', 'image'], description: '通用旗舰推理与代码模型。' },
        route_stats: { updated_at: nowIso, stale: false, group_average: false, history: Array(24).fill('operational'), success_rate: .998, latency_ms: 920, tps: 78 },
      },
      {
        name: 'gpt-5.4-mini',
        platform: 'openai',
        pricing: { billing_mode: 'token', input_price: .000001, output_price: .000004, cache_read_price: .0000001, cache_write_price: null, per_request_price: null, intervals: [] },
        official_pricing: { input_price: .000001, output_price: .000004, cache_read_price: .0000001, cache_write_price: null },
        info: { context_window: 200000, max_output_tokens: 64000, reasoning: false, input_modalities: ['text', 'image'], description: '高性价比轻量快速模型。' },
        route_stats: { updated_at: nowIso, stale: false, group_average: false, history: Array(24).fill('operational'), success_rate: .999, latency_ms: 680, tps: 112 },
      },
      {
        name: 'claude-opus-4.6',
        platform: 'anthropic',
        pricing: { billing_mode: 'token', input_price: .000025, output_price: .000125, cache_read_price: .0000025, cache_write_price: .00003125, per_request_price: null, intervals: [] },
        official_pricing: { input_price: .000025, output_price: .000125, cache_read_price: .0000025, cache_write_price: .00003125 },
        info: { context_window: 200000, max_output_tokens: 32000, reasoning: true, input_modalities: ['text', 'image'], description: '深度复杂推理与长链路 Agent 旗舰模型。' },
        route_stats: { updated_at: nowIso, stale: false, group_average: false, history: Array(24).fill('operational'), success_rate: .992, latency_ms: 1580, tps: 54 },
      },
      {
        name: 'claude-sonnet-4.6',
        platform: 'anthropic',
        pricing: { billing_mode: 'token', input_price: .000012, output_price: .00006, cache_read_price: .0000012, cache_write_price: .000018, per_request_price: null, intervals: [] },
        official_pricing: { input_price: .000012, output_price: .00006, cache_read_price: .0000012, cache_write_price: .000018 },
        info: { context_window: 200000, max_output_tokens: 64000, reasoning: true, input_modalities: ['text', 'image'], description: '日常开发与编码主力均衡模型。' },
        route_stats: { updated_at: nowIso, stale: false, group_average: false, history: Array(24).fill('operational'), success_rate: .996, latency_ms: 1120, tps: 72 },
      },
      {
        name: 'gemini-2.5-pro',
        platform: 'gemini',
        pricing: { billing_mode: 'token', input_price: .00000625, output_price: .00005, cache_read_price: .00000155, cache_write_price: null, per_request_price: null, intervals: [] },
        official_pricing: { input_price: .00000625, output_price: .00005, cache_read_price: .00000155, cache_write_price: null },
        info: { context_window: 1000000, max_output_tokens: 64000, reasoning: true, input_modalities: ['text', 'image'], description: '超长 1M 上下文多模态理解模型。' },
        route_stats: { updated_at: nowIso, stale: false, group_average: false, history: Array(24).fill('operational'), success_rate: .994, latency_ms: 1340, tps: 85 },
      },
      {
        name: 'deepseek-r1',
        platform: 'deepseek',
        pricing: { billing_mode: 'token', input_price: .00000275, output_price: .000011, cache_read_price: .0000007, cache_write_price: null, per_request_price: null, intervals: [] },
        official_pricing: { input_price: .00000275, output_price: .000011, cache_read_price: .0000007, cache_write_price: null },
        info: { context_window: 128000, max_output_tokens: 32000, reasoning: true, input_modalities: ['text'], description: '高性价比开源深度推理模型。' },
        route_stats: { updated_at: nowIso, stale: false, group_average: false, history: Array(24).fill('operational'), success_rate: .988, latency_ms: 1750, tps: 49 },
      },
    ]
    const plazaGroup = { ...group, description: '标准模型线路', peak_rate_enabled: false, image_rate_independent: false, video_rate_independent: false, long_context_pricing_enabled: true, models: [model, ...extraModels] }
    win.qa = { authenticated, calls: [], records, failures: {}, plaza: { description: '', groups: [plazaGroup] }, traceEmpty: false, complete: (success: boolean, error?: string) => { win.qa.authenticated = success; for (const handler of listeners.values()) callbacks.get(handler)?.({ event: 'auth-complete', payload: { success, error } }) } }
    win.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: (_event: string, listener: number) => listeners.delete(listener) }
    win.__TAURI_INTERNALS__ = {
      transformCallback: (callback: any) => { callbacks.set(++id, callback); return id },
      unregisterCallback: (callback: number) => callbacks.delete(callback),
      invoke: async (command: string, args: any = {}) => {
        win.qa.calls.push({ command, args })
        if (command === 'plugin:event|listen') { listeners.set(args.handler, args.handler); return args.handler }
        if (command === 'plugin:event|unlisten') { listeners.delete(args.eventId); return }
        if (command === 'client_state') return { version: '1.0.0', authenticated: win.qa.authenticated, user: win.qa.authenticated ? user : null, server: 'https://ravenaiworld.org' }
        if (command === 'public_settings') return { site_name: 'Ravenai', api_base_url: 'https://api.ravenaiworld.org/v1', registration_enabled: true }
        if (command === 'set_window_theme') return
        if (command === 'window_control') return false
        if (command === 'open_release_page' || command === 'open_ecosystem_url') return
        if (command === 'studio_plugin_credentials_get') return win.qa.pluginCredentials || {}
        if (command === 'studio_plugin_credentials_set') {
          win.qa.pluginCredentials = args.credentials || {}
          return
        }
        if (command === 'check_update') {
          if (win.qa.mockUpdate) return win.qa.mockUpdate
          return {
            current_version: '1.0.0',
            latest_version: '1.0.0',
            display_version: 'v1.00',
            has_update: false,
            release_url: 'https://github.com/RavenAiWorld/ravenai-desktop/releases/tag/v1.0.0',
            download_url: 'https://github.com/RavenAiWorld/ravenai-desktop/releases/download/v1.0.0/Ravenai_1.0.0_x64-setup.exe',
            asset_name: 'Ravenai_1.0.0_x64-setup.exe',
            file_size: 10985497,
            sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            release_notes: '## Ravenai Desktop v1.00\n- 侧边栏统一品牌配色与分组层次\n- 应用推荐展示四款生态项目官方界面与大图预览',
            published_at: '2026-11-26T08:00:00Z',
            source: 'ravenai',
          }
        }
        if (command === 'install_update') return
        if (command === 'detector_status') return { loaded: true, built_at: '2026-11-26T00:00:00Z', cached: true }
        if (command === 'detector_challenges') {
          return [
            { id: 'ch-1', expected_count: 300, prompt: '请凭第一反应输出 300 个 1 到 355 之间的整数，用空格分隔。' },
            { id: 'ch-2', expected_count: 312, prompt: '请凭第一反应输出 312 个 1 到 355 之间的整数，用空格分隔。' },
            { id: 'ch-3', expected_count: 320, prompt: '请凭第一反应输出 320 个 1 到 355 之间的整数，用空格分隔。' },
          ]
        }
        if (command === 'detector_detect' || command === 'detector_analyze') {
          const analysis = {
            decision: 'scored',
            prediction: 'gpt-6.1-sol',
            prediction_name: 'GPT-6.1 Sol',
            family_prediction: 'openai',
            family_prediction_name: 'OpenAI',
            results: [
              { model: 'gpt-6.1-sol', display_name: 'GPT-6.1 Sol', family: 'openai', family_name: 'OpenAI', score: 0.94, probability: 0.962 },
              { model: 'gpt-5.4', display_name: 'GPT-5.4', family: 'openai', family_name: 'OpenAI', score: 0.71, probability: 0.029 },
              { model: 'claude-opus-4.6', display_name: 'Claude Opus 4.6', family: 'anthropic', family_name: 'Anthropic', score: 0.42, probability: 0.009 },
            ],
            ranking_score: 0.94,
            probability: 0.962,
            probability_status: 'reference_calibrated',
            used_outputs: 3,
            diagnostics: [],
            sequence: { autocorrelation: 0.142, small_step_share: 0.18, model_like: true },
            evidence: { insufficient: false, label: 'strong', reason: '', method: 'lmfpd' },
          }
          if (command === 'detector_analyze') return { built_at: '2026-11-26T00:00:00Z', analysis }
          return {
            built_at: '2026-11-26T00:00:00Z',
            result: {
              challenges: [],
              samples: [
                { state: 'complete', text: '', raw_text: '', count: 300, expected_count: 300, first_byte_ms: 380, response_model: 'gpt-6.1-sol', response_id: 'r1', error: null },
                { state: 'complete', text: '', raw_text: '', count: 312, expected_count: 312, first_byte_ms: 410, response_model: 'gpt-6.1-sol', response_id: 'r2', error: null },
                { state: 'complete', text: '', raw_text: '', count: 320, expected_count: 320, first_byte_ms: 395, response_model: 'gpt-6.1-sol', response_id: 'r3', error: null },
              ],
              analysis,
              error: null,
            },
          }
        }
        if (command === 'logout') { win.qa.authenticated = false; return }
        if (command === 'export_csv') return true
        if (command === 'studio_save') return true
        if (command === 'studio_request') {
          const { path, method, body } = args.input
          if (win.qa.failures[path]) throw win.qa.failures[path]
          let data: any, status = 200, contentType = 'application/json'
          if (!win.qa.authenticated) { status = 401; data = { message: '登录已失效' } }
          else if (path === '/auth/me') data = { code: 0, data: user }
          else if (path === '/image-studio/catalog') data = { code: 0, data: { groups: [{ id: 1, name: group.name, models: ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'], prices: { '1K': .05, '2K': .10, '4K': .20 } }], max_images: 4, max_references: 2 } }
          else if (path === '/channels/available') data = { code: 0, data: [{ platforms: [{ platform: 'openai', groups: [group], supported_models: [{ name: 'gpt-6.1-sol' }] }] }] }
          else if (path.endsWith('/queue-status')) data = { concurrencyLimit: 5, configuredConcurrency: 5, processingCount: 0, queuedCount: 0, maxQueueSize: 20, displayConcurrency: 0, displayQueued: 0, acceptingNewTasks: true }
          else if (path.endsWith('/config')) data = { promptGalleryMode: '2', promptGalleryPasswordEnabled: false }
          else if (path.endsWith('/plugins')) data = { plugins: [], failures: [] }
          else if (path.endsWith('/blacklist')) data = { keywords: [] }
          else if (path.endsWith('/prompts')) data = []
          else if (path.endsWith('/tasks') && method === 'POST') {
            win.qa.studioTasks ||= []
            win.qa.studioTasks.push(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(body), ch => ch.charCodeAt(0)))))
            if (win.qa.studioReject) { status = 409; data = { error: '图片价格已变更，请重新确认。' } }
            else data = { taskId: `qa-task-${win.qa.studioTasks.length}` }
          }
          else if (path.endsWith('/ack')) data = { ok: true }
          else if (path.includes('/tasks/')) data = { id: path.split('/').at(-1), status: win.qa.studioPending ? 'processing' : 'completed', result: win.qa.studioPending ? undefined : { images: [`URL:/api/v1/image-studio/nova/images/${path.split('/').at(-1)}/0?ticket=test-fixture`] }, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() }
          else if (path.includes('/images/')) contentType = 'image/png'
          else if (path.endsWith('/proxy/models')) data = { data: [{ id: 'gpt-6.1-sol' }] }
          else if (path.endsWith('/proxy/text')) { contentType = 'text/event-stream'; data = 'data: {"type":"response.output_text.delta","delta":"流式测试"}\n\ndata: {"type":"response.completed"}\n\n' }
          else if (path.endsWith('/proxy/image-edit')) data = { data: [{ b64_json: imageData.split(',')[1] }] }
          else { status = 404; data = { error: `Missing studio fixture: ${path}` } }
          args.events.onmessage({ kind: 'headers', status, headers: { 'content-type': contentType } })
          const bytes = contentType === 'image/png' ? Uint8Array.from(atob(imageData.split(',')[1]), ch => ch.charCodeAt(0)) : new TextEncoder().encode(typeof data === 'string' ? data : JSON.stringify(data))
          for (let start = 0; start < bytes.length; start += 127) args.events.onmessage({ kind: 'chunk', data: btoa(String.fromCharCode(...bytes.subarray(start, start + 127))) })
          args.events.onmessage({ kind: 'end' })
          return
        }
        if (command !== 'api_request') return
        const url = new URL(args.path, 'https://test.invalid'), path = url.pathname, body = args.body || {}, method = args.method
        if (win.qa.failures[path]) throw win.qa.failures[path]
        if (!win.qa.authenticated) throw '登录已失效'
        if (path === '/auth/me') return user
        if (path === '/announcements') return announcements
        if (/^\/announcements\/\d+\/read$/.test(path)) {
          const aid = Number(path.split('/')[2])
          const item = announcements.find(a => a.id === aid)
          if (item) { item.is_read = true; (item as any).read_at = new Date().toISOString() }
          return {}
        }
        if (path === '/support-tickets/summary') return { unread_count: records.tickets.filter(t => t.unread).length, open_count: 1, waiting_count: 1 }
        if (path === '/user/platform-quotas') return { platform_quotas: [] }
        if (path === '/usage/stats') return { total_requests: 1280, total_input_tokens: 14200000, total_output_tokens: 1850000, total_cache_read_tokens: 9600000, total_cache_creation_tokens: 420000, total_tokens: 26070000, total_cost: 68.42, total_actual_cost: 15.84, average_duration_ms: 2150 }
        if (path === '/usage/dashboard/stats') return { total_api_keys: records.keys.length, active_api_keys: 1, total_requests: 14960, total_tokens: 20218000, total_actual_cost: 42.17, today_requests: 128, today_tokens: 1975040, today_actual_cost: .825, average_duration_ms: 2400, rpm: 2 }
        if (path === '/usage/dashboard/trend') return { trend: Array.from({ length: 14 }, (_, i) => ({ date: `2026-11-${String(i + 12).padStart(2, '0')}`, requests: i * 17 + 10, actual_cost: (i % 5 + 1) * .17 })) }
        if (path === '/usage/dashboard/models') return {
          models: [
            { model: 'claude-opus-4.6', requests: 342, input_tokens: 4820000, output_tokens: 610000, total_tokens: 5430000, cost: 24.5, actual_cost: 18.42 },
            { model: 'gpt-6.1-sol', requests: 618, input_tokens: 6410000, output_tokens: 890000, total_tokens: 7300000, cost: 16.2, actual_cost: 11.86 },
            { model: 'gemini-2.5-pro', requests: 215, input_tokens: 3120000, output_tokens: 410000, total_tokens: 3530000, cost: 9.4, actual_cost: 6.54 },
            { model: 'deepseek-r1', requests: 184, input_tokens: 2180000, output_tokens: 320000, total_tokens: 2500000, cost: 5.1, actual_cost: 3.12 },
          ],
        }
        if (path === '/groups/rates') return { 1: 0.2, 3: 0.25 }
        const availableGroups = [
          group,
          { ...group, id: 2, name: '维护中的分组', status: 'maintenance', description: '例行线路维护中' },
          { id: 3, name: 'Claude 专属线路', platform: 'anthropic', status: 'active', rate_multiplier: 0.25, subscription_type: 'standard', description: '高稳定 Claude 专用通道' },
        ]
        if (path === '/groups/available') return availableGroups
        if (path === '/keys' && method === 'POST') { const nextGroup = availableGroups.find(g => g.id === body.group_id) || group; const item = { ...key, ...body, group: nextGroup, id: records.keys.length + 1 }; records.keys.push(item); return item }
        if (path === '/keys') return paged(records.keys.filter(k => (!url.searchParams.get('search') || k.name.includes(url.searchParams.get('search')!)) && (!url.searchParams.get('status') || k.status === url.searchParams.get('status'))), url.searchParams)
        if (/^\/keys\/\d+$/.test(path)) { const keyId = Number(path.split('/').at(-1)), item = records.keys.find(k => k.id === keyId)!; if (method === 'DELETE') { records.keys = records.keys.filter(k => k.id !== keyId); return {} } if (method === 'PUT') { Object.assign(item, body); if ('group_id' in body) item.group = availableGroups.find(g => g.id === body.group_id) || item.group } return item }
        if (path === '/usage') return paged([usage, { ...usage, id: 2, model: 'claude-opus-4.6', input_tokens: 9200, actual_cost: .03546 }], url.searchParams)
        if (path === '/usage/errors') return paged([{ ...usage, status_code: 429, message: '请求超过当前速率限制', key_name: key.name }], url.searchParams)
        if (path.startsWith('/usage/errors/')) return { ...usage, status_code: 429, message: '请求超过当前速率限制', error_body: 'rate_limit_exceeded' }
        if (/^\/usage\/\d+$/.test(path)) return usage
        if (path === '/model-plaza') return win.qa.plaza
        if (path.endsWith('/stages/image')) return imageData
        if (path === '/model-trace' || path.startsWith('/model-trace/reports/')) return { server_time: new Date().toISOString(), report: win.qa.traceEmpty ? null : report(path === '/model-trace' ? reportId : path.split('/').at(-1)!), history: win.qa.traceEmpty ? [] : [report(reportId), report(oldReportId)] }
        if (path === '/payment/orders/my') return paged([{ id: 1, out_trade_no: 'QA20261126001', amount: 20, pay_amount: 140, currency: 'CNY', status: 'PENDING', payment_type: 'alipay', order_type: 'balance', created_at: usage.created_at }], url.searchParams)
        if (path === '/redeem') { user.balance += 10; return { message: '兑换成功', type: 'balance', value: 8, bonus_amount: 2, credited_value: 10, new_balance: user.balance } }
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
  }, { authenticated, imageData })
}
