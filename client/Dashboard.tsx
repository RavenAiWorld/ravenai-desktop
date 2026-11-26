import { useState } from 'react'
import { ArrowRight, ArrowUpRight, KeyRound } from 'lucide-react'
import { date, money, number, queryPath, site, useApi } from './native'
import type { Page, Stats, Trend, Usage, User } from './types'
import { Empty, ErrorMessage, Loading, useAction } from './ui'
import { UsageDetail, UsageTable } from './Usage'

export default function Dashboard({ user, navigate }: { user: User; navigate: (page: string) => void }) {
  const stats = useApi<Stats>('/usage/dashboard/stats'), recent = useApi<Page<Usage>>('/usage?page=1&page_size=5'), action = useAction()
  const end = new Date(), start = new Date(); start.setDate(start.getDate() - 13)
  const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const trend = useApi<{ trend: Trend[] }>(queryPath('/usage/dashboard/trend', { start_date: day(start), end_date: day(end), granularity: 'day', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))
  const [selected, setSelected] = useState<Usage | null>(null), [metric, setMetric] = useState<'requests' | 'actual_cost'>('actual_cost')
  const rows = trend.data?.trend || [], max = Math.max(...rows.map(r => Number(r[metric]) || 0), 0.001)
  return <><div className="welcome"><div><h2>{user.username || user.email.split('@')[0]}，你好</h2><p>账号运行概览</p></div><button onClick={() => navigate('keys')}><KeyRound size={16}/>管理密钥<ArrowRight size={15}/></button></div><ErrorMessage error={stats.error} retry={() => stats.refetch()}/>
    <div className="metrics"><div><span>可用余额</span><strong>{money(user.balance)}</strong><button className="text-link" onClick={() => action.run(() => site('/buy-credits'))}>充值<ArrowUpRight size={13}/></button></div><div><span>今日消费</span><strong>{money(stats.data?.today_actual_cost, 4)}</strong><small>累计 {money(stats.data?.total_actual_cost)}</small></div><div><span>今日请求</span><strong>{number(stats.data?.today_requests)}</strong><small>累计 {number(stats.data?.total_requests)} 次</small></div><div><span>今日 Token</span><strong>{number(stats.data?.today_tokens)}</strong><small>{number(stats.data?.active_api_keys)} 个密钥正在启用</small></div></div><ErrorMessage error={action.error}/>
    <section className="chart-section"><div className="section-title"><h2>使用趋势 <small>近 14 天</small></h2><div className="segmented"><button className={metric === 'actual_cost' ? 'selected' : ''} onClick={() => setMetric('actual_cost')}>消费</button><button className={metric === 'requests' ? 'selected' : ''} onClick={() => setMetric('requests')}>请求</button></div></div><ErrorMessage error={trend.error} retry={() => trend.refetch()}/>{trend.isPending ? <Loading/> : !rows.length ? !trend.error && <Empty title="尚无使用数据"/> : <div className="chart" role="img" aria-label={`近14天${metric === 'actual_cost' ? '消费' : '请求'}趋势`}><div className="chart-scale"><span>{metric === 'actual_cost' ? money(max, 2) : number(max)}</span><span>0</span></div><div className="bars">{rows.map((row, i) => <div key={row.date} className="bar-slot" title={`${row.date}: ${metric === 'actual_cost' ? money(row.actual_cost, 4) : `${row.requests} 次`}`}><div className="bar" style={{ height: `${Math.max(0.5, (Number(row[metric]) || 0) / max * 100)}%` }}/><span>{i % Math.max(1, Math.floor(rows.length / 7)) === 0 ? row.date.slice(5, 10) : ''}</span></div>)}</div></div>}</section>
    <section><div className="section-title"><h2>最近请求</h2><button className="text-link" onClick={() => navigate('usage')}>全部记录<ArrowRight size={15}/></button></div><ErrorMessage error={recent.error} retry={() => recent.refetch()}/>{recent.isPending ? <Loading/> : recent.data?.items.length ? <UsageTable rows={recent.data.items} onSelect={setSelected}/> : !recent.error && <Empty title="暂无调用记录"/>}</section>
    <p className="updated">数据更新于 {stats.dataUpdatedAt ? date(new Date(stats.dataUpdatedAt).toISOString()) : '--'}</p>{selected && <UsageDetail row={selected} onClose={() => setSelected(null)}/>}
  </>
}
