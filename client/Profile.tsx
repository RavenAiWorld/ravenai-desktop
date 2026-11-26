import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Gift, LogOut, Percent, ShieldCheck, Users, Wallet } from 'lucide-react'
import { api, date, money, site, useApi } from './native'
import type { User } from './types'
import { Badge, CopyButton, Empty, ErrorMessage, Field, KeyValue, Loading, useAction, useNotice } from './ui'

interface Subscription {
  id: number
  group_name: string
  status: string
  daily_progress: number | null
  weekly_progress: number | null
  monthly_progress: number | null
  expires_at: string | null
  days_remaining: number | null
}

interface Affiliate {
  aff_code: string
  aff_count: number
  aff_quota: number
  aff_frozen_quota: number
  aff_history_quota: number
  effective_rebate_rate_percent: number
  invitees: { user_id: number; username: string; email: string; total_rebate: number }[]
}

export default function Profile({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [name, setName] = useState(user.username)
  const [tab, setTab] = useState('profile')
  const action = useAction()
  const cache = useQueryClient()
  const notice = useNotice()
  const subs = useApi<{ subscriptions: Subscription[]; active_count: number }>(
    '/subscriptions/summary',
    tab === 'subscriptions',
  )
  const aff = useApi<Affiliate>('/user/aff', tab === 'invite')

  return (
    <>
      <div className="profile-hero">
        <span className="avatar large">{(user.username || user.email).slice(0, 1).toUpperCase()}</span>
        <div className="profile-hero-meta">
          <div className="profile-hero-title">
            <h2>{user.username || 'Ravenai 用户'}</h2>
            <Badge value={user.status} />
            <span className="pill pill-mono">并发 {user.concurrency}</span>
          </div>
          <p>{user.email}</p>
        </div>
        <span className="spacer" />
        <button onClick={onLogout}>
          <LogOut size={15} />
          退出登录
        </button>
      </div>

      <div className="tabs">
        {[
          ['profile', '账号资料'],
          ['subscriptions', '我的订阅'],
          ['invite', '邀请返利'],
        ].map(([id, text]) => (
          <button
            key={id}
            className={tab === id ? 'selected' : ''}
            onClick={() => {
              action.setError('')
              setTab(id)
            }}
          >
            {text}
          </button>
        ))}
      </div>

      <ErrorMessage error={action.error} />

      {tab === 'profile' && (
        <>
          <div className="profile-grid">
            <div className="card card-pad">
              <h3 style={{ marginTop: 0 }}>基本资料</h3>
              <form
                onSubmit={e => {
                  e.preventDefault()
                  void action.run(async () => {
                    await api('/user', 'PUT', { username: name.trim() })
                    await cache.invalidateQueries()
                    notice('账号资料已更新')
                  })
                }}
              >
                <Field label="显示名称">
                  <input value={name} required maxLength={100} onChange={e => setName(e.target.value)} />
                </Field>
                <button className="primary" disabled={action.busy || !name.trim() || name === user.username}>
                  保存资料
                </button>
              </form>
            </div>

            <div className="card card-pad">
              <h3 style={{ marginTop: 0 }}>账号信息</h3>
              <div className="kv-group" style={{ marginBottom: 0 }}>
                <KeyValue label="邮箱">{user.email}</KeyValue>
                <KeyValue label="账号状态">
                  <Badge value={user.status} />
                </KeyValue>
                <KeyValue label="并发数">
                  <span className="mono">{user.concurrency}</span>
                </KeyValue>
                <KeyValue label="注册时间">
                  <span className="mono">{date(user.created_at)}</span>
                </KeyValue>
              </div>
            </div>
          </div>

          <div className="security-card">
            <div className="security-icon">
              <ShieldCheck size={20} />
            </div>
            <div>
              <strong>账号安全与会话管理</strong>
              <small>修改登录密码、配置双重验证（2FA）及管理全部设备会话</small>
            </div>
            <button onClick={() => action.run(() => site('/profile'))}>
              管理
              <ArrowUpRight size={15} />
            </button>
          </div>
        </>
      )}

      {tab === 'subscriptions' && (
        <>
          <ErrorMessage error={subs.error} retry={() => subs.refetch()} />
          {subs.isPending ? (
            <Loading label="正在加载订阅状态" />
          ) : !subs.data?.subscriptions.length ? (
            <div className="card">
              <Empty title="暂无订阅" detail="前往官网了解包月与专属分组套餐。" />
            </div>
          ) : (
            <div className="subscription-list">
              {subs.data.subscriptions.map(item => (
                <article key={item.id} className="subscription-card">
                  <div className="section-title">
                    <h3>{item.group_name}</h3>
                    <Badge value={item.status} />
                  </div>
                  <p className="muted small mono">{item.expires_at ? `${date(item.expires_at)} 到期` : '长期有效'}</p>
                  {(
                    [
                      ['每日额度', item.daily_progress],
                      ['每周额度', item.weekly_progress],
                      ['每月额度', item.monthly_progress],
                    ] as const
                  ).map(([title, value]) =>
                    value == null ? null : (
                      <div className="progress-row" key={title}>
                        <span>{title}</span>
                        <div className="progress-track" role="progressbar" aria-valuenow={Math.min(100, value)} aria-valuemin={0} aria-valuemax={100}>
                          <div className="progress-fill" style={{ width: `${Math.min(100, value)}%` }} />
                        </div>
                        <span>{value.toFixed(1)}%</span>
                      </div>
                    ),
                  )}
                </article>
              ))}
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <button onClick={() => action.run(() => site('/purchase'))}>
              查看订阅套餐
              <ArrowUpRight size={15} />
            </button>
          </div>
        </>
      )}

      {tab === 'invite' && (
        <>
          <ErrorMessage error={aff.error} retry={() => aff.refetch()} />
          {aff.isPending ? (
            <Loading label="正在加载返利数据" />
          ) : (
            aff.data && (
              <>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-top">
                      <span className="metric-label">邀请人数</span>
                      <span className="metric-icon">
                        <Users size={15} />
                      </span>
                    </div>
                    <strong className="metric-value">{aff.data.aff_count}</strong>
                  </div>
                  <div className="metric-card featured">
                    <div className="metric-top">
                      <span className="metric-label">可转入余额</span>
                      <span className="metric-icon">
                        <Wallet size={15} />
                      </span>
                    </div>
                    <strong className="metric-value">{money(aff.data.aff_quota)}</strong>
                  </div>
                  <div className="metric-card">
                    <div className="metric-top">
                      <span className="metric-label">累计返利</span>
                      <span className="metric-icon">
                        <Gift size={15} />
                      </span>
                    </div>
                    <strong className="metric-value">{money(aff.data.aff_history_quota)}</strong>
                  </div>
                  <div className="metric-card">
                    <div className="metric-top">
                      <span className="metric-label">返利比例</span>
                      <span className="metric-icon">
                        <Percent size={15} />
                      </span>
                    </div>
                    <strong className="metric-value">{aff.data.effective_rebate_rate_percent}%</strong>
                  </div>
                </div>

                <div className="card card-pad" style={{ marginBottom: 18 }}>
                  <div className="kv-group" style={{ marginBottom: 0 }}>
                    <KeyValue label="邀请码">
                      <code>{aff.data.aff_code}</code>
                      <CopyButton text={aff.data.aff_code} />
                    </KeyValue>
                    <KeyValue label="邀请链接">
                      <code>{`https://ravenaiworld.org/register?aff=${encodeURIComponent(aff.data.aff_code)}`}</code>
                      <CopyButton
                        text={`https://ravenaiworld.org/register?aff=${encodeURIComponent(aff.data.aff_code)}`}
                      />
                    </KeyValue>
                  </div>
                  <div className="form-actions">
                    <button
                      className="primary"
                      disabled={action.busy || aff.data.aff_quota <= 0}
                      onClick={() =>
                        action.run(async () => {
                          await api('/user/aff/transfer', 'POST')
                          await cache.invalidateQueries()
                          notice('返利已转入余额')
                        })
                      }
                    >
                      转入账号余额
                    </button>
                  </div>
                </div>

                <div className="table-card">
                  <div className="card-header">
                    <h2>邀请记录</h2>
                  </div>
                  {aff.data.invitees.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>用户</th>
                            <th className="right">累计返利</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aff.data.invitees.map(item => (
                            <tr key={item.user_id}>
                              <td>{item.username || item.email}</td>
                              <td className="right mono numeric">{money(item.total_rebate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty title="暂无邀请记录" detail="分享你的专属邀请链接，好友充值即可获得返利。" />
                  )}
                </div>
              </>
            )
          )}
        </>
      )}
    </>
  )
}
