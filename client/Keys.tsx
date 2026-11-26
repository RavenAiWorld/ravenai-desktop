import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import { api, date, money, queryPath, useApi } from './native'
import type { ApiKey, CustomEndpoint, Group, Page } from './types'
import {
  Badge,
  CopyButton,
  Drawer,
  Empty,
  ErrorMessage,
  Field,
  IconButton,
  KeyValue,
  Loading,
  Pagination,
  SearchInput,
  SelectMenu,
  Switch,
  useAction,
  useNotice,
  type SelectOptionItem,
} from './ui'
import { VendorIcon } from './VendorIcon'
import { buildSetupBlocks, splitEndpoints, type SetupClient, type SetupShell } from './keySetup'

const STATUS_FILTER_OPTIONS: SelectOptionItem[] = [
  { value: '', label: '全部状态' },
  { value: 'active', label: '正常' },
  { value: 'inactive', label: '已停用' },
  { value: 'expired', label: '已过期' },
  { value: 'quota_exhausted', label: '额度用尽' },
]

export default function Keys({
  baseUrl,
  customEndpoints = [],
}: {
  baseUrl: string
  customEndpoints?: CustomEndpoint[]
}) {
  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<ApiKey | null>(null)
  const [setupKey, setSetupKey] = useState<ApiKey | null>(null)
  const [edit, setEdit] = useState<ApiKey | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ApiKey | null>(null)
  const query = useApi<Page<ApiKey>>(queryPath('/keys', { page, page_size: 20, search: deferred, status }))
  const groupsQuery = useApi<Group[]>('/groups/available?include_maintenance=true')
  const ratesQuery = useApi<Record<string, number>>('/groups/rates')
  const action = useAction()
  const cache = useQueryClient()
  const notice = useNotice()
  const ep = splitEndpoints(baseUrl)
  const availableGroups = groupsQuery.data || []
  const userRates = ratesQuery.data || {}

  return (
    <>
      <section className="endpoint-panel" aria-label="API 接入端点">
        <div className="endpoint-panel-head">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Link2 size={14} />
            API 接入地址
          </span>
          <span className="small muted">OpenAI 含 /v1 · Anthropic 不含 /v1</span>
        </div>
        <div className="endpoint-panel-rows">
          <div className="endpoint-item">
            <div>
              <span>OpenAI / Codex 兼容格式</span>
              <code>{ep.openai}</code>
            </div>
            <CopyButton text={ep.openai} label="复制 OpenAI 端点" />
          </div>
          <div className="endpoint-item">
            <div>
              <span>Anthropic / Claude Code 格式</span>
              <code>{ep.anthropic}</code>
            </div>
            <CopyButton text={ep.anthropic} label="复制 Anthropic 端点" />
          </div>
          {customEndpoints.map((item, idx) => (
            <div key={idx} className="endpoint-item">
              <div>
                <span>{item.name}</span>
                <code>{item.endpoint}</code>
              </div>
              <CopyButton text={item.endpoint} label={`复制 ${item.name}`} />
            </div>
          ))}
        </div>
      </section>

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={v => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="搜索密钥名称"
        />
        <SelectMenu
          ariaLabel="密钥状态"
          value={status}
          options={STATUS_FILTER_OPTIONS}
          minWidth={146}
          onChange={v => {
            setStatus(v)
            setPage(1)
          }}
        />
        <span className="spacer" />
        <button className="primary" onClick={() => setEdit('new')}>
          <Plus size={16} />
          创建密钥
        </button>
      </div>

      <ErrorMessage error={query.error} retry={() => query.refetch()} />

      <div className="table-card">
        {query.isPending ? (
          <Loading label="正在加载密钥列表" />
        ) : !query.data?.items.length ? (
          !query.error && (
            <Empty
              icon={<KeyRound size={20} />}
              title="暂无 API 密钥"
              detail="创建一个密钥并绑定分组，即可在 Claude Code、Codex CLI 或其他工具中一键接入。"
            />
          )
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>名称 / 密钥</th>
                    <th>分组（点击切换）</th>
                    <th>状态</th>
                    <th>已用 / 限额</th>
                    <th>最近使用</th>
                    <th className="right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map(key => {
                    const ratio = key.quota > 0 ? Math.min(100, (key.quota_used / key.quota) * 100) : 0
                    const fillTone = ratio >= 90 ? 'danger' : ratio >= 70 ? 'warn' : ''
                    return (
                      <tr key={key.id}>
                        <td>
                          <button className="text-link" onClick={() => setSelected(key)}>
                            {key.name}
                          </button>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <small className="mono" style={{ marginTop: 0, whiteSpace: 'nowrap' }}>
                              {key.key.slice(0, 7)}...{key.key.slice(-4)}
                            </small>
                            <CopyButton text={key.key} label="复制密钥" />
                          </div>
                        </td>
                        <td>
                          <InlineGroupPicker
                            apiKey={key}
                            groups={availableGroups}
                            loadingGroups={groupsQuery.isPending}
                            userRates={userRates}
                            onChanged={async nextGroup => {
                              await cache.invalidateQueries({ queryKey: ['/keys'] })
                              await query.refetch()
                              notice(`已切换「${key.name}」至 ${nextGroup.name}`)
                            }}
                          />
                        </td>
                        <td>
                          <Badge value={key.status} />
                        </td>
                        <td>
                          <div className="quota-cell numeric">
                            <span className="mono" style={{ fontSize: 12.5 }}>
                              {money(key.quota_used)}{' '}
                              <span className="muted">/ {key.quota ? money(key.quota) : '不限'}</span>
                            </span>
                            {key.quota > 0 && (
                              <div className="quota-track" aria-hidden="true">
                                <div className={`quota-fill ${fillTone}`} style={{ width: `${ratio}%` }} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="muted small mono">{date(key.last_used_at)}</td>
                        <td>
                          <div className="row-actions">
                            <IconButton label="接入配置" onClick={() => setSetupKey(key)}>
                              <Terminal size={15} />
                            </IconButton>
                            <IconButton label="查看密钥" onClick={() => setSelected(key)}>
                              <KeyRound size={15} />
                            </IconButton>
                            <IconButton label="编辑密钥" onClick={() => setEdit(key)}>
                              <Pencil size={15} />
                            </IconButton>
                            <IconButton
                              label="删除密钥"
                              onClick={() => {
                                action.setError('')
                                setDeleting(key)
                              }}
                            >
                              <Trash2 size={15} />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={query.data.total} onChange={setPage} />
          </>
        )}
      </div>

      {setupKey && <UseKeyDrawer item={setupKey} baseUrl={baseUrl} onClose={() => setSetupKey(null)} />}
      {selected && (
        <KeyDetails
          item={selected}
          baseUrl={baseUrl}
          onOpenSetup={() => {
            const target = selected
            setSelected(null)
            setSetupKey(target)
          }}
          onClose={() => setSelected(null)}
        />
      )}
      {edit && (
        <KeyEditor
          item={edit}
          userRates={userRates}
          onClose={() => setEdit(null)}
          onSaved={msg => {
            setEdit(null)
            void cache.invalidateQueries()
            notice(msg || '密钥已保存')
          }}
        />
      )}
      {deleting && (
        <Drawer title="删除 API 密钥" onClose={() => !action.busy && setDeleting(null)}>
          <p>删除「{deleting.name}」后，使用此密钥的应用将无法继续调用。此操作不可恢复。</p>
          <ErrorMessage error={action.error} />
          <div className="form-actions">
            <button onClick={() => setDeleting(null)} disabled={action.busy}>
              保留密钥
            </button>
            <button
              className="danger"
              disabled={action.busy}
              onClick={() =>
                action.run(async () => {
                  await api(`/keys/${deleting.id}`, 'DELETE')
                  setDeleting(null)
                  await cache.invalidateQueries()
                  notice('密钥已删除')
                })
              }
            >
              {action.busy ? '正在删除...' : '删除密钥'}
            </button>
          </div>
        </Drawer>
      )}
    </>
  )
}

function InlineGroupPicker({
  apiKey,
  groups,
  loadingGroups,
  userRates,
  onChanged,
}: {
  apiKey: ApiKey
  groups: Group[]
  loadingGroups: boolean
  userRates: Record<string, number>
  onChanged: (group: Group) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(
    null,
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const listedGroup = groups.find(g => g.id === apiKey.group_id)
  const currentGroup = apiKey.group?.id === apiKey.group_id ? apiKey.group : listedGroup
  const effectiveRate = (g?: Group | null) => {
    if (!g) return null
    const custom = userRates[String(g.id)]
    return typeof custom === 'number' && Number.isFinite(custom) ? custom : g.rate_multiplier
  }
  const currentRate = effectiveRate(currentGroup)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(g => `${g.name} ${g.platform} ${g.description || ''}`.toLowerCase().includes(q))
  }, [groups, filter])

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pad = 10
    const width = Math.min(360, window.innerWidth - pad * 2)
    const left = Math.max(pad, Math.min(rect.left, window.innerWidth - width - pad))
    const below = window.innerHeight - rect.bottom - pad - 6
    const above = rect.top - pad - 6
    const opensAbove = below < 240 && above > below
    const maxHeight = Math.max(160, Math.min(380, opensAbove ? above : below))
    setPos(
      opensAbove
        ? { bottom: Math.max(pad, window.innerHeight - rect.top + 6), left, width, maxHeight }
        : { top: Math.max(pad, rect.bottom + 6), left, width, maxHeight },
    )
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    searchRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const onRelayout = () => updatePosition()
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onRelayout)
    window.addEventListener('scroll', onRelayout, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onRelayout)
      window.removeEventListener('scroll', onRelayout, true)
    }
  }, [open])

  async function selectGroup(group: Group) {
    if (saving || group.status === 'maintenance') return
    if (group.id === apiKey.group_id) {
      setOpen(false)
      return
    }
    setSaving(true)
    setError('')
    try {
      await api(`/keys/${apiKey.id}`, 'PUT', { group_id: group.id })
      setOpen(false)
      setFilter('')
      await onChanged(group)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`group-picker-btn ${open ? 'open' : ''}`}
        aria-label={`切换分组：${apiKey.name}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="点击快捷切换密钥分组"
        disabled={saving}
        onClick={() => {
          setError('')
          setFilter('')
          setOpen(v => !v)
        }}
      >
        {currentGroup && <VendorIcon vendor={currentGroup.platform} size={14} />}
        <span className="group-picker-name">{currentGroup?.name || '默认分组'}</span>
        {currentRate != null && <span className="route-rate">×{currentRate}</span>}
        {saving ? <LoaderCircle size={13} className="spin muted" /> : <ChevronDown size={13} className="muted" />}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="group-popover"
            role="dialog"
            aria-label={`选择 ${apiKey.name} 的分组`}
            style={{
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
            }}
          >
            <div className="group-popover-search">
              <Search size={14} className="muted" />
              <input
                ref={searchRef}
                type="text"
                aria-label="搜索可用分组"
                placeholder="搜索分组名称或说明..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                disabled={saving}
              />
              <button
                type="button"
                className="icon-button"
                aria-label="关闭分组选择"
                onClick={() => setOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            {error && (
              <div style={{ padding: '8px 10px 0' }}>
                <ErrorMessage error={error} />
              </div>
            )}

            <div className="group-popover-list" role="listbox" aria-label="可用分组列表">
              {loadingGroups ? (
                <div className="group-popover-empty">正在读取可用分组...</div>
              ) : !filtered.length ? (
                <div className="group-popover-empty">{filter ? '未找到匹配的分组' : '暂无可用分组'}</div>
              ) : (
                filtered.map(group => {
                  const selected = group.id === apiKey.group_id
                  const disabled = saving || (group.status === 'maintenance' && !selected)
                  const rate = effectiveRate(group)
                  return (
                    <button
                      key={group.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={disabled}
                      className={`group-popover-option ${selected ? 'selected' : ''}`}
                      onClick={() => void selectGroup(group)}
                    >
                      <VendorIcon vendor={group.platform} size={16} />
                      <span className="group-popover-option-body">
                        <span className="group-popover-option-head">
                          <strong>{group.name}</strong>
                          {rate != null && <span className="route-rate">×{rate}</span>}
                          {group.status === 'maintenance' && <Badge value="maintenance" />}
                        </span>
                        {group.description && <small>{group.description}</small>}
                      </span>
                      {selected && <Check size={15} className="group-popover-check" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function UseKeyDrawer({ item, baseUrl, onClose }: { item: ApiKey; baseUrl: string; onClose: () => void }) {
  const platform = item.group?.platform || 'openai'
  const defaultClient: SetupClient =
    platform === 'anthropic' ? 'claude' : platform === 'gemini' ? 'gemini' : 'codex'
  const [client, setClient] = useState<SetupClient>(defaultClient)
  const [shell, setShell] = useState<SetupShell>('powershell')
  const [revealKey, setRevealKey] = useState(false)
  const query = useApi<ApiKey>(`/keys/${item.id}`)
  const fullKey = query.data?.key || item.key
  const displayKey = revealKey ? fullKey : `${fullKey.slice(0, 7)}••••••••••••••••${fullKey.slice(-4)}`

  const blocks = buildSetupBlocks(client, shell, baseUrl, fullKey, platform)
  const displayBlocks = buildSetupBlocks(client, shell, baseUrl, displayKey, platform)

  return (
    <Drawer title={`接入配置 · ${item.name}`} onClose={onClose} wide>
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <span className="pill">{item.group?.name || '默认分组'}</span>
        <span className="spacer" />
        <button type="button" onClick={() => setRevealKey(v => !v)}>
          {revealKey ? <EyeOff size={14} /> : <Eye size={14} />}
          {revealKey ? '隐藏明文密钥' : '显示明文密钥'}
        </button>
      </div>

      <div className="tabs" role="tablist" aria-label="客户端工具">
        {(
          [
            ['claude', 'Claude Code'],
            ['codex', 'Codex CLI'],
            ['opencode', 'OpenCode'],
            ['gemini', 'Gemini CLI'],
            ['python', 'Python SDK'],
            ['curl', 'cURL'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={client === id}
            className={client === id ? 'selected' : ''}
            onClick={() => setClient(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {(client === 'claude' || client === 'codex' || client === 'gemini') && (
        <div style={{ marginBottom: 14 }}>
          <div className="segmented" role="group" aria-label="系统环境">
            {(
              [
                ['powershell', 'Windows PowerShell'],
                ['cmd', 'Windows CMD'],
                ['unix', 'macOS / Linux'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className={shell === id ? 'selected' : ''} onClick={() => setShell(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {displayBlocks.map((block, idx) => (
        <div key={idx}>
          {block.hint && <p className="small muted" style={{ marginBottom: 8 }}>{block.hint}</p>}
          <div className="code-block">
            <div className="code-block-head">
              <span>{block.path}</span>
              <CopyButton text={blocks[idx].content} label={`复制 ${block.path}（含完整密钥）`} />
            </div>
            <pre>
              <code>{block.content}</code>
            </pre>
          </div>
        </div>
      ))}
    </Drawer>
  )
}

function KeyDetails({
  item,
  baseUrl,
  onOpenSetup,
  onClose,
}: {
  item: ApiKey
  baseUrl: string
  onOpenSetup: () => void
  onClose: () => void
}) {
  const [reveal, setReveal] = useState(false)
  const query = useApi<ApiKey>(`/keys/${item.id}`)
  const key = query.data || item
  const ep = splitEndpoints(baseUrl)

  return (
    <Drawer title={key.name} onClose={onClose}>
      <ErrorMessage error={query.error} />
      <div className="secret">
        <code>{reveal ? key.key : `${key.key.slice(0, 7)}${'*'.repeat(24)}${key.key.slice(-4)}`}</code>
        <IconButton label={reveal ? '隐藏密钥' : '显示密钥'} onClick={() => setReveal(!reveal)}>
          {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
        </IconButton>
        <CopyButton text={key.key} label="复制 API 密钥" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <button type="button" className="primary" style={{ width: '100%' }} onClick={onOpenSetup}>
          <Terminal size={15} />
          生成客户端一键接入配置（Claude Code / Codex / OpenCode）
        </button>
      </div>

      <div className="kv-group">
        <KeyValue label="OpenAI 端点">
          <code>{ep.openai}</code>
          <CopyButton text={ep.openai} />
        </KeyValue>
        <KeyValue label="Anthropic 端点">
          <code>{ep.anthropic}</code>
          <CopyButton text={ep.anthropic} />
        </KeyValue>
        <KeyValue label="分组">{key.group?.name || '默认分组'}</KeyValue>
        <KeyValue label="状态">
          <Badge value={key.status} />
        </KeyValue>
        <KeyValue label="已用额度">
          <span className="mono">{money(key.quota_used, 4)}</span>
        </KeyValue>
        <KeyValue label="额度上限">
          <span className="mono">{key.quota ? money(key.quota) : '不限'}</span>
        </KeyValue>
        <KeyValue label="到期时间">{key.expires_at ? date(key.expires_at) : '永久有效'}</KeyValue>
        <KeyValue label="创建时间">{date(key.created_at)}</KeyValue>
        <KeyValue label="IP 白名单">{key.ip_whitelist?.join(', ') || '不限'}</KeyValue>
        <KeyValue label="IP 黑名单">{key.ip_blacklist?.join(', ') || '无'}</KeyValue>
      </div>

      <h3>速率限制窗口</h3>
      <div className="spec-grid three">
        {(
          [
            ['5 小时', key.rate_limit_5h],
            ['1 天', key.rate_limit_1d],
            ['7 天', key.rate_limit_7d],
          ] as const
        ).map(([name, limit]) => (
          <div className="spec-tile" key={name}>
            <span>{name}</span>
            <strong>{limit ? money(limit) : '不限'}</strong>
          </div>
        ))}
      </div>
    </Drawer>
  )
}

function localDateTime(value: Date | string | null) {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : new Date(value.getTime())
  if (!Number.isFinite(d.getTime())) return ''
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function validateCustomKey(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '请输入自定义密钥'
  if (trimmed.length < 16) return '自定义密钥至少需要 16 个字符'
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return '自定义密钥只能包含字母、数字、下划线和连字符'
  return ''
}

function KeyEditor({
  item,
  userRates = {},
  onClose,
  onSaved,
}: {
  item: ApiKey | 'new'
  userRates?: Record<string, number>
  onClose: () => void
  onSaved: (message?: string) => void
}) {
  const key = item === 'new' ? null : item
  const groups = useApi<Group[]>('/groups/available?include_maintenance=true')
  const action = useAction()
  const cache = useQueryClient()
  const notice = useNotice()

  const [name, setName] = useState(key?.name || '')
  const [group, setGroup] = useState(String(key?.group_id || ''))
  const [status, setStatus] = useState(key?.status === 'inactive' ? 'inactive' : 'active')

  // Sub2API-aligned collapsible feature toggles
  const [useCustomKey, setUseCustomKey] = useState(false)
  const [customKey, setCustomKey] = useState('')
  const [enableIp, setEnableIp] = useState(
    !!(key?.ip_whitelist?.length || key?.ip_blacklist?.length),
  )
  const [white, setWhite] = useState(key?.ip_whitelist?.join('\n') || '')
  const [black, setBlack] = useState(key?.ip_blacklist?.join('\n') || '')

  const [quota, setQuota] = useState(key?.quota || 0)

  const [enableRateLimit, setEnableRateLimit] = useState(
    !!(key && (key.rate_limit_5h > 0 || key.rate_limit_1d > 0 || key.rate_limit_7d > 0)),
  )
  const [limits, setLimits] = useState([key?.rate_limit_5h || 0, key?.rate_limit_1d || 0, key?.rate_limit_7d || 0])

  const [enableExpiration, setEnableExpiration] = useState(!!key?.expires_at)
  const [expPreset, setExpPreset] = useState<'7' | '30' | '90' | 'custom'>(key?.expires_at ? 'custom' : '30')
  const [expires, setExpires] = useState(localDateTime(key?.expires_at || null))

  const selectedGroup = groups.data?.find(g => String(g.id) === group)
  const customKeyError = !key && useCustomKey ? validateCustomKey(customKey) : ''

  const groupOptions = useMemo<SelectOptionItem[]>(() => {
    const opts: SelectOptionItem[] = [{ value: '', label: '默认分组', description: '不指定固定分组，使用账号默认路由' }]
    for (const g of groups.data || []) {
      const rate = typeof userRates[String(g.id)] === 'number' ? userRates[String(g.id)] : g.rate_multiplier
      opts.push({
        value: String(g.id),
        label: g.name,
        description: g.description,
        icon: <VendorIcon vendor={g.platform} size={15} />,
        meta: (
          <>
            {rate != null && <span className="route-rate">×{rate}</span>}
            {g.status === 'maintenance' && <Badge value="maintenance" />}
          </>
        ),
        disabled: g.status === 'maintenance' && key?.group_id !== g.id,
        keywords: `${g.platform} ${g.name} ${g.description || ''}`,
      })
    }
    return opts
  }, [groups.data, userRates, key?.group_id])

  const applyExpirationPreset = (preset: '7' | '30' | '90') => {
    setExpPreset(preset)
    const base = key?.expires_at && Date.parse(key.expires_at) > Date.now() ? new Date(key.expires_at) : new Date()
    base.setDate(base.getDate() + Number(preset))
    setExpires(localDateTime(base))
  }

  return (
    <Drawer title={key ? '编辑 API 密钥' : '创建 API 密钥'} onClose={() => !action.busy && onClose()}>
      <form
        onSubmit={e => {
          e.preventDefault()
          if (customKeyError) {
            action.setError(customKeyError)
            return
          }
          void action.run(async () => {
            const parseIps = (text: string) =>
              text
                .split(/[\n,]+/)
                .map(s => s.trim())
                .filter(Boolean)

            const payload: Record<string, unknown> = {
              name: name.trim(),
              group_id: group ? Number(group) : null,
              quota: quota > 0 ? quota : 0,
              ip_whitelist: enableIp ? parseIps(white) : [],
              ip_blacklist: enableIp ? parseIps(black) : [],
              rate_limit_5h: enableRateLimit && limits[0] > 0 ? limits[0] : 0,
              rate_limit_1d: enableRateLimit && limits[1] > 0 ? limits[1] : 0,
              rate_limit_7d: enableRateLimit && limits[2] > 0 ? limits[2] : 0,
            }

            if (key) {
              payload.status = status
              payload.expires_at = enableExpiration && expires ? new Date(expires).toISOString() : ''
            } else {
              if (useCustomKey && customKey.trim()) payload.custom_key = customKey.trim()
              if (enableExpiration && expires) {
                const diffDays = Math.ceil((new Date(expires).getTime() - Date.now()) / 86_400_000)
                payload.expires_in_days = diffDays > 0 ? diffDays : 1
              }
            }

            await api(key ? `/keys/${key.id}` : '/keys', key ? 'PUT' : 'POST', payload)
            onSaved(key ? '密钥已更新' : '密钥创建成功')
          })
        }}
      >
        <Field label="名称">
          <input
            required
            maxLength={100}
            autoFocus
            placeholder="例如：Claude Code 日常开发"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Field>

        <div className="field">
          <span>分组</span>
          <SelectMenu
            ariaLabel="分组"
            value={group}
            options={groupOptions}
            searchable
            searchPlaceholder="搜索分组名称或说明..."
            placeholder={groups.isPending ? '正在加载可用分组...' : '选择分组'}
            disabled={groups.isPending}
            className="full"
            onChange={setGroup}
          />
        </div>
        <ErrorMessage error={groups.error} retry={() => groups.refetch()} />
        {selectedGroup?.status === 'maintenance' && <p className="muted small">该分组正在维护，暂时无法使用。</p>}

        {/* Custom Key (Create Mode Only — Sub2API parity) */}
        {!key && (
          <div className="form-section">
            <Switch
              label="自定义密钥"
              hint="留空则由系统自动生成安全随机密钥"
              checked={useCustomKey}
              onChange={setUseCustomKey}
            />
            {useCustomKey && (
              <div style={{ marginTop: 10 }}>
                <input
                  className="mono"
                  style={{ width: '100%' }}
                  placeholder="输入自定义密钥（至少 16 个字符）"
                  value={customKey}
                  maxLength={128}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={e => setCustomKey(e.target.value)}
                />
                <small className={customKeyError ? 'error-text' : 'muted'} style={{ display: 'block', marginTop: 5 }}>
                  {customKeyError || '仅允许字母、数字、下划线和连字符，最少 16 个字符。'}
                </small>
              </div>
            )}
          </div>
        )}

        {/* Status (Edit Mode Only) */}
        {key && (
          <div className="field">
            <span>启用状态</span>
            <SelectMenu
              ariaLabel="启用状态"
              value={status}
              className="full"
              options={[
                { value: 'active', label: '启用', description: '允许此密钥正常发起 API 调用' },
                { value: 'inactive', label: '停用', description: '临时冻结此密钥，暂停所有请求' },
              ]}
              onChange={setStatus}
            />
          </div>
        )}

        {/* Quota Limit (Always visible, 0 = unlimited — Sub2API parity) */}
        <div className="form-section">
          <div className="field">
            <span>额度上限 (USD)</span>
            <div className="input-prefix">
              <span>$</span>
              <input
                aria-label="额度上限 (USD)"
                type="number"
                min="0"
                step="0.01"
                value={quota}
                onChange={e => setQuota(Number(e.target.value) || 0)}
              />
            </div>
            <small>填写 0 表示不限制此密钥总额度</small>
          </div>

          {key && key.quota > 0 && (
            <div className="inline-usage-box">
              <div>
                <span className="small muted">已用额度</span>
                <strong className="mono numeric">
                  {money(key.quota_used, 4)} <span className="muted">/ {money(key.quota)}</span>
                </strong>
              </div>
              <button
                type="button"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await api(`/keys/${key.id}`, 'PUT', { reset_quota: true })
                    await cache.invalidateQueries()
                    notice('已重置密钥已用额度')
                  })
                }
              >
                <RotateCcw size={13} />
                重置已用
              </button>
            </div>
          )}
        </div>

        {/* Rate Limit Section (Collapsible Switch — Sub2API parity) */}
        <div className="form-section">
          <Switch
            label="速率限制"
            hint="按 5 小时 / 1 天 / 7 天滑动窗口限制消费上限"
            checked={enableRateLimit}
            onChange={setEnableRateLimit}
          />
          {enableRateLimit && (
            <div style={{ marginTop: 12 }}>
              <div className="form-grid three">
                {(['5 小时 (USD)', '1 天 (USD)', '7 天 (USD)'] as const).map((title, i) => (
                  <div className="field" key={title}>
                    <span>{title}</span>
                    <div className="input-prefix">
                      <span>$</span>
                      <input
                        aria-label={title}
                        type="number"
                        min="0"
                        step="0.01"
                        value={limits[i]}
                        onChange={e =>
                          setLimits(old => old.map((v, j) => (i === j ? Math.max(0, Number(e.target.value) || 0) : v)))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              {key && (key.rate_limit_5h > 0 || key.rate_limit_1d > 0 || key.rate_limit_7d > 0) && (
                <button
                  type="button"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      await api(`/keys/${key.id}`, 'PUT', { reset_rate_limit_usage: true })
                      await cache.invalidateQueries()
                      notice('已重置速率限制窗口用量')
                    })
                  }
                >
                  <RotateCcw size={13} />
                  重置速率限制用量
                </button>
              )}
            </div>
          )}
        </div>

        {/* IP Restriction Section (Collapsible Switch — Sub2API parity) */}
        <div className="form-section">
          <Switch
            label="IP 限制"
            hint="限制允许或禁止访问的客户端 IP / CIDR"
            checked={enableIp}
            onChange={setEnableIp}
          />
          {enableIp && (
            <div style={{ marginTop: 12 }}>
              <Field label="IP 白名单" hint="每行一个 IP 或 CIDR，留空表示不限">
                <textarea rows={3} className="mono" value={white} onChange={e => setWhite(e.target.value)} />
              </Field>
              <Field label="IP 黑名单" hint="每行一个 IP 或 CIDR，命中后将拒绝访问">
                <textarea rows={3} className="mono" value={black} onChange={e => setBlack(e.target.value)} />
              </Field>
            </div>
          )}
        </div>

        {/* Expiration Section (Collapsible Switch + Quick Presets — Sub2API parity) */}
        <div className="form-section">
          <Switch
            label="密钥有效期"
            hint="关闭表示永久有效；开启可快捷设置过期时间"
            checked={enableExpiration}
            onChange={next => {
              setEnableExpiration(next)
              if (next && !expires) applyExpirationPreset('30')
            }}
          />
          {enableExpiration && (
            <div style={{ marginTop: 12 }}>
              <div className="preset-pills" style={{ marginBottom: 12 }}>
                {(['7', '30', '90'] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`preset-pill ${expPreset === d ? 'active' : ''}`}
                    onClick={() => applyExpirationPreset(d)}
                  >
                    {key ? `+${d} 天` : `${d} 天`}
                  </button>
                ))}
                <button
                  type="button"
                  className={`preset-pill ${expPreset === 'custom' ? 'active' : ''}`}
                  onClick={() => setExpPreset('custom')}
                >
                  自定义
                </button>
              </div>
              <Field label="过期时间" hint="选择此 API 密钥的本地过期时间">
                <input
                  type="datetime-local"
                  value={expires}
                  onChange={e => {
                    setExpPreset('custom')
                    setExpires(e.target.value)
                  }}
                />
              </Field>
              {key?.expires_at && (
                <p className="small muted mono" style={{ marginBottom: 0 }}>
                  当前过期时间：{date(key.expires_at)}
                </p>
              )}
            </div>
          )}
        </div>

        <ErrorMessage error={action.error} />
        <div className="form-actions">
          <button type="button" onClick={onClose} disabled={action.busy}>
            取消
          </button>
          <button className="primary" disabled={action.busy || groups.isPending || !!groups.error || !name.trim()}>
            {action.busy ? '正在保存...' : '保存密钥'}
          </button>
        </div>
      </form>
    </Drawer>
  )
}
