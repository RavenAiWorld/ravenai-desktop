import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, MessageSquare, Plus, Send } from 'lucide-react'
import { api, date, queryPath, site, useApi } from './native'
import type { Page, Ticket, TicketDetail } from './types'
import {
  Badge,
  Drawer,
  Empty,
  ErrorMessage,
  Field,
  Loading,
  Pagination,
  SearchInput,
  SelectMenu,
  useAction,
  useNotice,
} from './ui'

const categories: Record<string, string> = {
  account: '账号',
  billing: '账单',
  api: 'API 调用',
  image: '图片',
  other: '其他',
}

export default function Support() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const query = useApi<Page<Ticket>>(queryPath('/support-tickets', { page, page_size: 20, status, search }))

  return (
    <>
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={v => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="搜索工单"
        />
        <SelectMenu
          ariaLabel="工单状态"
          value={status}
          minWidth={145}
          options={[
            { value: '', label: '全部状态' },
            { value: 'open', label: '待处理' },
            { value: 'waiting', label: '等待回复' },
            { value: 'resolved', label: '已解决' },
            { value: 'closed', label: '已关闭' },
          ]}
          onChange={v => {
            setStatus(v)
            setPage(1)
          }}
        />
        <span className="spacer" />
        <button className="primary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          新建工单
        </button>
      </div>

      <ErrorMessage error={query.error} retry={() => query.refetch()} />

      <div className="table-card">
        {query.isPending ? (
          <Loading label="正在加载工单列表" />
        ) : !query.data?.items.length ? (
          !query.error && (
            <Empty
              icon={<MessageSquare size={20} />}
              title="暂无工单"
              detail="遇到接口异常或账单疑问时，可以随时提交支持工单。"
            />
          )
        ) : (
          <>
            <div className="ticket-list">
              {query.data.items.map(ticket => (
                <button key={ticket.id} className="ticket-row" onClick={() => setSelected(ticket.id)}>
                  <span className={`unread-dot ${ticket.unread ? 'on' : ''}`} />
                  <div>
                    <div className="ticket-row-title">
                      <strong>{ticket.title}</strong>
                      <span className="pill">{categories[ticket.category] || ticket.category}</span>
                    </div>
                    <p>{ticket.last_message_preview}</p>
                    <small className="mono">
                      #{ticket.id} · 更新于 {date(ticket.updated_at)}
                    </small>
                  </div>
                  <Badge value={ticket.status} />
                </button>
              ))}
            </div>
            <Pagination page={page} total={query.data.total} onChange={setPage} />
          </>
        )}
      </div>

      {creating && (
        <NewTicket
          onClose={() => setCreating(false)}
          onCreated={id => {
            setCreating(false)
            setSelected(id)
          }}
        />
      )}
      {selected && <Conversation id={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

function NewTicket({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('api')
  const [priority, setPriority] = useState('normal')
  const [request, setRequest] = useState('')
  const action = useAction()
  const cache = useQueryClient()

  return (
    <Drawer title="新建工单" onClose={() => !action.busy && onClose()}>
      <form
        onSubmit={e => {
          e.preventDefault()
          void action.run(async () => {
            const result = await api<{ id: number }>('/support-tickets', 'POST', {
              title: title.trim(),
              content: content.trim(),
              category,
              priority,
              request_id: request.trim(),
              attachments: [],
            })
            await cache.invalidateQueries()
            onCreated(result.id)
          })
        }}
      >
        <Field label="标题">
          <input autoFocus required maxLength={200} placeholder="简要描述你遇到的问题" value={title} onChange={e => setTitle(e.target.value)} />
        </Field>
        <div className="form-grid">
          <div className="field">
            <span>问题类型</span>
            <SelectMenu
              ariaLabel="问题类型"
              value={category}
              className="full"
              options={Object.entries(categories).map(([id, label]) => ({ value: id, label }))}
              onChange={setCategory}
            />
          </div>
          <div className="field">
            <span>优先级</span>
            <SelectMenu
              ariaLabel="优先级"
              value={priority}
              className="full"
              options={[
                { value: 'low', label: '低' },
                { value: 'normal', label: '普通' },
                { value: 'high', label: '紧急' },
              ]}
              onChange={setPriority}
            />
          </div>
        </div>
        <Field label="关联请求 ID (可选)">
          <input value={request} placeholder="如有报错可附上请求 ID" onChange={e => setRequest(e.target.value)} maxLength={200} />
        </Field>
        <Field label="问题描述">
          <textarea required rows={7} maxLength={20000} placeholder="请详细说明复现步骤、时间或报错现象" value={content} onChange={e => setContent(e.target.value)} />
        </Field>
        <ErrorMessage error={action.error} />
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={action.busy || !title.trim() || !content.trim()}>
            <Send size={15} />
            {action.busy ? '正在提交...' : '提交工单'}
          </button>
        </div>
      </form>
    </Drawer>
  )
}

function Conversation({ id, onClose }: { id: number; onClose: () => void }) {
  const query = useApi<TicketDetail>(`/support-tickets/${id}`)
  const [text, setText] = useState('')
  const action = useAction()
  const cache = useQueryClient()
  const notice = useNotice()
  const ticket = query.data?.ticket

  async function update(status: string) {
    await api(`/support-tickets/${id}`, 'PATCH', { status })
    await cache.invalidateQueries()
    notice('工单状态已更新')
  }

  return (
    <Drawer title={ticket?.title || `工单 #${id}`} onClose={onClose} wide>
      <ErrorMessage error={query.error} retry={() => query.refetch()} />
      {query.isPending ? (
        <Loading />
      ) : (
        query.data && (
          <>
            <div className="toolbar">
              <Badge value={ticket!.status} />
              <span className="pill">{categories[ticket!.category] || ticket!.category}</span>
              <span className="muted small mono">#{id}</span>
              <span className="spacer" />
              {ticket!.unread && (
                <button
                  disabled={action.busy}
                  onClick={() =>
                    action.run(async () => {
                      await api(`/support-tickets/${id}/read`, 'POST', { through_id: ticket!.last_message_id })
                      await cache.invalidateQueries()
                    })
                  }
                >
                  标为已读
                </button>
              )}
              {ticket!.status !== 'closed' && ticket!.status !== 'resolved' ? (
                <button disabled={action.busy} onClick={() => action.run(() => update('resolved'))}>
                  标记已解决
                </button>
              ) : (
                <button disabled={action.busy} onClick={() => action.run(() => update('open'))}>
                  重新打开
                </button>
              )}
            </div>

            <div className="messages">
              {query.data.messages.map(message => (
                <article key={message.id} className={`message ${message.author_role === 'admin' ? 'staff' : ''}`}>
                  <header>
                    <strong>{message.author_role === 'admin' ? 'Ravenai 支持' : '我'}</strong>
                    <time className="mono">{date(message.created_at)}</time>
                  </header>
                  <p>{message.content}</p>
                  {message.attachments.length > 0 && (
                    <button onClick={() => action.run(() => site('/support'))}>
                      在官网查看附件
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                </article>
              ))}
            </div>

            <form
              onSubmit={e => {
                e.preventDefault()
                void action.run(async () => {
                  await api(`/support-tickets/${id}/replies`, 'POST', { content: text.trim(), attachments: [] })
                  setText('')
                  await cache.invalidateQueries()
                })
              }}
            >
              <Field label="回复">
                <textarea
                  required
                  rows={4}
                  placeholder={ticket!.status === 'closed' ? '工单已关闭，可重新打开后继续回复' : '输入回复内容...'}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  maxLength={20000}
                  disabled={ticket!.status === 'closed'}
                />
              </Field>
              <ErrorMessage error={action.error} />
              <div className="form-actions">
                <button className="primary" disabled={action.busy || !text.trim() || ticket!.status === 'closed'}>
                  <Send size={15} />
                  发送回复
                </button>
              </div>
            </form>
          </>
        )
      )}
    </Drawer>
  )
}
