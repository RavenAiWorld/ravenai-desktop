import { useMemo, useState } from 'react'
import {
  Boxes,
  ChevronRight,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Sparkles,
  Video,
  Zap,
} from 'lucide-react'
import { useApi } from './native'
import { Badge, CopyButton, Drawer, Empty, ErrorMessage, KeyValue, Loading, SearchInput } from './ui'
import { VendorIcon } from './VendorIcon'
import { modelState } from './status/statusData'
import type { ModelPlazaResponse, PlazaRouteStats } from './pricing/modelPlaza'
import {
  billingMode,
  buildEntries,
  catalogModels,
  entryEstimate,
  entryFeatures,
  entryModelIds,
  entryTitle,
  FEATURE_KEYS,
  filterEntries,
  formatContextSize,
  formatUnitPrice,
  formatUsd,
  isPlazaGroupVisible,
  matchesQuery,
  officialTokenTiers,
  paidRate,
  paidRequestPrices,
  paidTokenTiers,
  reasoningMultipliers,
  SCENARIO_PRESETS,
  sortEntries,
  vendorMeta,
  VENDORS,
  type FeatureKey,
  type PlazaEntry,
  type PriceUnit,
  type SortKey,
  type VendorId,
  type Workload,
} from './pricing/catalog'

const featureLabels: Record<FeatureKey, string> = {
  fast: 'Fast',
  vision: '视觉',
  reasoning: '推理',
  flatContext: '长上下文不加价',
}

function formatLatencySec(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '--'
  return `${(ms / 1000).toFixed(2)}s`
}

function formatRouteTps(tps: number | null | undefined) {
  if (tps == null || !Number.isFinite(tps) || tps <= 0) return '--'
  return `${tps.toFixed(1)} t/s`
}

function RouteStatsStrip({
  stats,
  groupName,
  detailed = false,
}: {
  stats: PlazaRouteStats
  groupName: string
  detailed?: boolean
}) {
  const updatedMs = Date.parse(stats.updated_at || '')
  const slots = Array.from({ length: 24 }, (_, idx) => {
    const raw = stats.history?.[idx]
    const state = raw === 'operational' || raw === 'degraded' || raw === 'failed' ? raw : 'unknown'
    return state
  })
  const scopeHint = [
    groupName,
    stats.group_average ? '分组近 1 小时均值' : '模型近 1 小时实测',
    Number.isFinite(updatedMs) ? `更新于 ${new Date(updatedMs).toLocaleTimeString('zh-CN', { hour12: false })}` : '',
    stats.stale ? '缓存数据' : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className={`ticket-route-stats ${detailed ? 'detailed' : ''}`}
      data-stale={stats.stale ? 'true' : 'false'}
      title={scopeHint}
    >
      <div className="ticket-stat-health">
        <div className="ticket-stat-head">
          <span>状态</span>
          <strong className="mono numeric">
            {stats.success_rate == null ? '--' : `${(stats.success_rate * 100).toFixed(2)}%`}
          </strong>
        </div>
        <div className="ticket-history-bars" aria-label={`${groupName} 近期可用性`}>
          {slots.map((state, idx) => (
            <i key={idx} data-state={state} />
          ))}
        </div>
      </div>
      <div className="ticket-stat-metric">
        <span>延迟</span>
        <strong className="mono numeric">{formatLatencySec(stats.latency_ms)}</strong>
      </div>
      <div className="ticket-stat-metric">
        <span>TPS</span>
        <strong className="mono numeric tps-value">{formatRouteTps(stats.tps)}</strong>
      </div>
    </div>
  )
}

export default function Models({ initialGroup = '' }: { initialGroup?: string }) {
  const query = useApi<ModelPlazaResponse>('/model-plaza')
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState(initialGroup)
  const [vendor, setVendor] = useState('')
  const [features, setFeatures] = useState<FeatureKey[]>([])
  const [billing, setBilling] = useState('')
  const [exclusiveOnly, setExclusiveOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('recommended')
  const [unit, setUnit] = useState<PriceUnit>('M')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [scenario, setScenario] = useState('chat')
  const [workload, setWorkload] = useState<Workload>(SCENARIO_PRESETS.chat)
  const [estimatorOpen, setEstimatorOpen] = useState(false)
  const [selected, setSelected] = useState<PlazaEntry | null>(null)
  const [cardRouteOverride, setCardRouteOverride] = useState<Record<string, number>>({})
  const [cardTierIndex, setCardTierIndex] = useState<Record<string, number>>({})

  const groups = useMemo(() => (query.data?.groups || []).filter(isPlazaGroupVisible), [query.data])

  const allGroupEntries = useMemo(() => groups.flatMap(buildEntries), [groups])

  const routesByModel = useMemo(() => {
    const map = new Map<string, PlazaEntry[]>()
    for (const entry of allGroupEntries) {
      const k = `${entry.model.platform}:${entry.model.name.toLowerCase()}`
      const list = map.get(k) || []
      list.push(entry)
      map.set(k, list)
    }
    return map
  }, [allGroupEntries])

  const scopedEntries = useMemo(() => {
    const scopedGroups = groups.filter(g => (!group || String(g.id) === group) && (!exclusiveOnly || g.is_exclusive))
    const raw = scopedGroups.flatMap(buildEntries)
    return group ? raw : catalogModels(raw)
  }, [groups, group, exclusiveOnly])

  const baseFiltered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return filterEntries(scopedEntries, { query: '', vendor: 'all', features })
      .filter(entry => !kw || matchesQuery(entry, search) || entry.group.name.toLowerCase().includes(kw))
      .filter(entry => !billing || billingMode(entry.model) === billing)
  }, [scopedEntries, search, features, billing])

  const vendorCounts = useMemo(() => {
    const counts = new Map<VendorId, number>()
    for (const e of baseFiltered) counts.set(e.vendor, (counts.get(e.vendor) || 0) + 1)
    return VENDORS.filter(v => counts.has(v.id)).map(v => ({
      ...v,
      count: counts.get(v.id) || 0,
    }))
  }, [baseFiltered])

  const entries = useMemo(() => {
    const filtered = baseFiltered.filter(e => !vendor || e.vendor === vendor)
    return sortEntries(filtered, sort, workload)
  }, [baseFiltered, vendor, sort, workload])

  const groupedByVendor = useMemo(() => {
    const byVendor = new Map<VendorId, PlazaEntry[]>()
    for (const e of entries) {
      const list = byVendor.get(e.vendor) || []
      list.push(e)
      byVendor.set(e.vendor, list)
    }
    return VENDORS.filter(v => byVendor.has(v.id)).map(v => ({
      vendor: v,
      items: byVendor.get(v.id)!,
    }))
  }, [entries])

  const now = Date.now()
  const showEstimate = estimatorOpen || sort === 'estimate'
  const fastFilterOn = features.includes('fast')

  function renderTicketCard(baseEntry: PlazaEntry) {
    const modelKey = `${baseEntry.model.platform}:${baseEntry.model.name.toLowerCase()}`
    const siblings = routesByModel.get(modelKey) || [baseEntry]
    const chosenGroupId = cardRouteOverride[modelKey]
    const entry = (!group && chosenGroupId ? siblings.find(s => s.group.id === chosenGroupId) : null) || baseEntry
    const useFast = fastFilterOn && !!entry.fast
    const activeModel = useFast ? entry.fast! : entry.model
    const rate = paidRate(activeModel, entry.group)
    const allTiers = paidTokenTiers(activeModel, rate)
    const tiers = entry.group.long_context_pricing_enabled ? allTiers : allTiers.slice(0, 1)
    const tIdx = Math.min(cardTierIndex[entry.key] || 0, Math.max(0, tiers.length - 1))
    const tier = tiers[tIdx]
    const offTiers = officialTokenTiers(activeModel)
    const offTier = offTiers[Math.min(tIdx, Math.max(0, offTiers.length - 1))]
    const requests = paidRequestPrices(activeModel, rate)
    const mode = billingMode(activeModel)
    const est = showEstimate ? entryEstimate(entry, workload, useFast) : null
    const routeHealth = modelState(activeModel, entry.group, now)

    return (
      <article key={entry.key} className="ticket-card" onClick={() => setSelected(entry)}>
        <div className="ticket-top">
          <div className="ticket-title-row">
            <VendorIcon vendor={entry.vendor} size={18} />
            <button
              type="button"
              className="ticket-model-btn"
              onClick={e => {
                e.stopPropagation()
                setSelected(entry)
              }}
            >
              {entryTitle(entry)}
            </button>
            {routeHealth !== 'unknown' && (
              <span
                className="status-dot"
                title={`渠道状态：${routeHealth}`}
                style={{
                  background:
                    routeHealth === 'operational'
                      ? 'var(--green)'
                      : routeHealth === 'degraded'
                        ? 'var(--amber)'
                        : routeHealth === 'maintenance'
                          ? 'var(--blue)'
                          : 'var(--red)',
                  boxShadow: 'none',
                }}
              />
            )}
            <CopyButton text={activeModel.name} label="复制模型 ID" />
          </div>

          <div className="ticket-caps-row">
            <span className="cap-box" title="文本">
              T
            </span>
            {(mode === 'image' || entry.info?.input_modalities?.includes('image')) && (
              <span className="cap-box" title="视觉 / 图像">
                <ImageIcon size={11} />
              </span>
            )}
            {mode === 'video' && (
              <span className="cap-box" title="视频">
                <Video size={11} />
              </span>
            )}
            {entry.info?.reasoning && (
              <span className="cap-box" title="深度推理">
                <Sparkles size={11} />
              </span>
            )}
            {(entry.alwaysFast || useFast || entry.fast) && (
              <span className="cap-box" title="支持 Fast" style={{ color: 'var(--coral)' }}>
                <Zap size={11} />
              </span>
            )}
            <span>
              上下文 <strong>{entry.info?.context_window ? formatContextSize(entry.info.context_window) : '--'}</strong>
            </span>
            {entry.info?.max_output_tokens && (
              <span>
                · 输出 <strong>{formatContextSize(entry.info.max_output_tokens)}</strong>
              </span>
            )}
          </div>

          <div className="ticket-route-row">
            <button
              type="button"
              className="route-chip"
              title={siblings.length > 1 && !group ? '点击切换可用渠道' : entry.group.name}
              onClick={e => {
                e.stopPropagation()
                if (siblings.length > 1 && !group) {
                  const currIdx = siblings.findIndex(s => s.group.id === entry.group.id)
                  const next = siblings[(currIdx + 1) % siblings.length]
                  setCardRouteOverride(prev => ({ ...prev, [modelKey]: next.group.id }))
                } else {
                  setSelected(entry)
                }
              }}
            >
              <span className="route-chip-name">{entry.group.name}</span>
              <span className="route-rate">×{rate}</span>
            </button>

            {tiers.length > 1 &&
              tiers.map((t, idx) => (
                <button
                  type="button"
                  key={idx}
                  className={`tier-chip ${idx === tIdx ? 'active' : ''}`}
                  onClick={e => {
                    e.stopPropagation()
                    setCardTierIndex(prev => ({ ...prev, [entry.key]: idx }))
                  }}
                >
                  {t.label || `档位${idx + 1}`}
                </button>
              ))}

            {entry.group.status === 'maintenance' && <Badge value="maintenance" />}
          </div>
        </div>

        <div className="ticket-seam" aria-hidden="true" />

        <div className="ticket-prices">
          {tier ? (
            <table className="ticket-price-table">
              <thead>
                <tr>
                  <th>输入</th>
                  <th>输出</th>
                  <th>缓存写</th>
                  <th>缓存读</th>
                </tr>
              </thead>
              <tbody>
                <tr className="ticket-price-main">
                  <td>{formatUnitPrice(tier.input, unit)}</td>
                  <td>{formatUnitPrice(tier.output, unit)}</td>
                  <td>{formatUnitPrice(tier.cacheWrite, unit)}</td>
                  <td>{formatUnitPrice(tier.cacheRead, unit)}</td>
                </tr>
                {offTier && (
                  <tr className="ticket-price-orig">
                    <td>{offTier.input != null ? `原价 ${formatUnitPrice(offTier.input, unit)}` : ''}</td>
                    <td>{offTier.output != null ? `原价 ${formatUnitPrice(offTier.output, unit)}` : ''}</td>
                    <td>{offTier.cacheWrite != null ? `原价 ${formatUnitPrice(offTier.cacheWrite, unit)}` : ''}</td>
                    <td>{offTier.cacheRead != null ? `原价 ${formatUnitPrice(offTier.cacheRead, unit)}` : ''}</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="ticket-per-req">
              <span className="muted small">{mode === 'image' ? '按张计费' : mode === 'video' ? '按视频计费' : '按次计费'}</span>
              <strong>
                {requests.length
                  ? `${formatUsd(requests[0].price)} / ${mode === 'image' ? '张' : '次'}`
                  : '价格未公布'}
              </strong>
            </div>
          )}
        </div>

        {activeModel.route_stats && (
          <RouteStatsStrip stats={activeModel.route_stats} groupName={entry.group.name} />
        )}

        <div className="ticket-footer">
          <span>{tier ? (unit === 'M' ? 'USD / 百万 Tokens' : 'USD / 千 Tokens') : 'USD / 单次计费'}</span>
          {est ? (
            <span className="ticket-est-chip">估价 {formatUsd(est.total, 4)}</span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              详情
              <ChevronRight size={13} />
            </span>
          )}
        </div>
      </article>
    )
  }

  return (
    <>
      {/* Row 1: Search, Vendor/Group Selectors, Exclusive & View Controls */}
      <div className="toolbar filter-bar plaza-filters">
        <SearchInput value={search} onChange={setSearch} placeholder="搜索模型、名称或分组" />

        <select aria-label="模型厂商" value={vendor} onChange={e => setVendor(e.target.value)} style={{ maxWidth: 138 }}>
          <option value="">全部厂商</option>
          {VENDORS.map(v => (
            <option key={v.id} value={v.id}>
              {v.label || '其他'}
            </option>
          ))}
        </select>

        <select aria-label="模型分组" value={group} onChange={e => setGroup(e.target.value)}>
          <option value="">全部分组</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`toggle-pill ${exclusiveOnly ? 'active' : ''}`}
          onClick={() => setExclusiveOnly(v => !v)}
        >
          <Sparkles size={14} />
          专属价格
        </button>

        <span className="spacer" />

        <span className="count-pill">{entries.length} 个模型</span>

        <div className="segmented" role="group" aria-label="视图模式">
          <button
            type="button"
            className={viewMode === 'cards' ? 'selected' : ''}
            onClick={() => setViewMode('cards')}
            title="卡片视图"
            aria-label="卡片视图"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            className={viewMode === 'table' ? 'selected' : ''}
            onClick={() => setViewMode('table')}
            title="表格视图"
            aria-label="表格视图"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Row 2: Crab AI Vendor Pill Bar */}
      {vendorCounts.length > 0 && (
        <div className="vendor-pill-bar">
          <div className="vendor-pills" role="group" aria-label="快捷筛选厂商">
            <button
              type="button"
              className={`vendor-pill ${!vendor ? 'selected' : ''}`}
              onClick={() => setVendor('')}
            >
              <Boxes size={14} />
              <span>全部</span>
              <span className="vendor-pill-count">{baseFiltered.length}</span>
            </button>
            {vendorCounts.map(v => (
              <button
                type="button"
                key={v.id}
                className={`vendor-pill ${vendor === v.id ? 'selected' : ''}`}
                onClick={() => setVendor(vendor === v.id ? '' : v.id)}
              >
                <VendorIcon vendor={v.id} size={14} />
                <span>{v.label || '其他'}</span>
                <span className="vendor-pill-count">{v.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Row 3: Feature Checkboxes, Billing/Sort/Unit Controls & Collapsible Scenario Estimator */}
      <div className="plaza-controls">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="feature-filters">
            {FEATURE_KEYS.map(feature => (
              <label key={feature}>
                <input
                  type="checkbox"
                  checked={features.includes(feature)}
                  onChange={e =>
                    setFeatures(e.target.checked ? [...features, feature] : features.filter(value => value !== feature))
                  }
                />
                {featureLabels[feature]}
              </label>
            ))}
          </div>
          <span className="spacer" />
          <select aria-label="计费方式" value={billing} onChange={e => setBilling(e.target.value)}>
            <option value="">全部计费方式</option>
            <option value="token">按 Token</option>
            <option value="request">按次</option>
            <option value="image">按图片</option>
            <option value="video">按视频</option>
          </select>
          <select aria-label="模型排序" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
            {Object.entries({
              recommended: '推荐排序',
              input: '输入价格从低到高',
              output: '输出价格从低到高',
              estimate: '场景估价从低到高',
              name: '模型名称',
            }).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
          <div className="segmented" aria-label="价格单位">
            <button type="button" className={unit === 'M' ? 'selected' : ''} onClick={() => setUnit('M')}>
              1M
            </button>
            <button type="button" className={unit === 'K' ? 'selected' : ''} onClick={() => setUnit('K')}>
              1K
            </button>
          </div>
        </div>

        <details className="plaza-estimator" onToggle={e => setEstimatorOpen(e.currentTarget.open)}>
          <summary>场景估价</summary>
          <div className="estimator-fields">
            <label>
              使用场景
              <select
                value={scenario}
                onChange={e => {
                  setScenario(e.target.value)
                  if (e.target.value !== 'custom') {
                    setWorkload(SCENARIO_PRESETS[e.target.value as keyof typeof SCENARIO_PRESETS])
                  }
                }}
              >
                <option value="chat">日常对话</option>
                <option value="agent">编程 Agent</option>
                <option value="longDoc">长文档</option>
                <option value="custom">自定义</option>
              </select>
            </label>
            {(
              [
                ['input', '输入 Token'],
                ['output', '输出 Token'],
                ['cacheHit', '缓存命中 %'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="0"
                  max={key === 'cacheHit' ? 100 : 100000000}
                  value={key === 'cacheHit' ? Math.round(workload[key] * 100) : workload[key]}
                  onChange={e => {
                    setScenario('custom')
                    setWorkload({
                      ...workload,
                      [key]:
                        key === 'cacheHit'
                          ? Math.min(100, Math.max(0, Number(e.target.value))) / 100
                          : Math.max(0, Number(e.target.value)),
                    })
                  }}
                />
              </label>
            ))}
          </div>
        </details>
      </div>

      <ErrorMessage error={query.error} retry={() => query.refetch()} />

      {query.isPending ? (
        <div className="card">
          <Loading label="正在加载模型广场" />
        </div>
      ) : !entries.length ? (
        !query.error && (
          <div className="card">
            <Empty
              icon={<Boxes size={20} />}
              title="没有符合条件的模型"
              detail="尝试调整关键词、厂商、特性或分组筛选条件。"
            />
          </div>
        )
      ) : viewMode === 'cards' ? (
        sort === 'recommended' ? (
          groupedByVendor.map(({ vendor: vMeta, items }) => (
            <section key={vMeta.id} className="vendor-section">
              <div className="vendor-section-head">
                <VendorIcon vendor={vMeta.id} size={20} />
                <h2>{vMeta.label || '其他'}</h2>
                <span className="vendor-section-count">{items.length} 个模型</span>
              </div>
              <div className="plaza-grid">{items.map(renderTicketCard)}</div>
            </section>
          ))
        ) : (
          <div className="plaza-grid">{entries.map(renderTicketCard)}</div>
        )
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="models-table">
              <thead>
                <tr>
                  <th>模型</th>
                  <th>可用分组</th>
                  <th>上下文</th>
                  <th className="right">速度 / 延迟</th>
                  <th className="right">输入 / 1{unit}</th>
                  <th className="right">输出 / 1{unit}</th>
                  <th className="right">缓存读取 / 1{unit}</th>
                  <th className="right">单次估价</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const activeModel = fastFilterOn && entry.fast ? entry.fast : entry.model
                  const rate = paidRate(activeModel, entry.group)
                  const tier = paidTokenTiers(activeModel, rate)[0]
                  const requests = paidRequestPrices(activeModel, rate)
                  return (
                    <tr key={entry.key} onClick={() => setSelected(entry)} className="clickable">
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <VendorIcon vendor={entry.vendor} size={18} />
                          <div>
                            <button
                              type="button"
                              className="text-link mono"
                              onClick={e => {
                                e.stopPropagation()
                                setSelected(entry)
                              }}
                            >
                              {entryTitle(entry)}
                            </button>
                            <small className="mono">
                              {vendorMeta(entry.vendor).label || activeModel.platform} / {activeModel.name}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                          <span className="pill">
                            {entry.group.name} <strong className="route-rate">×{rate}</strong>
                          </span>
                          {entry.group.status === 'maintenance' && <Badge value="maintenance" />}
                        </div>
                      </td>
                      <td className="mono muted">
                        {entry.info?.context_window ? formatContextSize(entry.info.context_window) : '--'}
                      </td>
                      <td className="right mono numeric">
                        <div>{formatRouteTps(activeModel.route_stats?.tps)}</div>
                        <small className="muted">{formatLatencySec(activeModel.route_stats?.latency_ms)}</small>
                      </td>
                      {tier ? (
                        <>
                          <td className="right mono numeric">{formatUnitPrice(tier.input, unit)}</td>
                          <td className="right mono numeric">{formatUnitPrice(tier.output, unit)}</td>
                          <td className="right mono numeric muted">{formatUnitPrice(tier.cacheRead, unit)}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="right mono numeric">
                          {requests.length
                            ? `${formatUsd(requests[0].price)} / ${activeModel.pricing?.billing_mode === 'image' ? '张' : '次'}`
                            : '价格未公布'}
                        </td>
                      )}
                      <td className="right mono numeric">{formatUsd(entryEstimate(entry, workload, fastFilterOn && !!entry.fast)?.total)}</td>
                      <td className="right">
                        <ChevronRight size={15} className="muted" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <ModelDetail
          key={selected.key}
          entry={selected}
          unit={unit}
          workload={workload}
          routes={allGroupEntries.filter(
            e => e.model.name === selected.model.name && e.model.platform === selected.model.platform,
          )}
          onSelect={setSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

function ModelDetail({
  entry,
  onClose,
  unit,
  workload,
  routes,
  onSelect,
}: {
  entry: PlazaEntry
  onClose: () => void
  unit: PriceUnit
  workload: Workload
  routes: PlazaEntry[]
  onSelect: (entry: PlazaEntry) => void
}) {
  const [fast, setFast] = useState(false)
  const model = fast && entry.fast ? entry.fast : entry.model
  const rate = paidRate(model, entry.group)
  const allTiers = paidTokenTiers(model, rate)
  const tiers = entry.group.long_context_pricing_enabled ? allTiers : allTiers.slice(0, 1)
  const offTiers = officialTokenTiers(model)
  const efforts = reasoningMultipliers(model)
  const est = entryEstimate(entry, workload, fast)

  return (
    <Drawer title={entryTitle(entry)} onClose={onClose} wide>
      <div className="model-identity">
        <VendorIcon vendor={entry.vendor} size={28} />
        <div>
          <strong>{vendorMeta(entry.vendor).label || model.platform}</strong>
          <small>
            {entry.group.name} · 实付倍率 ×{rate}
          </small>
        </div>
        <span className="spacer" />
        <Badge value={entry.group.status || 'active'} />
      </div>

      {entry.info?.description && <p className="description">{entry.info.description}</p>}

      {entryFeatures(entry).size > 0 && (
        <div className="feature-filters" style={{ marginBottom: 14 }}>
          {[...entryFeatures(entry)].map(feature => (
            <span className="pill" key={feature}>
              {featureLabels[feature]}
            </span>
          ))}
        </div>
      )}

      {routes.length > 1 && (
        <label className="field">
          <span>可用分组</span>
          <select
            aria-label="详情分组"
            value={entry.key}
            onChange={e => {
              const route = routes.find(r => r.key === e.target.value)
              if (route) onSelect(route)
            }}
          >
            {routes.map(route => (
              <option key={route.key} value={route.key}>
                {route.group.name} (×{paidRate(route.model, route.group)})
                {route.group.status === 'maintenance' ? ' · 维护中' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="secret">
        <code>{model.name}</code>
        <CopyButton text={model.name} label="复制模型 ID" />
      </div>
      {entryModelIds(entry)
        .filter(id => id !== model.name)
        .map(id => (
          <div className="secret" key={id}>
            <code>{id}</code>
            <CopyButton text={id} label={`复制 ${id}`} />
          </div>
        ))}

      <div className="spec-grid three">
        <div className="spec-tile">
          <span>上下文窗口</span>
          <strong>{entry.info?.context_window ? formatContextSize(entry.info.context_window) : '未公布'}</strong>
        </div>
        <div className="spec-tile">
          <span>最大输出</span>
          <strong>{entry.info?.max_output_tokens ? formatContextSize(entry.info.max_output_tokens) : '未公布'}</strong>
        </div>
        <div className="spec-tile">
          <span>当前场景单次估价</span>
          <strong>{est ? formatUsd(est.total) : '--'}</strong>
        </div>
      </div>

      {model.route_stats && (
        <RouteStatsStrip stats={model.route_stats} groupName={entry.group.name} detailed />
      )}

      {entry.fast && (
        <div style={{ marginBottom: 14 }}>
          <div className="segmented">
            <button type="button" className={!fast ? 'selected' : ''} onClick={() => setFast(false)}>
              标准模式
            </button>
            <button type="button" className={fast ? 'selected' : ''} onClick={() => setFast(true)}>
              Fast 模式
            </button>
          </div>
        </div>
      )}

      <h3>标准时段实付价格</h3>
      {tiers.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>上下文档位</th>
                <th className="right">输入 / 1{unit}</th>
                <th className="right">输出 / 1{unit}</th>
                <th className="right">缓存读取 / 1{unit}</th>
                <th className="right">缓存写入 / 1{unit}</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier, i) => (
                <tr key={i}>
                  <td>{entry.group.long_context_pricing_enabled ? tier.label || '全部' : '全部'}</td>
                  <td className="right mono numeric">{formatUnitPrice(tier.input, unit)}</td>
                  <td className="right mono numeric">{formatUnitPrice(tier.output, unit)}</td>
                  <td className="right mono numeric">{formatUnitPrice(tier.cacheRead, unit)}</td>
                  <td className="right mono numeric">{formatUnitPrice(tier.cacheWrite, unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="kv-group">
          {paidRequestPrices(model, rate).map((price, i) => (
            <KeyValue key={i} label={price.label || '每次请求'}>
              {formatUsd(price.price)} USD
            </KeyValue>
          ))}
        </div>
      )}

      {model.time_pricing && (
        <>
          <h3>分时价格</h3>
          <p className="small muted">
            {model.time_pricing.timezone}
            {model.time_pricing.weekdays_only ? '，仅工作日生效' : ''}
          </p>
          <div className="kv-group">
            {model.time_pricing.periods.map(p => (
              <KeyValue key={p.start_time} label={`${p.start_time} - ${p.end_time}`}>
                {p.multiplier} 倍
              </KeyValue>
            ))}
          </div>
        </>
      )}

      {!!offTiers.length && (
        <>
          <h3>官方参考价格 / 1{unit}</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>上下文档位</th>
                  <th className="right">输入</th>
                  <th className="right">输出</th>
                  <th className="right">缓存读取</th>
                  <th className="right">缓存写入</th>
                </tr>
              </thead>
              <tbody>
                {offTiers.map((tier, i) => (
                  <tr key={i}>
                    <td>{tier.label || '全部'}</td>
                    <td className="right mono numeric">{formatUnitPrice(tier.input, unit)}</td>
                    <td className="right mono numeric">{formatUnitPrice(tier.output, unit)}</td>
                    <td className="right mono numeric">{formatUnitPrice(tier.cacheRead, unit)}</td>
                    <td className="right mono numeric">{formatUnitPrice(tier.cacheWrite, unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!!efforts.length && (
        <>
          <h3>思考等级倍率</h3>
          <div className="kv-group">
            {efforts.map(([effort, multiplier]) => (
              <KeyValue key={effort} label={effort}>
                {multiplier} 倍
              </KeyValue>
            ))}
          </div>
        </>
      )}

      {entry.group.peak_rate_enabled && (
        <div className="kv-group" style={{ marginTop: 14 }}>
          <KeyValue label={`高峰时段 ${entry.group.peak_start} - ${entry.group.peak_end}`}>
            {entry.group.peak_rate_multiplier} 倍
          </KeyValue>
        </div>
      )}

      {model.pricing_note === 'route_dependent' && (
        <p className="muted small" style={{ marginTop: 14 }}>
          费用随实际路由变化，请以请求记录中的结算金额为准。
        </p>
      )}
      {entry.group.description && (
        <p className="muted description" style={{ marginTop: 14 }}>
          {entry.group.description}
        </p>
      )}
    </Drawer>
  )
}
