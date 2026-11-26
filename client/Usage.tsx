import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  BarChart3,
  Calendar,
  Check,
  Clock,
  Columns3,
  Cpu,
  DollarSign,
  Download,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { csv, date, money, native, number, queryPath, useApi } from './native'
import type { ApiKey, ModelStat, Page, Trend, Usage as UsageRow, UsageStats } from './types'
import {
  CopyButton,
  Drawer,
  Empty,
  ErrorMessage,
  KeyValue,
  Loading,
  Pagination,
  SearchInput,
  SelectMenu,
  useAction,
  useNotice,
  type SelectOptionItem,
} from './ui'
import { VendorIcon } from './VendorIcon'

type DatePreset = 'today' | '2d' | '7d' | '14d' | '30d' | 'all' | 'custom'
type ColumnKey = 'group' | 'type' | 'tokens' | 'cache' | 'duration' | 'cost' | 'time'

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'group', label: '分组 / 密钥' },
  { key: 'type', label: '类型' },
  { key: 'tokens', label: '输入 / 输出' },
  { key: 'cache', label: '缓存读 / 写' },
  { key: 'duration', label: '耗时 / 首字' },
  { key: 'cost', label: '费用 (USD)' },
  { key: 'time', label: '时间' },
]

const REQUEST_TYPE_OPTIONS: SelectOptionItem[] = [
  { value: '', label: '全部类型' },
  { value: 'stream', label: '流式 (Stream)' },
  { value: 'sync', label: '同步 (Sync)' },
  { value: 'ws_v2', label: 'WebSocket' },
  { value: 'live', label: 'Live 实时' },
]

const BILLING_MODE_OPTIONS: SelectOptionItem[] = [
  { value: '', label: '全部计费方式' },
  { value: 'token', label: '按 Token' },
  { value: 'per_request', label: '按次' },
  { value: 'image', label: '按图片' },
  { value: 'video', label: '按视频' },
]

const BILLING_TYPE_OPTIONS: SelectOptionItem[] = [
  { value: '', label: '全部计费类型' },
  { value: '0', label: '余额计费' },
  { value: '1', label: '订阅套餐' },
]

const COMPACTION_OPTIONS: SelectOptionItem[] = [
  { value: '', label: '全部压缩模式' },
  { value: 'true', label: '仅原生压缩' },
]

const ERROR_CATEGORY_OPTIONS: SelectOptionItem[] = [
  { value: '', label: '全部错误分类' },
  { value: 'auth', label: '鉴权失败' },
  { value: 'rate_limit', label: '速率限制' },
  { value: 'quota', label: '额度不足' },
  { value: 'invalid_request', label: '无效请求' },
  { value: 'service_unavailable', label: '服务不可用' },
  { value: 'upstream', label: '上游异常' },
  { value: 'internal', label: '内部错误' },
]

const ERROR_STATUS_OPTIONS: SelectOptionItem[] = [
  { value: '', label: '全部状态码' },
  ...['400', '401', '403', '404', '429', '500', '502', '503', '504'].map(code => ({
    value: code,
    label: `HTTP ${code}`,
  })),
]

function formatDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function presetDates(preset: Exclude<DatePreset, 'custom'>): { start: string; end: string } {
  if (preset === 'all') return { start: '', end: '' }
  const end = new Date()
  const start = new Date()
  const offset = preset === 'today' ? 0 : preset === '2d' ? 1 : preset === '7d' ? 6 : preset === '14d' ? 13 : 29
  start.setDate(start.getDate() - offset)
  return { start: formatDay(start), end: formatDay(end) }
}

function compactTokens(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '--'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

function requestTypeLabel(row: UsageRow): string {
  const t = row.request_type
  if (t === 'ws_v2') return 'WS'
  if (t === 'live') return 'Live'
  if (t === 'stream' || row.stream === true) return '流式'
  if (t === 'sync' || row.stream === false) return '同步'
  return row.billing_mode === 'image' ? '生图' : row.billing_mode === 'video' ? '视频' : '标准'
}

export function UsageTable({
  rows,
  onSelect,
  errors = false,
  visibleColumns,
}: {
  rows: UsageRow[]
  errors?: boolean
  onSelect: (row: UsageRow) => void
  visibleColumns?: Set<ColumnKey>
}) {
  const show = (col: ColumnKey) => !visibleColumns || visibleColumns.has(col)
  const isFull = !!visibleColumns

  return (
    <div className="table-scroll">
      <table className="usage-table">
        <thead>
          <tr>
            <th>模型 / 请求</th>
            {errors ? (
              <>
                <th>时间</th>
                <th>状态码</th>
                <th>错误原因</th>
              </>
            ) : (
              <>
                {isFull && show('group') && <th>分组</th>}
                {isFull && show('type') && <th>类型</th>}
                {show('tokens') && <th>输入 / 输出</th>}
                {isFull && show('cache') && <th>缓存读 / 写</th>}
                {show('duration') && <th>耗时</th>}
                {show('cost') && <th className="right">费用 (USD)</th>}
                {show('time') && <th className="right">时间</th>}
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const hasDiscount =
              typeof row.total_cost === 'number' &&
              typeof row.actual_cost === 'number' &&
              row.total_cost > row.actual_cost + 0.000001
            return (
              <tr key={row.id} className="clickable" onClick={() => onSelect(row)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <VendorIcon vendor={row.model || 'other'} size={16} />
                    <div style={{ minWidth: 0 }}>
                      <button
                        type="button"
                        className="text-link mono"
                        onClick={e => {
                          e.stopPropagation()
                          onSelect(row)
                        }}
                      >
                        {row.model || '未知模型'}
                      </button>
                      <small>{row.api_key?.name || row.request_id?.slice(0, 20) || `#${row.id}`}</small>
                    </div>
                  </div>
                </td>

                {errors ? (
                  <>
                    <td className="small muted mono">{date(row.created_at)}</td>
                    <td>
                      <span className={`status-code ${(row.status_code || 500) < 500 ? 'warn' : ''}`}>
                        {row.status_code || '--'}
                      </span>
                    </td>
                    <td className="small">{row.error_message || String(row.message || '暂无详细错误信息')}</td>
                  </>
                ) : (
                  <>
                    {isFull && show('group') && (
                      <td>
                        <span className="pill usage-group-pill" title={row.group?.name || '默认'}>
                          <span className="usage-group-name">{row.group?.name || '默认'}</span>
                          {row.rate_multiplier != null && <strong className="route-rate">×{row.rate_multiplier}</strong>}
                        </span>
                      </td>
                    )}
                    {isFull && show('type') && (
                      <td>
                        <span className="pill pill-mono">{requestTypeLabel(row)}</span>
                      </td>
                    )}
                    {show('tokens') && (
                      <td className="numeric mono">
                        {number(row.input_tokens)} <span className="muted">/ {number(row.output_tokens)}</span>
                      </td>
                    )}
                    {isFull && show('cache') && (
                      <td className="numeric mono small">
                        <span style={{ color: row.cache_read_tokens ? 'var(--green)' : 'var(--muted)' }}>
                          {row.cache_read_tokens ? number(row.cache_read_tokens) : '--'}
                        </span>
                        <span className="muted">
                          {' '}
                          / {row.cache_creation_tokens ? number(row.cache_creation_tokens) : '--'}
                        </span>
                      </td>
                    )}
                    {show('duration') && (
                      <td className="numeric">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span className="pill pill-mono">
                            {row.duration_ms == null ? '--' : `${(row.duration_ms / 1000).toFixed(2)}s`}
                          </span>
                          {row.output_tokens > 0 && row.duration_ms && row.duration_ms > 0 && (
                            <span className="small mono" style={{ color: 'var(--coral-text)', fontWeight: 600 }}>
                              {((row.output_tokens * 1000) / row.duration_ms).toFixed(1)} t/s
                            </span>
                          )}
                        </div>
                        {row.first_token_ms != null && (
                          <small className="mono muted">TTFT {row.first_token_ms}ms</small>
                        )}
                      </td>
                    )}
                    {show('cost') && (
                      <td className="numeric right mono">
                        <strong style={{ fontWeight: 600 }}>{money(row.actual_cost, 6)}</strong>
                        {hasDiscount && (
                          <small className="mono muted" style={{ textDecoration: 'line-through' }}>
                            {money(row.total_cost, 6)}
                          </small>
                        )}
                      </td>
                    )}
                    {show('time') && (
                      <td className="numeric right small muted mono">
                        {date(row.created_at).split(' ')[0]}
                        <small className="mono muted">{date(row.created_at).split(' ')[1] || ''}</small>
                      </td>
                    )}
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function UsageDetail({ row, errors = false, onClose }: { row: UsageRow; errors?: boolean; onClose: () => void }) {
  const query = useApi<UsageRow>(`/usage/${errors ? 'errors/' : ''}${row.id}`)
  const data = query.data || row
  const totalTokens =
    (data.input_tokens || 0) +
    (data.output_tokens || 0) +
    (data.cache_read_tokens || 0) +
    (data.cache_creation_tokens || 0)

  return (
    <Drawer title="请求详情" onClose={onClose}>
      <ErrorMessage error={query.error} />

      {!errors && (
        <div className="spec-grid">
          <div className="spec-tile">
            <span>实付费用</span>
            <strong>{money(data.actual_cost, 6)}</strong>
          </div>
          <div className="spec-tile">
            <span>总耗时</span>
            <strong>{data.duration_ms == null ? '--' : `${(data.duration_ms / 1000).toFixed(2)}s`}</strong>
          </div>
          <div className="spec-tile">
            <span>首字延迟</span>
            <strong>{data.first_token_ms == null ? '--' : `${data.first_token_ms} ms`}</strong>
          </div>
          <div className="spec-tile">
            <span>输出速度 (TPS)</span>
            <strong>
              {data.output_tokens > 0 && data.duration_ms && data.duration_ms > 0
                ? `${((data.output_tokens * 1000) / data.duration_ms).toFixed(1)} t/s`
                : '--'}
            </strong>
          </div>
        </div>
      )}

      {!errors && totalTokens > 0 && (
        <div className="token-bar-wrap">
          <div className="token-bar-head">
            <span>Token 构成</span>
            <strong>{number(totalTokens)}</strong>
          </div>
          <div className="token-stack" aria-hidden="true">
            {data.input_tokens > 0 && (
              <div className="token-seg-in" style={{ width: `${(data.input_tokens / totalTokens) * 100}%` }} />
            )}
            {data.output_tokens > 0 && (
              <div className="token-seg-out" style={{ width: `${(data.output_tokens / totalTokens) * 100}%` }} />
            )}
            {data.cache_read_tokens > 0 && (
              <div className="token-seg-cr" style={{ width: `${(data.cache_read_tokens / totalTokens) * 100}%` }} />
            )}
            {data.cache_creation_tokens > 0 && (
              <div className="token-seg-cw" style={{ width: `${(data.cache_creation_tokens / totalTokens) * 100}%` }} />
            )}
          </div>
          <div className="token-legend">
            <span>
              <i className="token-seg-in" />
              输入 {number(data.input_tokens)}
            </span>
            <span>
              <i className="token-seg-out" />
              输出 {number(data.output_tokens)}
            </span>
            <span>
              <i className="token-seg-cr" />
              缓存读 {number(data.cache_read_tokens)}
            </span>
            <span>
              <i className="token-seg-cw" />
              缓存写 {number(data.cache_creation_tokens)}
            </span>
          </div>
        </div>
      )}

      <div className="kv-group">
        <KeyValue label="请求 ID">
          <code>{data.request_id}</code>
          <CopyButton text={data.request_id || ''} />
        </KeyValue>
        <KeyValue label="模型">
          <code>{data.model}</code>
        </KeyValue>
        <KeyValue label="时间">{date(data.created_at)}</KeyValue>
        {errors ? (
          <KeyValue label="状态码">
            <span className={`status-code ${(data.status_code || 500) < 500 ? 'warn' : ''}`}>
              {data.status_code || '--'}
            </span>
          </KeyValue>
        ) : (
          <>
            <KeyValue label="密钥">{data.api_key?.name || '--'}</KeyValue>
            <KeyValue label="分组">{data.group?.name || '--'}</KeyValue>
            <KeyValue label="请求类型">{requestTypeLabel(data)}</KeyValue>
            <KeyValue label="标准费用">
              <span className="mono">{money(data.total_cost, 6)}</span>
            </KeyValue>
            <KeyValue label="倍率">{data.rate_multiplier ?? '--'}</KeyValue>
            <KeyValue label="计费方式">{data.billing_mode || 'token'}</KeyValue>
            <KeyValue label="响应 / 首字">
              <span className="mono">
                {data.duration_ms ?? '--'} / {data.first_token_ms ?? '--'} ms
              </span>
            </KeyValue>
            <KeyValue label="服务层级">{data.service_tier || '默认'}</KeyValue>
            <KeyValue label="推理强度">{data.reasoning_effort || '默认'}</KeyValue>
          </>
        )}
      </div>

      {errors && (
        <>
          <h3>错误响应体</h3>
          <pre className="error-detail">
            {String(data.error_body || data.error_message || data.message || '暂无详细错误信息')}
          </pre>
        </>
      )}
    </Drawer>
  )
}

export default function Usage() {
  const initialRange = useMemo(() => presetDates('7d'), [])
  const [errors, setErrors] = useState(false)
  const [preset, setPreset] = useState<DatePreset>('7d')
  const [start, setStart] = useState(initialRange.start)
  const [end, setEnd] = useState(initialRange.end)
  const [granularity, setGranularity] = useState<'day' | 'hour'>('day')
  const [showCharts, setShowCharts] = useState(true)
  const [trendMetric, setTrendMetric] = useState<'actual_cost' | 'requests'>('actual_cost')
  const [distMetric, setDistMetric] = useState<'actual_cost' | 'total_tokens'>('actual_cost')
  const [hoveredTrend, setHoveredTrend] = useState<Trend | null>(null)

  // Filter state
  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search)
  const [modelSelect, setModelSelect] = useState('')
  const [keyId, setKeyId] = useState('')
  const [requestType, setRequestType] = useState('')
  const [billingMode, setBillingMode] = useState('')
  const [billingType, setBillingType] = useState('')
  const [compaction, setCompaction] = useState('')
  const [errorCategory, setErrorCategory] = useState('')
  const [statusCode, setStatusCode] = useState('')

  // Table & column state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selected, setSelected] = useState<UsageRow | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set<ColumnKey>(['group', 'type', 'tokens', 'cache', 'duration', 'cost', 'time']),
  )
  const colMenuRef = useRef<HTMLDivElement>(null)

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const activeModel = modelSelect || deferred

  const sharedParams = {
    start_date: start,
    end_date: end,
    api_key_id: keyId,
    model: activeModel,
    request_type: requestType,
    billing_mode: billingMode,
    billing_type: billingType,
    native_compaction_v2: compaction,
    timezone: tz,
  }

  const keys = useApi<Page<ApiKey>>('/keys?page=1&page_size=100')
  const stats = useApi<UsageStats>(queryPath('/usage/stats', sharedParams))
  const trend = useApi<{ trend: Trend[] }>(
    queryPath('/usage/dashboard/trend', { ...sharedParams, granularity }),
    showCharts,
  )
  const modelDist = useApi<{ models: ModelStat[] }>(
    queryPath('/usage/dashboard/models', { ...sharedParams, model_source: 'requested' }),
  )

  const query = useApi<Page<UsageRow>>(
    queryPath(
      errors ? '/usage/errors' : '/usage',
      errors
        ? {
            page,
            page_size: pageSize,
            model: activeModel,
            start_date: start,
            end_date: end,
            api_key_id: keyId,
            category: errorCategory,
            status_code: statusCode,
            timezone: tz,
          }
        : {
            page,
            page_size: pageSize,
            ...sharedParams,
          },
    ),
  )

  const action = useAction()
  const notice = useNotice()

  useEffect(() => {
    if (!columnsOpen) return
    const onDown = (e: MouseEvent) => {
      if (!colMenuRef.current?.contains(e.target as Node)) setColumnsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [columnsOpen])

  const keyOptions = useMemo<SelectOptionItem[]>(
    () => [
      { value: '', label: '全部密钥' },
      ...(keys.data?.items || []).map(k => ({
        value: String(k.id),
        label: k.name,
        description: k.group?.name,
      })),
    ],
    [keys.data],
  )

  const modelOptions = useMemo<SelectOptionItem[]>(() => {
    const names = new Set<string>()
    for (const m of modelDist.data?.models || []) if (m.model) names.add(m.model)
    for (const r of query.data?.items || []) if (r.model) names.add(r.model)
    if (modelSelect) names.add(modelSelect)
    return [
      { value: '', label: '全部模型' },
      ...[...names].sort().map(name => ({
        value: name,
        label: name,
        icon: <VendorIcon vendor={name} size={14} />,
      })),
    ]
  }, [modelDist.data, query.data, modelSelect])

  const trendRows = trend.data?.trend || []
  const trendMax = Math.max(...trendRows.map(r => Number(r[trendMetric]) || 0), 0.001)
  const activePoint = hoveredTrend || trendRows[trendRows.length - 1] || null

  const rankedModels = useMemo(() => {
    return [...(modelDist.data?.models || [])]
      .sort((a, b) => (Number(b[distMetric]) || 0) - (Number(a[distMetric]) || 0))
      .slice(0, 6)
  }, [modelDist.data, distMetric])
  const maxDistVal = Number(rankedModels[0]?.[distMetric]) || 1

  const totalCacheRead = stats.data?.total_cache_read_tokens ?? stats.data?.total_cache_tokens ?? 0
  const totalInput = (stats.data?.total_input_tokens ?? 0) + totalCacheRead
  const cacheHitPct = totalInput > 0 ? `${((totalCacheRead / totalInput) * 100).toFixed(1)}%` : '--'
  const statsHasDiscount =
    stats.data && stats.data.total_cost > stats.data.total_actual_cost + 0.0001

  function applyPreset(next: Exclude<DatePreset, 'custom'>) {
    const range = presetDates(next)
    setPreset(next)
    setStart(range.start)
    setEnd(range.end)
    setGranularity(next === 'today' || next === '2d' ? 'hour' : 'day')
    setPage(1)
  }

  function resetAll() {
    const range = presetDates('7d')
    setPreset('7d')
    setStart(range.start)
    setEnd(range.end)
    setGranularity('day')
    setSearch('')
    setModelSelect('')
    setKeyId('')
    setRequestType('')
    setBillingMode('')
    setBillingType('')
    setCompaction('')
    setErrorCategory('')
    setStatusCode('')
    setPage(1)
  }

  function refreshAll() {
    void query.refetch()
    void stats.refetch()
    void modelDist.refetch()
    if (showCharts) void trend.refetch()
  }

  function toggleColumn(col: ColumnKey) {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })
  }

  return (
    <>
      {/* 1. Sub2API-aligned Period KPI Summary Cards */}
      <div className="metrics-grid" style={{ marginBottom: 14 }}>
        <div className="metric-card featured">
          <div className="metric-top">
            <span className="metric-label">区间实付消费</span>
            <span className="metric-icon">
              <DollarSign size={14} />
            </span>
          </div>
          <strong className="metric-value">{money(stats.data?.total_actual_cost, 4)}</strong>
          <div className="metric-foot">
            {statsHasDiscount ? (
              <span className="mono" style={{ textDecoration: 'line-through' }}>
                标准 {money(stats.data?.total_cost, 4)}
              </span>
            ) : (
              <span>按当前筛选统计</span>
            )}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">区间请求数</span>
            <span className="metric-icon">
              <Activity size={14} />
            </span>
          </div>
          <strong className="metric-value">{number(stats.data?.total_requests)}</strong>
          <div className="metric-foot">
            <span>共 {number(query.data?.total)} 条明细</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">总 Token 用量</span>
            <span className="metric-icon">
              <Cpu size={14} />
            </span>
          </div>
          <strong className="metric-value">{compactTokens(stats.data?.total_tokens)}</strong>
          <div className="metric-foot">
            <span className="mono">
              入 {compactTokens(stats.data?.total_input_tokens)} · 出 {compactTokens(stats.data?.total_output_tokens)}
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">平均耗时 / 缓存</span>
            <span className="metric-icon">
              <Clock size={14} />
            </span>
          </div>
          <strong className="metric-value">
            {stats.data?.average_duration_ms ? `${(stats.data.average_duration_ms / 1000).toFixed(2)}s` : '--'}
          </strong>
          <div className="metric-foot">
            <span>缓存命中 {cacheHitPct}</span>
          </div>
        </div>
      </div>

      {/* 2. Date Range Presets + Granularity + Chart Toggle */}
      <div className="card usage-range-bar">
        <div className="usage-range-left">
          <Calendar size={14} className="muted" />
          <div className="preset-pills" role="group" aria-label="快捷时间范围">
            {(
              [
                ['today', '今天'],
                ['2d', '近 2 天'],
                ['7d', '近 7 天'],
                ['14d', '近 14 天'],
                ['30d', '近 30 天'],
                ['all', '全部'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`preset-pill ${preset === id ? 'active' : ''}`}
                onClick={() => applyPreset(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="usage-date-inputs">
            <input
              aria-label="开始日期"
              type="date"
              value={start}
              max={end || undefined}
              onChange={e => {
                setPreset('custom')
                setStart(e.target.value)
                setPage(1)
              }}
            />
            <span className="muted small">至</span>
            <input
              aria-label="结束日期"
              type="date"
              value={end}
              min={start || undefined}
              onChange={e => {
                setPreset('custom')
                setEnd(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>

        <div className="usage-range-right">
          <SelectMenu
            ariaLabel="统计粒度"
            className="compact"
            minWidth={102}
            value={granularity}
            options={[
              { value: 'day', label: '按天' },
              { value: 'hour', label: '按小时' },
            ]}
            onChange={v => setGranularity(v as 'day' | 'hour')}
          />
          <button
            type="button"
            className={`toggle-pill ${showCharts ? 'active' : ''}`}
            style={{ minHeight: 32 }}
            onClick={() => setShowCharts(v => !v)}
          >
            <BarChart3 size={14} />
            {showCharts ? '收起图表' : '展开图表'}
          </button>
        </div>
      </div>

      {/* 3. Trend + Model Distribution Charts */}
      {showCharts && (
        <div className="analytics-grid" style={{ marginBottom: 14 }}>
          <section className="card">
            <div className="card-header compact">
              <h2>消费与请求趋势</h2>
              <div className="segmented" role="group" aria-label="趋势指标">
                <button
                  type="button"
                  className={trendMetric === 'actual_cost' ? 'selected' : ''}
                  onClick={() => setTrendMetric('actual_cost')}
                >
                  消费
                </button>
                <button
                  type="button"
                  className={trendMetric === 'requests' ? 'selected' : ''}
                  onClick={() => setTrendMetric('requests')}
                >
                  请求
                </button>
              </div>
            </div>
            <div className="chart-body" style={{ paddingTop: 10 }}>
              {trend.isPending ? (
                <Loading />
              ) : !trendRows.length ? (
                <Empty title="当前区间暂无趋势数据" />
              ) : (
                <>
                  <div className="chart-meta-row" style={{ marginBottom: 6 }}>
                    <span className="chart-hint">悬停查看明细</span>
                    {activePoint && (
                      <div className="chart-tooltip">
                        <span className="mono">{activePoint.date}</span>
                        <strong>
                          {trendMetric === 'actual_cost'
                            ? money(activePoint.actual_cost, 4)
                            : `${number(activePoint.requests)} 次`}
                        </strong>
                        <span className="muted">
                          {trendMetric === 'actual_cost'
                            ? `${number(activePoint.requests)} 次请求`
                            : money(activePoint.actual_cost, 4)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="chart" style={{ height: 156 }} onMouseLeave={() => setHoveredTrend(null)}>
                    <div className="chart-scale">
                      <span>{trendMetric === 'actual_cost' ? money(trendMax, 2) : number(trendMax)}</span>
                      <span>{trendMetric === 'actual_cost' ? money(trendMax / 2, 2) : number(Math.round(trendMax / 2))}</span>
                      <span>0</span>
                    </div>
                    <div className="bars">
                      {trendRows.map((row, i) => {
                        const value = Number(row[trendMetric]) || 0
                        const active = activePoint?.date === row.date
                        return (
                          <div
                            key={row.date}
                            className={`bar-slot ${active ? 'active' : ''}`}
                            onMouseEnter={() => setHoveredTrend(row)}
                          >
                            <div className="bar" style={{ height: `${Math.max(3, (value / trendMax) * 100)}%` }} />
                            <span>
                              {i % Math.max(1, Math.floor(trendRows.length / 6)) === 0 ? row.date.slice(5, 10) : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header compact">
              <h2>模型分布 Top 6</h2>
              <div className="segmented" role="group" aria-label="模型分布指标">
                <button
                  type="button"
                  className={distMetric === 'actual_cost' ? 'selected' : ''}
                  onClick={() => setDistMetric('actual_cost')}
                >
                  实付
                </button>
                <button
                  type="button"
                  className={distMetric === 'total_tokens' ? 'selected' : ''}
                  onClick={() => setDistMetric('total_tokens')}
                >
                  Token
                </button>
              </div>
            </div>
            {modelDist.isPending ? (
              <Loading />
            ) : rankedModels.length ? (
              <div className="rank-list">
                <div className="rank-row head">
                  <span className="rank-name">模型</span>
                  <span className="rank-num">请求</span>
                  <span className="rank-num">{distMetric === 'actual_cost' ? '实付' : 'Token'}</span>
                </div>
                {rankedModels.map(m => {
                  const share = Math.max(4, ((Number(m[distMetric]) || 0) / maxDistVal) * 100)
                  return (
                    <div key={m.model} className="rank-row">
                      <span className="rank-bar" style={{ width: `${Math.min(100, share)}%` }} aria-hidden="true" />
                      <span className="rank-name">
                        <VendorIcon vendor={m.model} size={14} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.model}</span>
                      </span>
                      <span className="rank-num muted">{number(m.requests)}</span>
                      <span className="rank-num">
                        {distMetric === 'actual_cost' ? money(m.actual_cost, 3) : compactTokens(m.total_tokens)}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Empty title="当前区间暂无模型数据" />
            )}
          </section>
        </div>
      )}

      {/* 4. Tabs + Full Custom Filter Bar + Column Settings + Export */}
      <div className="card usage-filter-card">
        <div className="usage-filter-top">
          <div className="segmented" role="tablist" aria-label="日志视图">
            <button
              type="button"
              role="tab"
              aria-selected={!errors}
              className={!errors ? 'selected' : ''}
              onClick={() => {
                setErrors(false)
                setPage(1)
              }}
            >
              调用记录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={errors}
              className={errors ? 'selected' : ''}
              onClick={() => {
                setErrors(true)
                setPage(1)
              }}
            >
              错误请求
            </button>
          </div>

          <span className="spacer" />

          <button type="button" onClick={refreshAll} disabled={query.isFetching}>
            <RefreshCw size={14} className={query.isFetching ? 'spin' : ''} />
            刷新
          </button>
          <button type="button" onClick={resetAll}>
            <RotateCcw size={14} />
            重置
          </button>

          {!errors && (
            <div className="column-menu-wrap" ref={colMenuRef}>
              <button type="button" onClick={() => setColumnsOpen(v => !v)}>
                <Columns3 size={14} />
                列设置
              </button>
              {columnsOpen && (
                <div className="column-popover" role="menu" aria-label="显示列设置">
                  {ALL_COLUMNS.map(col => {
                    const active = visibleColumns.has(col.key)
                    return (
                      <button
                        key={col.key}
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={active}
                        className={`column-popover-item ${active ? 'active' : ''}`}
                        onClick={() => toggleColumn(col.key)}
                      >
                        <span>{col.label}</span>
                        {active && <Check size={14} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="primary"
            disabled={!query.data?.items.length || action.busy}
            onClick={() =>
              action.run(async () => {
                const rows = query.data!.items
                const result = await native<boolean>('export_csv', {
                  content: csv(
                    errors
                      ? [
                          ['时间', '模型', '请求 ID', '状态码', '错误原因'],
                          ...rows.map(r => [
                            r.created_at,
                            r.model,
                            r.request_id,
                            r.status_code,
                            r.error_message || r.message,
                          ]),
                        ]
                      : [
                          ['时间', '模型', '分组', '密钥', '请求 ID', '输入 Token', '输出 Token', '缓存读', '实付 USD', '标准 USD', '耗时 ms'],
                          ...rows.map(r => [
                            r.created_at,
                            r.model,
                            r.group?.name || '',
                            r.api_key?.name || '',
                            r.request_id,
                            r.input_tokens,
                            r.output_tokens,
                            r.cache_read_tokens,
                            r.actual_cost,
                            r.total_cost,
                            r.duration_ms,
                          ]),
                        ],
                  ),
                })
                if (result) notice('当前页已导出')
              })
            }
          >
            <Download size={14} />
            导出当前页
          </button>
        </div>

        <div className="usage-filter-controls">
          <SelectMenu
            ariaLabel="筛选密钥"
            value={keyId}
            options={keyOptions}
            searchable
            searchPlaceholder="搜索 API 密钥..."
            minWidth={170}
            onChange={v => {
              setKeyId(v)
              setPage(1)
            }}
          />

          <SelectMenu
            ariaLabel="筛选模型"
            value={modelSelect}
            options={modelOptions}
            searchable
            searchPlaceholder="搜索模型 ID..."
            minWidth={185}
            onChange={v => {
              setModelSelect(v)
              if (v) setSearch('')
              setPage(1)
            }}
          />

          <SearchInput
            placeholder="关键字筛选模型"
            value={search}
            onChange={v => {
              setSearch(v)
              if (v) setModelSelect('')
              setPage(1)
            }}
          />

          {errors ? (
            <>
              <SelectMenu
                ariaLabel="错误分类"
                value={errorCategory}
                options={ERROR_CATEGORY_OPTIONS}
                minWidth={155}
                onChange={v => {
                  setErrorCategory(v)
                  setPage(1)
                }}
              />
              <SelectMenu
                ariaLabel="HTTP 状态码"
                value={statusCode}
                options={ERROR_STATUS_OPTIONS}
                minWidth={145}
                onChange={v => {
                  setStatusCode(v)
                  setPage(1)
                }}
              />
            </>
          ) : (
            <>
              <SelectMenu
                ariaLabel="请求类型"
                value={requestType}
                options={REQUEST_TYPE_OPTIONS}
                minWidth={145}
                onChange={v => {
                  setRequestType(v)
                  setPage(1)
                }}
              />
              <SelectMenu
                ariaLabel="计费方式"
                value={billingMode}
                options={BILLING_MODE_OPTIONS}
                minWidth={145}
                onChange={v => {
                  setBillingMode(v)
                  setPage(1)
                }}
              />
              <SelectMenu
                ariaLabel="计费类型"
                value={billingType}
                options={BILLING_TYPE_OPTIONS}
                minWidth={145}
                onChange={v => {
                  setBillingType(v)
                  setPage(1)
                }}
              />
              <SelectMenu
                ariaLabel="原生压缩"
                value={compaction}
                options={COMPACTION_OPTIONS}
                minWidth={145}
                onChange={v => {
                  setCompaction(v)
                  setPage(1)
                }}
              />
            </>
          )}
        </div>
      </div>

      <ErrorMessage error={action.error || query.error} retry={() => query.refetch()} />

      <div className="table-card">
        {query.isPending ? (
          <Loading label="正在加载调用明细" />
        ) : !query.data?.items.length ? (
          !query.error && (
            <Empty
              icon={<Activity size={20} />}
              title="当前条件下暂无请求"
              detail="可以点击「重置」恢复默认筛选，或扩大日期范围查看历史记录。"
            />
          )
        ) : (
          <>
            <UsageTable
              errors={errors}
              rows={query.data.items}
              visibleColumns={errors ? undefined : visibleColumns}
              onSelect={setSelected}
            />
            <Pagination
              page={page}
              total={query.data.total}
              size={pageSize}
              onChange={setPage}
              onSizeChange={next => {
                setPageSize(next)
                setPage(1)
              }}
            />
          </>
        )}
      </div>

      {selected && <UsageDetail row={selected} errors={errors} onClose={() => setSelected(null)} />}
    </>
  )
}
