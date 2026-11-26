import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  Bell,
  Clock,
  Cpu,
  Database,
  DollarSign,
  Gauge,
  Gift,
  KeyRound,
  Radio,
  Wallet,
} from 'lucide-react'
import { date, money, number, queryPath, useApi } from './native'
import type { Announcement, ModelStat, Page, PlatformQuotaItem, Stats, Trend, Usage, User } from './types'
import { Empty, ErrorMessage, Loading } from './ui'
import { VendorIcon } from './VendorIcon'
import { UsageDetail, UsageTable } from './Usage'

function compactTokens(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '--'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

export default function Dashboard({
  user,
  navigate,
  unreadAnnouncements = [],
  onOpenAnnouncements,
}: {
  user: User
  navigate: (page: string) => void
  unreadAnnouncements?: Announcement[]
  onOpenAnnouncements?: () => void
}) {
  const [days, setDays] = useState<7 | 14 | 30>(14)
  const stats = useApi<Stats>('/usage/dashboard/stats')
  const recent = useApi<Page<Usage>>('/usage?page=1&page_size=5')
  const quotas = useApi<{ platform_quotas?: PlatformQuotaItem[] }>('/user/platform-quotas')

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  const day = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const trend = useApi<{ trend: Trend[] }>(
    queryPath('/usage/dashboard/trend', { start_date: day(start), end_date: day(end), granularity: 'day', timezone: tz }),
  )
  const modelDist = useApi<{ models: ModelStat[] }>(
    queryPath('/usage/dashboard/models', { start_date: day(start), end_date: day(end), timezone: tz }),
  )

  const [selected, setSelected] = useState<Usage | null>(null)
  const [metric, setMetric] = useState<'requests' | 'actual_cost'>('actual_cost')
  const [hovered, setHovered] = useState<Trend | null>(null)

  const rows = trend.data?.trend || []
  const max = Math.max(...rows.map(r => Number(r[metric]) || 0), 0.001)
  const periodCost = rows.reduce((sum, r) => sum + (Number(r.actual_cost) || 0), 0)
  const periodRequests = rows.reduce((sum, r) => sum + (Number(r.requests) || 0), 0)
  const activePoint = hovered || rows[rows.length - 1] || null

  const rankedModels = [...(modelDist.data?.models || [])]
    .sort((a, b) => (b.actual_cost || 0) - (a.actual_cost || 0) || (b.total_tokens || 0) - (a.total_tokens || 0))
    .slice(0, 6)
  const maxModelCost = rankedModels[0]?.actual_cost || rankedModels[0]?.total_tokens || 1

  const platformQuotas = quotas.data?.platform_quotas || []
  const platformStats = stats.data?.by_platform || []

  return (
    <>
      <div className="welcome">
        <div>
          <h2>{user.username || user.email.split('@')[0]}，你好</h2>
          <p>账号运行概览 · 实时同步生产环境余额、渠道与调用数据</p>
        </div>
        <div className="welcome-actions">
          <button type="button" onClick={() => navigate('channels')}>
            <Radio size={15} />
            渠道状态
          </button>
          <button type="button" onClick={() => navigate('purchase')}>
            <Wallet size={15} />
            购买额度
          </button>
          <button type="button" onClick={() => navigate('redeem')}>
            <Gift size={15} />
            兑换额度
          </button>
          <button type="button" className="primary" onClick={() => navigate('keys')}>
            <KeyRound size={15} />
            管理密钥
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {unreadAnnouncements.length > 0 && onOpenAnnouncements && (
        <div className="announcement-banner">
          <Bell size={15} />
          <div>
            <strong>{unreadAnnouncements[0].title}</strong>
            {unreadAnnouncements.length > 1 && `（共 ${unreadAnnouncements.length} 条未读公告）`}
          </div>
          <button type="button" className="text-link small" onClick={onOpenAnnouncements}>
            查看公告
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      <ErrorMessage error={stats.error} retry={() => stats.refetch()} />

      {/* Row 1: Primary 4 KPI cards */}
      <div className="metrics-grid">
        <div className="metric-card featured">
          <div className="metric-top">
            <span className="metric-label">可用余额</span>
            <span className="metric-icon">
              <Wallet size={14} />
            </span>
          </div>
          <strong className="metric-value">{money(user.balance)}</strong>
          <div className="metric-foot">
            <span>{user.frozen_balance ? `冻结 ${money(user.frozen_balance)}` : '实时可用额度'}</span>
            <button type="button" className="text-link small" onClick={() => navigate('purchase')}>
              购买额度
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">今日消费</span>
            <span className="metric-icon">
              <DollarSign size={14} />
            </span>
          </div>
          <strong className="metric-value">{money(stats.data?.today_actual_cost, 4)}</strong>
          <div className="metric-foot">
            <span>累计实付 {money(stats.data?.total_actual_cost)}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">今日请求</span>
            <span className="metric-icon">
              <Activity size={14} />
            </span>
          </div>
          <strong className="metric-value">{number(stats.data?.today_requests)}</strong>
          <div className="metric-foot">
            <span>累计 {number(stats.data?.total_requests)} 次</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">今日 Token</span>
            <span className="metric-icon">
              <Cpu size={14} />
            </span>
          </div>
          <strong className="metric-value">{number(stats.data?.today_tokens)}</strong>
          <div className="metric-foot">
            <span>{number(stats.data?.active_api_keys)} 个密钥正在启用</span>
          </div>
        </div>
      </div>

      {/* Row 2: Secondary operational strip (keys, total tokens, RPM/TPM, avg duration) */}
      <div className="metrics-grid" style={{ marginBottom: 16 }}>
        <div className="metric-card compact">
          <div className="metric-top">
            <span className="metric-label">活跃密钥</span>
            <KeyRound size={14} className="muted" />
          </div>
          <strong className="metric-value">
            {number(stats.data?.active_api_keys)} / {number(stats.data?.total_api_keys)}
          </strong>
        </div>

        <div className="metric-card compact">
          <div className="metric-top">
            <span className="metric-label">累计 Token</span>
            <Database size={14} className="muted" />
          </div>
          <strong className="metric-value">{compactTokens(stats.data?.total_tokens)}</strong>
        </div>

        <div className="metric-card compact">
          <div className="metric-top">
            <span className="metric-label">实时速率 (5m)</span>
            <Gauge size={14} className="muted" />
          </div>
          <strong className="metric-value">
            {number(stats.data?.rpm)} <small style={{ fontWeight: 500 }}>RPM</small>
          </strong>
        </div>

        <div className="metric-card compact">
          <div className="metric-top">
            <span className="metric-label">平均响应耗时</span>
            <Clock size={14} className="muted" />
          </div>
          <strong className="metric-value">
            {stats.data?.average_duration_ms ? `${(stats.data.average_duration_ms / 1000).toFixed(2)}s` : '--'}
          </strong>
        </div>
      </div>

      {/* Row 3: Trend + Model Distribution */}
      <div className="analytics-grid">
        <section className="card">
          <div className="card-header">
            <div className="chart-summary">
              <h2>使用趋势</h2>
              {rows.length > 0 && (
                <>
                  <span className="chart-summary-stat">
                    <span>消费</span>
                    <strong>{money(periodCost, 2)}</strong>
                  </span>
                  <span className="chart-summary-stat">
                    <span>请求</span>
                    <strong>{number(periodRequests)}</strong>
                  </span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <div className="segmented" role="group" aria-label="时间范围">
                {([7, 14, 30] as const).map(d => (
                  <button key={d} type="button" className={days === d ? 'selected' : ''} onClick={() => setDays(d)}>
                    {d}天
                  </button>
                ))}
              </div>
              <div className="segmented" role="group" aria-label="统计指标">
                <button
                  type="button"
                  className={metric === 'actual_cost' ? 'selected' : ''}
                  onClick={() => setMetric('actual_cost')}
                >
                  消费
                </button>
                <button
                  type="button"
                  className={metric === 'requests' ? 'selected' : ''}
                  onClick={() => setMetric('requests')}
                >
                  请求
                </button>
              </div>
            </div>
          </div>

          <div className="chart-body">
            <ErrorMessage error={trend.error} retry={() => trend.refetch()} />
            {trend.isPending ? (
              <Loading />
            ) : !rows.length ? (
              !trend.error && <Empty title="尚无使用数据" detail="发起请求后，消费与调用趋势会展示在这里。" />
            ) : (
              <>
                <div className="chart-meta-row">
                  <span className="chart-hint">悬停柱状条查看单日消费与请求明细</span>
                  {activePoint && (
                    <div className="chart-tooltip">
                      <span className="mono">{activePoint.date}</span>
                      <strong>
                        {metric === 'actual_cost'
                          ? money(activePoint.actual_cost, 4)
                          : `${number(activePoint.requests)} 次`}
                      </strong>
                      <span className="muted">
                        {metric === 'actual_cost'
                          ? `${number(activePoint.requests)} 次请求`
                          : money(activePoint.actual_cost, 4)}
                      </span>
                    </div>
                  )}
                </div>
                <div
                  className="chart"
                  role="img"
                  aria-label={`近${days}天${metric === 'actual_cost' ? '消费' : '请求'}趋势`}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="chart-scale">
                    <span>{metric === 'actual_cost' ? money(max, 2) : number(max)}</span>
                    <span>{metric === 'actual_cost' ? money(max / 2, 2) : number(Math.round(max / 2))}</span>
                    <span>0</span>
                  </div>
                  <div className="bars">
                    {rows.map((row, i) => {
                      const value = Number(row[metric]) || 0
                      const isActive = activePoint?.date === row.date
                      return (
                        <div
                          key={row.date}
                          className={`bar-slot ${isActive ? 'active' : ''}`}
                          title={`${row.date}: ${metric === 'actual_cost' ? money(row.actual_cost, 4) : `${row.requests} 次`}`}
                          onMouseEnter={() => setHovered(row)}
                        >
                          <div className="bar" style={{ height: `${Math.max(2, (value / max) * 100)}%` }} />
                          <span>
                            {i % Math.max(1, Math.floor(rows.length / 6)) === 0 ? row.date.slice(5, 10) : ''}
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
          <div className="card-header">
            <h2>
              模型消费分布
              <span className="card-header-sub">近 {days} 天 Top 6</span>
            </h2>
          </div>
          {modelDist.isPending ? (
            <Loading />
          ) : rankedModels.length ? (
            <div className="rank-list">
              <div className="rank-row head">
                <span className="rank-name">模型</span>
                <span className="rank-num">请求</span>
                <span className="rank-num">实付</span>
              </div>
              {rankedModels.map(m => {
                const share =
                  maxModelCost > 0
                    ? Math.max(4, (((m.actual_cost || m.total_tokens || 0) / maxModelCost) * 100))
                    : 0
                return (
                  <div key={m.model} className="rank-row" title={`${m.model} · ${number(m.total_tokens)} tokens`}>
                    <span className="rank-bar" style={{ width: `${Math.min(100, share)}%` }} aria-hidden="true" />
                    <span className="rank-name">
                      <VendorIcon vendor={m.model} size={14} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.model}</span>
                    </span>
                    <span className="rank-num muted">{number(m.requests)}</span>
                    <span className="rank-num">{money(m.actual_cost, 3)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <Empty title="暂无模型分布" detail="调用模型后会按消费自动排行。" />
          )}
        </section>
      </div>

      {/* Row 4: Optional Platform Quotas / Breakdown */}
      {(platformStats.length > 0 || platformQuotas.length > 0) && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h2>平台分布与配额</h2>
            <span className="card-header-sub">{Math.max(platformStats.length, platformQuotas.length)} 个平台</span>
          </div>
          <div className="card-pad">
            <div className="metrics-grid" style={{ marginBottom: 0 }}>
              {(platformStats.length
                ? platformStats
                : platformQuotas.map(q => ({
                    platform: q.platform,
                    total_actual_cost: q.monthly_usage_usd || 0,
                    today_actual_cost: q.daily_usage_usd || 0,
                    total_requests: 0,
                    total_tokens: 0,
                  }))
              ).map(p => {
                const q = platformQuotas.find(item => item.platform === p.platform)
                return (
                  <div key={p.platform} className="metric-card compact">
                    <div className="metric-top">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                        <VendorIcon vendor={p.platform} size={15} />
                        {p.platform}
                      </span>
                      <span className="mono small">{money(p.total_actual_cost)}</span>
                    </div>
                    <div className="small muted">
                      今日 {money(p.today_actual_cost, 4)} · {number(p.total_requests)} 次
                    </div>
                    {q?.daily_limit_usd != null && q.daily_limit_usd > 0 && (
                      <div className="progress-row" style={{ marginTop: 6 }}>
                        <span>日限额</span>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{ width: `${Math.min(100, ((q.daily_usage_usd || 0) / q.daily_limit_usd) * 100)}%` }}
                          />
                        </div>
                        <span>{Math.round(((q.daily_usage_usd || 0) / q.daily_limit_usd) * 100)}%</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Row 5: Recent Requests */}
      <section className="table-card">
        <div className="card-header">
          <h2>
            最近请求
            <span className="card-header-sub">最新 5 条调用记录</span>
          </h2>
          <button type="button" className="text-link small" onClick={() => navigate('usage')}>
            全部记录
            <ArrowRight size={14} />
          </button>
        </div>
        <ErrorMessage error={recent.error} retry={() => recent.refetch()} />
        {recent.isPending ? (
          <Loading />
        ) : recent.data?.items.length ? (
          <UsageTable rows={recent.data.items} onSelect={setSelected} />
        ) : (
          !recent.error && <Empty title="暂无调用记录" detail="使用 API 密钥发起请求后，调用明细会实时显示在这里。" />
        )}
      </section>

      <p className="updated">数据更新于 {stats.dataUpdatedAt ? date(new Date(stats.dataUpdatedAt).toISOString()) : '--'}</p>
      {selected && <UsageDetail row={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
