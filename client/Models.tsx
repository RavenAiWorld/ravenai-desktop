import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useApi } from './native'
import { Badge, CopyButton, Drawer, Empty, ErrorMessage, KeyValue, Loading, SearchInput } from './ui'
import type { ModelPlazaResponse } from './pricing/modelPlaza'
import { buildEntries, catalogModels, entryTitle, formatContextSize, formatUnitPrice, isPlazaGroupVisible, paidRate, paidRequestPrices, paidTokenTiers, vendorMeta, VENDORS, type PlazaEntry } from './pricing/catalog'

export default function Models() {
  const query = useApi<ModelPlazaResponse>('/model-plaza'), [search, setSearch] = useState(''), [group, setGroup] = useState(''), [vendor, setVendor] = useState(''), [selected, setSelected] = useState<PlazaEntry | null>(null)
  const groups = (query.data?.groups || []).filter(isPlazaGroupVisible)
  const entries = useMemo(() => {
    const all = (query.data?.groups || []).filter(isPlazaGroupVisible).filter(g => !group || String(g.id) === group).flatMap(buildEntries)
    return (group ? all : catalogModels(all)).filter(e => (!vendor || e.vendor === vendor) && `${e.model.name} ${entryTitle(e)} ${e.group.name}`.toLowerCase().includes(search.trim().toLowerCase()))
  }, [query.data, group, vendor, search])
  return <><div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="搜索模型、名称或分组"/><select aria-label="模型厂商" value={vendor} onChange={e => setVendor(e.target.value)}><option value="">全部厂商</option>{VENDORS.map(v => <option key={v.id} value={v.id}>{v.label || '其他'}</option>)}</select><select aria-label="模型分组" value={group} onChange={e => setGroup(e.target.value)}><option value="">全部分组</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select><span className="spacer"/><span className="muted small">{entries.length} 个模型</span></div>
    <ErrorMessage error={query.error} retry={() => query.refetch()}/>{query.isPending ? <Loading/> : !entries.length ? !query.error && <Empty title="没有符合条件的模型"/> : <div className="table-scroll"><table className="models-table"><thead><tr><th>模型</th><th>可用分组</th><th>上下文</th><th className="right">输入 / 1M</th><th className="right">输出 / 1M</th><th className="right">缓存读取 / 1M</th><th/></tr></thead><tbody>{entries.map(entry => {
      const rate = paidRate(entry.model, entry.group), tier = paidTokenTiers(entry.model, rate)[0], requests = paidRequestPrices(entry.model, rate)
      return <tr key={entry.key} onClick={() => setSelected(entry)} className="clickable"><td><button className="text-link" onClick={() => setSelected(entry)}>{entryTitle(entry)}</button><small className="mono">{vendorMeta(entry.vendor).label || entry.model.platform} / {entry.model.name}</small></td><td><span className="small">{entry.group.name}</span>{entry.group.status === 'maintenance' && <Badge value="maintenance"/>}</td><td className="muted numeric">{entry.info?.context_window ? formatContextSize(entry.info.context_window) : '--'}</td>{tier ? <><td className="right numeric">{formatUnitPrice(tier.input, 'M')}</td><td className="right numeric">{formatUnitPrice(tier.output, 'M')}</td><td className="right numeric">{formatUnitPrice(tier.cacheRead, 'M')}</td></> : <td colSpan={3} className="right numeric">{requests.length ? `${requests[0].price} USD / ${entry.model.pricing?.billing_mode === 'image' ? '张' : '次'}` : '价格未公布'}</td>}<td><ChevronRight size={16}/></td></tr>
    })}</tbody></table></div>}
    {selected && <ModelDetail entry={selected} onClose={() => setSelected(null)}/>}
  </>
}
function ModelDetail({ entry, onClose }: { entry: PlazaEntry; onClose: () => void }) {
  const [fast, setFast] = useState(false), model = fast && entry.fast ? entry.fast : entry.model, rate = paidRate(model, entry.group)
  const allTiers = paidTokenTiers(model, rate), tiers = entry.group.long_context_pricing_enabled ? allTiers : allTiers.slice(0, 1)
  return <Drawer title={entryTitle(entry)} onClose={onClose} wide><div className="model-identity"><span className="vendor-letter">{vendorMeta(entry.vendor).label.slice(0, 1) || 'M'}</span><div><strong>{vendorMeta(entry.vendor).label || model.platform}</strong><small>{entry.group.name}</small></div></div>{entry.info?.description && <p className="muted description">{entry.info.description}</p>}<KeyValue label="模型 ID"><code>{model.name}</code><CopyButton text={model.name}/></KeyValue><KeyValue label="上下文窗口">{entry.info?.context_window ? formatContextSize(entry.info.context_window) : '未公布'}</KeyValue><KeyValue label="最大输出">{entry.info?.max_output_tokens ? formatContextSize(entry.info.max_output_tokens) : '未公布'}</KeyValue><KeyValue label="分组状态"><Badge value={entry.group.status || 'active'}/></KeyValue>{entry.fast && <div className="segmented"><button className={!fast ? 'selected' : ''} onClick={() => setFast(false)}>标准</button><button className={fast ? 'selected' : ''} onClick={() => setFast(true)}>Fast</button></div>}
    <h3>标准时段实付价格</h3>{tiers.length ? <div className="table-scroll"><table><thead><tr><th>上下文档位</th><th>输入 / 1M</th><th>输出 / 1M</th><th>缓存读取 / 1M</th><th>缓存写入 / 1M</th></tr></thead><tbody>{tiers.map((tier, i) => <tr key={i}><td>{entry.group.long_context_pricing_enabled ? tier.label || '全部' : '全部'}</td><td>{formatUnitPrice(tier.input, 'M')}</td><td>{formatUnitPrice(tier.output, 'M')}</td><td>{formatUnitPrice(tier.cacheRead, 'M')}</td><td>{formatUnitPrice(tier.cacheWrite, 'M')}</td></tr>)}</tbody></table></div> : paidRequestPrices(model, rate).map((price, i) => <KeyValue key={i} label={price.label || '每次请求'}>{price.price} USD</KeyValue>)}
    {model.time_pricing && <><h3>分时价格</h3><p className="small muted">{model.time_pricing.timezone}{model.time_pricing.weekdays_only ? '，仅工作日生效' : ''}</p>{model.time_pricing.periods.map(p => <KeyValue key={p.start_time} label={`${p.start_time} - ${p.end_time}`}>{p.multiplier} 倍</KeyValue>)}</>}
    {entry.group.peak_rate_enabled && <KeyValue label={`高峰时段 ${entry.group.peak_start} - ${entry.group.peak_end}`}>{entry.group.peak_rate_multiplier} 倍</KeyValue>}
    {model.pricing_note === 'route_dependent' && <p className="muted small">费用随实际路由变化，请以请求记录中的结算金额为准。</p>}
    {entry.group.description && <p className="muted description">{entry.group.description}</p>}
  </Drawer>
}
