import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Radio, RefreshCw } from 'lucide-react'
import { date, useApi } from './native'
import { Empty, ErrorMessage, IconButton, Loading, SearchInput, SelectMenu } from './ui'
import { VendorIcon } from './VendorIcon'
import type { ModelPlazaResponse } from './pricing/modelPlaza'
import {
  bucketHistory,
  buildChannelRows,
  filterChannelRows,
  historyState,
  median,
  modelState,
  monitoringShare,
  snapshotFresh,
  type ChannelState,
  type HistoryState,
} from './status/statusData'

const STATE_LABELS: Record<ChannelState, string> = {
  operational: '正常',
  degraded: '部分异常',
  failed: '不可用',
  maintenance: '维护中',
  unknown: '暂无有效数据',
}

const PLATFORM_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude',
  gemini: 'Gemini',
  antigravity: 'Gemini',
  grok: 'Grok',
  deepseek: 'DeepSeek',
  zhipu: 'GLM',
  kimi: 'Kimi',
  minimax: 'MiniMax',
}

export function StatusLabel({ state }: { state: ChannelState }) {
  return (
    <span className={`channel-state state-pill state-${state}`} data-state={state}>
      {STATE_LABELS[state]}
    </span>
  )
}

function formatPct(value: number | null | undefined) {
  return value != null && Number.isFinite(value) && value >= 0 && value <= 1 ? `${(value * 100).toFixed(2)}%` : '--'
}

function formatMs(value: number | null | undefined) {
  return value != null && Number.isFinite(value) && value > 0 ? `${Math.round(value)} ms` : '--'
}

function formatTps(value: number | null | undefined) {
  return value != null && Number.isFinite(value) && value > 0 ? `${value.toFixed(1)} tok/s` : '--'
}

function formatShortTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function HistoryBars({
  values,
  hourly,
  updatedAt,
}: {
  values: HistoryState[]
  hourly: boolean
  updatedAt: number | null
}) {
  const buckets = bucketHistory(values, hourly)
  const step = (hourly ? 60 : 15) * 60_000
  return (
    <div
      className="channel-history history-bars"
      role="list"
      aria-label="最近 6 小时监测记录"
      style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
    >
      {buckets.map((state, i) => {
        const end = updatedAt == null ? null : updatedAt - (buckets.length - 1 - i) * step
        const time =
          end == null
            ? '时间未知'
            : `${date(new Date(end - step).toISOString())} - ${new Date(end).toLocaleTimeString('zh-CN', { hour12: false })}`
        return (
          <span
            role="listitem"
            tabIndex={0}
            key={i}
            data-state={state}
            className={`history-slot state-${state}`}
            title={`${time}：${STATE_LABELS[state]}`}
            aria-label={`${time}：${STATE_LABELS[state]}`}
          />
        )
      })}
    </div>
  )
}

function LatencySparkline({
  samples,
  value,
  state,
}: {
  samples: number[]
  value: number | null
  state: ChannelState
}) {
  const max = Math.max(1, ...samples)
  const points = samples.map((v, i) => ({
    x: samples.length === 1 ? 114 : 4 + (i * 110) / (samples.length - 1),
    y: 23 - (v / max) * 15,
  }))
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const lastY = points[points.length - 1]?.y ?? 14

  return (
    <span className="latency-reading" data-state={state} title="模型平均延迟的中位数（基于最新监测快照）">
      {samples.length > 0 ? (
        <svg className="latency-svg" viewBox="0 0 120 28" aria-hidden="true">
          {samples.length > 1 && <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" />}
          <circle cx="114" cy={lastY} r="6" fill="currentColor" opacity="0.18" />
          <circle cx="114" cy={lastY} r="2.6" fill="currentColor" />
        </svg>
      ) : (
        <span className="latency-svg" />
      )}
      <strong className="mono numeric" style={{ fontSize: 12.5, fontWeight: 500 }}>
        {formatMs(value)}
      </strong>
    </span>
  )
}

export default function ChannelStatus({ onModels }: { onModels: (group: string) => void }) {
  const query = useApi<ModelPlazaResponse>('/model-plaza')
  const [now, setNow] = useState(Date.now())
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [platform, setPlatform] = useState('all')
  const [hourly, setHourly] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const all = useMemo(() => buildChannelRows(query.data?.groups || [], now), [query.data, now])
  const rows = useMemo(
    () => filterChannelRows(all, search, stateFilter, platform),
    [all, search, stateFilter, platform],
  )
  const platforms = useMemo(() => [...new Set(all.map(row => row.group.platform))], [all])
  const healthyCount = all.filter(row => row.state === 'operational').length
  const unknownCount = all.filter(row => row.state === 'unknown').length
  const issues = all.filter(row => ['degraded', 'failed', 'maintenance'].includes(row.state))
  const latestUpdate = Math.max(0, ...all.map(row => row.updatedAt ?? 0))

  const overallTone: ChannelState = issues.length
    ? 'degraded'
    : !all.length || unknownCount
      ? 'unknown'
      : 'operational'
  const overallMessage = !all.length
    ? '暂无可监测渠道'
    : issues.length
      ? `检测到 ${issues.length} 个渠道存在异常或维护`
      : unknownCount
        ? `部分渠道暂无有效数据（${healthyCount} / ${all.length} 正常）`
        : '已监测渠道运行正常'

  const toggle = (id: number) =>
    setExpanded(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const states: ChannelState[] = ['operational', 'degraded', 'failed', 'maintenance', 'unknown']

  return (
    <>
      <div className="status-top">
        <div className="overall-status" data-state={overallTone} aria-live="polite">
          <strong>
            <span className="overall-dot" />
            {overallMessage}
          </strong>
          <span className="snapshot-meta">
            <span>{latestUpdate > 0 ? `快照更新于 ${formatShortTime(latestUpdate)}` : '等待快照更新'}</span>
          </span>
        </div>
      </div>

      <div className="status-summary">
        <div className="status-summary-card">
          <span>过去 6 小时监测正常率</span>
          <strong>{formatPct(monitoringShare(all, 24))}</strong>
        </div>
        <div className="status-summary-card">
          <span>模型平均延迟中位数</span>
          <strong>{formatMs(median(all.flatMap(r => r.latencySamples)))}</strong>
        </div>
        <div className="status-summary-card">
          <span>输出速度中位数 (TPS)</span>
          <strong>{formatTps(median(all.flatMap(r => r.tpsSamples)))}</strong>
        </div>
        <div className="status-summary-card">
          <span>运行正常</span>
          <strong>
            {healthyCount} / {all.length}
          </strong>
        </div>
        <div className="status-summary-card">
          <span>近 1 小时监测正常率</span>
          <strong>{formatPct(monitoringShare(all, 4))}</strong>
        </div>
      </div>

      <div className="toolbar filter-bar">
        <SearchInput value={search} onChange={setSearch} placeholder="搜索渠道或模型" />
        <SelectMenu
          ariaLabel="渠道状态筛选"
          value={stateFilter}
          minWidth={145}
          options={[
            { value: 'all', label: '全部状态' },
            ...Object.entries(STATE_LABELS).map(([key, label]) => ({ value: key, label })),
          ]}
          onChange={setStateFilter}
        />
        <SelectMenu
          ariaLabel="渠道平台"
          value={platform}
          minWidth={145}
          options={[
            { value: 'all', label: '全部平台' },
            ...platforms.map(value => ({
              value,
              label: PLATFORM_LABELS[value] || value,
              icon: <VendorIcon vendor={value} size={14} />,
            })),
          ]}
          onChange={setPlatform}
        />
        <span className="spacer" />
        <div className="segmented" aria-label="监测粒度">
          <button type="button" className={!hourly ? 'selected' : ''} onClick={() => setHourly(false)}>
            15 分钟
          </button>
          <button type="button" className={hourly ? 'selected' : ''} onClick={() => setHourly(true)}>
            1 小时
          </button>
        </div>
        <IconButton label="刷新渠道状态" disabled={query.isFetching} onClick={() => query.refetch()}>
          <RefreshCw size={16} className={query.isFetching ? 'spin' : ''} />
        </IconButton>
      </div>

      <ErrorMessage error={query.error} retry={() => query.refetch()} />

      <section className="table-card">
        {query.isPending ? (
          <Loading label="正在读取渠道监测快照" />
        ) : !rows.length ? (
          !query.error && (
            <Empty icon={<Radio size={19} />} title="没有符合条件的渠道" detail="可清空筛选条件查看全部渠道。" />
          )
        ) : (
          <>
            <div className="status-row-grid status-row-head">
              <span>渠道</span>
              <span>当前状态</span>
              <span>延迟 / 生成速度</span>
              <span>最近 6 小时</span>
              <span className="right">正常时段</span>
            </div>

            <div className="channel-list">
              {rows.map(row => {
                const isOpen = expanded.has(row.group.id)
                return (
                  <section className="channel-row" key={row.group.id}>
                    <div className="status-row-grid status-row-item">
                      <button
                        type="button"
                        className="channel-name channel-btn"
                        aria-expanded={isOpen}
                        title={row.group.name}
                        onClick={() => toggle(row.group.id)}
                      >
                        {isOpen ? <ChevronDown size={15} className="muted" /> : <ChevronRight size={15} className="muted" />}
                        <VendorIcon vendor={row.group.platform} size={17} />
                        <span>
                          <strong>{row.group.name}</strong>
                          <small>
                            {PLATFORM_LABELS[row.group.platform] || row.group.platform} · {row.group.models.length} 个模型
                          </small>
                        </span>
                      </button>

                      <div>
                        <StatusLabel state={row.state} />
                      </div>

                      <div className="channel-perf-cell">
                        <LatencySparkline samples={row.latencySamples} value={row.latencyMedian} state={row.state} />
                        <div className="mono numeric channel-tps" title="该渠道最新监测快照的输出速度中位数">
                          <span className="muted">TPS</span>
                          <strong>{formatTps(row.tpsMedian)}</strong>
                        </div>
                      </div>

                      <div className="channel-timeline history-wrap">
                        <HistoryBars values={row.history} hourly={hourly} updatedAt={row.updatedAt} />
                        <div className="timeline-caption history-axis">
                          <span>最近 6 小时</span>
                          <span>
                            正常时段 {row.healthyShare == null ? '--' : `${(row.healthyShare * 100).toFixed(1)}%`} · 覆盖{' '}
                            {row.coverage}/24
                          </span>
                        </div>
                      </div>

                      <div className="right mono numeric" style={{ fontWeight: 600 }}>
                        {formatPct(row.healthyShare)}
                      </div>
                    </div>

                    <div className="channel-foot">
                      <span>
                        监测更新：{row.updatedAt == null ? '暂无数据' : date(new Date(row.updatedAt).toISOString())}
                        {!row.fresh && row.updatedAt != null ? ' · 数据已过期或不完整' : ''}
                      </span>
                      <button type="button" className="text-link small" onClick={() => onModels(String(row.group.id))}>
                        查看模型与价格
                        <ChevronRight size={13} />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="channel-detail-panel">
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>模型</th>
                                <th>状态</th>
                                <th>近 6 小时</th>
                                <th className="right">成功率</th>
                                <th className="right">平均延迟</th>
                                <th className="right">生成速度</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.group.models.map(model => {
                                const stats = model.route_stats
                                const fresh = snapshotFresh(stats, now)
                                return (
                                  <tr key={`${model.platform}:${model.name}`}>
                                    <td>
                                      <code>{model.name}</code>
                                      {stats?.group_average && <small className="muted">分组平均数据</small>}
                                    </td>
                                    <td>
                                      <StatusLabel state={modelState(model, row.group, now)} />
                                    </td>
                                    <td className="model-history">
                                      <HistoryBars
                                        values={Array.from({ length: 24 }, (_, i) => historyState(stats?.history[i]))}
                                        hourly={hourly}
                                        updatedAt={stats ? Date.parse(stats.updated_at) : null}
                                      />
                                    </td>
                                    <td className="right mono numeric">
                                      {fresh && stats?.success_rate != null && stats.success_rate >= 0 && stats.success_rate <= 1
                                        ? `${(stats.success_rate * 100).toFixed(2)}%`
                                        : '--'}
                                    </td>
                                    <td className="right mono numeric">
                                      {fresh && stats?.latency_ms != null ? `${Math.round(stats.latency_ms)} ms` : '--'}
                                    </td>
                                    <td className="right mono numeric">
                                      {fresh && stats?.tps != null ? `${stats.tps.toFixed(1)} tok/s` : '--'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </section>
                )
              })}
            </div>

            <footer className="status-legend">
              {states.map(s => (
                <span key={s} className="legend-item">
                  <span className="legend-swatch" data-state={s} />
                  {STATE_LABELS[s]}
                </span>
              ))}
            </footer>
          </>
        )}
      </section>

      <p className="small muted module-note">
        正常时段比例按有数据的监测格计算，不等于请求成功率。延迟为监测窗口内的平均响应时间，不代表首字耗时。
      </p>

      {!!issues.length && (
        <div className="card card-pad module-issues">
          <h3 style={{ marginTop: 0 }}>当前异常</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {issues.map(row => (
              <button
                type="button"
                key={row.group.id}
                onClick={() => {
                  setStateFilter('all')
                  setSearch(row.group.name)
                  setPlatform('all')
                  setExpanded(new Set([row.group.id]))
                }}
              >
                {row.group.name}
                <StatusLabel state={row.state} />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
