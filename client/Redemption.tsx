import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Gift, RefreshCw, Wallet, Zap } from 'lucide-react'
import { api, date, money, queryPath, useApi } from './native'
import type { Page, User } from './types'
import { Empty, ErrorMessage, Field, IconButton, Loading, Pagination, useAction, useNotice } from './ui'

interface RedemptionResult {
  message: string
  type: string
  value: number
  bonus_amount?: number
  credited_value?: number
  new_balance?: number
  new_concurrency?: number
}

interface RedemptionRecord extends RedemptionResult {
  id: number
  used_at: string
  notes?: string
  group?: { name: string }
  validity_days?: number
}

const typeName: Record<string, string> = {
  balance: '余额',
  concurrency: '并发',
  subscription: '订阅套餐',
  admin_balance: '余额调整',
  admin_concurrency: '并发调整',
}

export default function Redemption({ user }: { user?: User }) {
  const [code, setCode] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<RedemptionResult | null>(null)
  const action = useAction()
  const notice = useNotice()
  const cache = useQueryClient()
  const history = useApi<Page<RedemptionRecord>>(queryPath('/redeem/history', { page, page_size: 10 }))

  return (
    <>
      {user && (
        <div className="module-summary">
          <div className="metric-card featured">
            <div className="metric-top">
              <span className="metric-label">可用余额</span>
              <span className="metric-icon">
                <Wallet size={14} />
              </span>
            </div>
            <strong className="metric-value numeric">{money(user.balance)}</strong>
          </div>
          <div className="metric-card">
            <div className="metric-top">
              <span className="metric-label">当前并发</span>
              <span className="metric-icon">
                <Zap size={14} />
              </span>
            </div>
            <strong className="metric-value numeric">{user.concurrency}</strong>
          </div>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <form
          className="redeem-form"
          onSubmit={e => {
            e.preventDefault()
            void action.run(async () => {
              setResult(null)
              const redeemed = await api<RedemptionResult>('/redeem', 'POST', { code: code.trim() })
              setResult(redeemed)
              setCode('')
              setPage(1)
              await cache.invalidateQueries({
                predicate: q => {
                  const path = q.queryKey[0]
                  return (
                    typeof path === 'string' &&
                    ['/redeem/history', '/auth/me', '/subscriptions'].some(prefix => path.startsWith(prefix))
                  )
                },
              })
              notice(redeemed.message || '兑换成功')
            })
          }}
        >
          <Field label="兑换码">
            <input
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="输入卡密或活动兑换码"
              value={code}
              onChange={e => setCode(e.target.value)}
              maxLength={200}
              disabled={action.busy}
            />
          </Field>
          <button className="primary" disabled={action.busy || !code.trim()}>
            <Gift size={16} />
            {action.busy ? '正在兑换...' : '兑换'}
          </button>
        </form>

        <ErrorMessage error={action.error} />

        {result && (
          <div className="redemption-result" role="status">
            <strong>{result.message || '兑换成功'}</strong>
            {result.new_balance != null && <span className="mono">当前余额 {money(result.new_balance)}</span>}
            {result.new_concurrency != null && <span className="mono">当前并发 {result.new_concurrency}</span>}
            {!!result.bonus_amount && <span className="mono">含赠送额度 {money(result.bonus_amount)}</span>}
            {result.type === 'subscription' && <span>订阅套餐已到账</span>}
          </div>
        )}
      </div>

      <section className="table-card">
        <div className="card-header">
          <h2>兑换记录</h2>
          <IconButton label="刷新兑换记录" disabled={history.isFetching} onClick={() => history.refetch()}>
            <RefreshCw size={15} className={history.isFetching ? 'spin' : ''} />
          </IconButton>
        </div>

        <ErrorMessage error={history.error} retry={() => history.refetch()} />

        {history.isPending ? (
          <Loading label="正在加载兑换记录" />
        ) : !history.data?.items.length ? (
          !history.error && <Empty icon={<Gift size={20} />} title="暂无兑换记录" detail="兑换成功的卡密或订阅记录会保存在这里。" />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>到账额度</th>
                    <th>赠送额度</th>
                    <th>详情</th>
                    <th>兑换时间</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.items.map(item => (
                    <tr key={item.id}>
                      <td>
                        <span className="pill">{typeName[item.type] || item.type}</span>
                      </td>
                      <td className="mono numeric">
                        {['balance', 'admin_balance'].includes(item.type)
                          ? money(item.credited_value ?? item.value)
                          : item.type === 'subscription'
                            ? `${item.validity_days ?? item.value} 天`
                            : item.value}
                      </td>
                      <td className="mono numeric">{item.bonus_amount ? money(item.bonus_amount) : '--'}</td>
                      <td>{item.group?.name || item.notes || '--'}</td>
                      <td className="small muted mono">{date(item.used_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={history.data.total} size={10} onChange={setPage} />
          </>
        )}
      </section>
    </>
  )
}
