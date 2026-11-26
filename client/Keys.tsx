import { useDeferredValue, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, KeyRound, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, date, money, queryPath, useApi } from './native'
import type { ApiKey, Group, Page } from './types'
import { Badge, CopyButton, Drawer, Empty, ErrorMessage, Field, IconButton, KeyValue, Loading, Pagination, SearchInput, useAction, useNotice } from './ui'

export default function Keys({ baseUrl }: { baseUrl: string }) {
  const [search, setSearch] = useState(''), deferred = useDeferredValue(search), [page, setPage] = useState(1), [status, setStatus] = useState('')
  const [selected, setSelected] = useState<ApiKey | null>(null), [edit, setEdit] = useState<ApiKey | 'new' | null>(null), [deleting, setDeleting] = useState<ApiKey | null>(null)
  const query = useApi<Page<ApiKey>>(queryPath('/keys', { page, page_size: 20, search: deferred, status })), action = useAction(), cache = useQueryClient(), notice = useNotice()
  return <>
    <div className="toolbar"><SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="搜索密钥名称"/><select aria-label="密钥状态" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">全部状态</option><option value="active">正常</option><option value="inactive">已停用</option><option value="expired">已过期</option><option value="quota_exhausted">额度用尽</option></select><span className="spacer"/><button className="primary" onClick={() => setEdit('new')}><Plus size={17}/>创建密钥</button></div>
    <ErrorMessage error={query.error} retry={() => query.refetch()}/>
    {query.isPending ? <Loading/> : !query.data?.items.length ? !query.error && <Empty title="暂无 API 密钥" detail="创建一个密钥，开始调用模型。"/> : <>
      <div className="table-scroll"><table><thead><tr><th>名称 / 密钥</th><th>分组</th><th>状态</th><th>已用 / 限额</th><th>最近使用</th><th className="right">操作</th></tr></thead><tbody>{query.data.items.map(key => <tr key={key.id}><td><button className="text-link" onClick={() => setSelected(key)}>{key.name}</button><small className="mono">{key.key.slice(0, 7)}...{key.key.slice(-4)}</small></td><td>{key.group?.name || '默认分组'}</td><td><Badge value={key.status}/></td><td className="numeric">{money(key.quota_used)} <span className="muted">/ {key.quota ? money(key.quota) : '不限'}</span></td><td className="muted small">{date(key.last_used_at)}</td><td><div className="row-actions"><IconButton label="查看密钥" onClick={() => setSelected(key)}><KeyRound size={16}/></IconButton><IconButton label="编辑密钥" onClick={() => setEdit(key)}><Pencil size={16}/></IconButton><IconButton label="删除密钥" onClick={() => { action.setError(''); setDeleting(key) }}><Trash2 size={16}/></IconButton></div></td></tr>)}</tbody></table></div><Pagination page={page} total={query.data.total} onChange={setPage}/>
    </>}
    {selected && <KeyDetails item={selected} baseUrl={baseUrl} onClose={() => setSelected(null)}/>}
    {edit && <KeyEditor item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void cache.invalidateQueries(); notice('密钥已保存') }}/>}
    {deleting && <Drawer title="删除 API 密钥" onClose={() => !action.busy && setDeleting(null)}><p>删除「{deleting.name}」后，使用此密钥的应用将无法继续调用。</p><ErrorMessage error={action.error}/><div className="form-actions"><button onClick={() => setDeleting(null)} disabled={action.busy}>保留密钥</button><button className="danger" disabled={action.busy} onClick={() => action.run(async () => { await api(`/keys/${deleting.id}`, 'DELETE'); setDeleting(null); await cache.invalidateQueries(); notice('密钥已删除') })}>{action.busy ? '正在删除...' : '删除密钥'}</button></div></Drawer>}
  </>
}

function KeyDetails({ item, baseUrl, onClose }: { item: ApiKey; baseUrl: string; onClose: () => void }) {
  const [reveal, setReveal] = useState(false), query = useApi<ApiKey>(`/keys/${item.id}`), key = query.data || item
  return <Drawer title={key.name} onClose={onClose}><ErrorMessage error={query.error}/><div className="secret"><code>{reveal ? key.key : `${key.key.slice(0, 7)}${'*'.repeat(24)}${key.key.slice(-4)}`}</code><IconButton label={reveal ? '隐藏密钥' : '显示密钥'} onClick={() => setReveal(!reveal)}>{reveal ? <EyeOff size={17}/> : <Eye size={17}/>}</IconButton><CopyButton text={key.key} label="复制 API 密钥"/></div><KeyValue label="API 地址"><code>{baseUrl}</code><CopyButton text={baseUrl}/></KeyValue><KeyValue label="分组">{key.group?.name || '默认分组'}</KeyValue><KeyValue label="状态"><Badge value={key.status}/></KeyValue><KeyValue label="已用额度">{money(key.quota_used, 4)}</KeyValue><KeyValue label="额度上限">{key.quota ? money(key.quota) : '不限'}</KeyValue><KeyValue label="到期时间">{key.expires_at ? date(key.expires_at) : '长期有效'}</KeyValue><KeyValue label="创建时间">{date(key.created_at)}</KeyValue><KeyValue label="IP 白名单">{key.ip_whitelist?.join(', ') || '不限'}</KeyValue><KeyValue label="IP 黑名单">{key.ip_blacklist?.join(', ') || '无'}</KeyValue><h3>额度窗口</h3>{([['5 小时', key.rate_limit_5h], ['1 天', key.rate_limit_1d], ['7 天', key.rate_limit_7d]] as const).map(([name, limit]) => <KeyValue key={name} label={name}>{limit ? money(limit) : '不限'}</KeyValue>)}</Drawer>
}

function localDate(value: string | null) { if (!value) return ''; const d = new Date(value); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
function KeyEditor({ item, onClose, onSaved }: { item: ApiKey | 'new'; onClose: () => void; onSaved: () => void }) {
  const key = item === 'new' ? null : item
  const groups = useApi<Group[]>('/groups/available?include_maintenance=true'), action = useAction()
  const [name, setName] = useState(key?.name || ''), [group, setGroup] = useState(String(key?.group_id || '')), [status, setStatus] = useState(key?.status === 'inactive' ? 'inactive' : 'active')
  const [quota, setQuota] = useState(key?.quota || 0), [expires, setExpires] = useState(localDate(key?.expires_at || null)), [days, setDays] = useState(0)
  const [white, setWhite] = useState(key?.ip_whitelist?.join('\n') || ''), [black, setBlack] = useState(key?.ip_blacklist?.join('\n') || '')
  const [limits, setLimits] = useState([key?.rate_limit_5h || 0, key?.rate_limit_1d || 0, key?.rate_limit_7d || 0]), [reset, setReset] = useState(false)
  const selectedGroup = groups.data?.find(g => String(g.id) === group)
  return <Drawer title={key ? '编辑密钥' : '创建 API 密钥'} onClose={() => !action.busy && onClose()}><form onSubmit={e => { e.preventDefault(); void action.run(async () => {
    const payload: Record<string, unknown> = { name: name.trim(), group_id: group ? Number(group) : null, quota, ip_whitelist: white.split(/[\n,]+/).map(s => s.trim()).filter(Boolean), ip_blacklist: black.split(/[\n,]+/).map(s => s.trim()).filter(Boolean), rate_limit_5h: limits[0], rate_limit_1d: limits[1], rate_limit_7d: limits[2] }
    if (key) { payload.status = status; payload.expires_at = expires ? new Date(expires).toISOString() : ''; payload.reset_quota = reset }
    else if (days > 0) payload.expires_in_days = days
    await api(key ? `/keys/${key.id}` : '/keys', key ? 'PUT' : 'POST', payload); onSaved()
  }) }}>
    <Field label="名称"><input required maxLength={100} autoFocus value={name} onChange={e => setName(e.target.value)}/></Field>
    <Field label="分组"><select value={group} onChange={e => setGroup(e.target.value)} disabled={groups.isPending}><option value="">默认分组</option>{groups.data?.map(g => <option key={g.id} value={g.id} disabled={g.status === 'maintenance' && key?.group_id !== g.id}>{g.name}{g.status === 'maintenance' ? ' (维护中)' : ''}</option>)}</select></Field><ErrorMessage error={groups.error} retry={() => groups.refetch()}/>
    {selectedGroup?.status === 'maintenance' && <p className="muted small">该分组正在维护，暂时无法使用。</p>}
    <div className="form-grid"><Field label="额度上限 (USD)" hint="0 表示不限"><input type="number" min="0" step="0.01" value={quota} onChange={e => setQuota(Number(e.target.value))}/></Field>{key ? <Field label="到期时间"><input type="datetime-local" value={expires} onChange={e => setExpires(e.target.value)}/></Field> : <Field label="有效期 (天)" hint="0 表示长期有效"><input type="number" min="0" max="3650" value={days} onChange={e => setDays(Number(e.target.value))}/></Field>}</div>
    {key && <Field label="启用状态"><select value={status} onChange={e => setStatus(e.target.value)}><option value="active">启用</option><option value="inactive">停用</option></select></Field>}
    <h3>周期额度</h3><div className="form-grid three">{['5 小时 (USD)', '1 天 (USD)', '7 天 (USD)'].map((title, i) => <Field key={title} label={title}><input type="number" min="0" step="0.01" value={limits[i]} onChange={e => setLimits(old => old.map((v, j) => i === j ? Number(e.target.value) : v))}/></Field>)}</div>
    <Field label="IP 白名单" hint="每行一个 IP 或 CIDR，留空表示不限"><textarea rows={3} value={white} onChange={e => setWhite(e.target.value)}/></Field><Field label="IP 黑名单"><textarea rows={3} value={black} onChange={e => setBlack(e.target.value)}/></Field>
    {key && <label className="checkbox"><input type="checkbox" checked={reset} onChange={e => setReset(e.target.checked)}/>重置此密钥的已用额度</label>}
    <ErrorMessage error={action.error}/><div className="form-actions"><button type="button" onClick={onClose} disabled={action.busy}>取消</button><button className="primary" disabled={action.busy || groups.isPending || !!groups.error || !name.trim()}>{action.busy ? '正在保存...' : '保存密钥'}</button></div>
  </form></Drawer>
}
