import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Image as ImageIcon, RefreshCw, ShieldCheck, ZoomIn } from 'lucide-react'
import { api } from './native'
import { Drawer, Empty, ErrorMessage, IconButton, Loading } from './ui'
import { VendorIcon } from './VendorIcon'
import { decodeModelTrace, modelTraceRetainedUntil, type ModelTraceStatus } from './status/modelTrace'

const statuses: Record<ModelTraceStatus, string> = {
  passed: '检测通过',
  suspected: '存在疑点',
  failed: '检测失败',
  stale: '证据已过期',
}

const stageLabels = {
  detection: '检测',
  text: '文本',
  image: '生图',
}

const beijing = (value: string) =>
  new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })

const beijingShort = (value: string) =>
  new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

export default function ModelTrace() {
  const [selected, setSelected] = useState('')
  const [zoom, setZoom] = useState(false)
  const [now, setNow] = useState(Date.now())

  const query = useQuery({
    queryKey: ['model-trace', selected],
    queryFn: async () => ({
      snapshot: decodeModelTrace(await api(selected ? `/model-trace/reports/${selected}` : '/model-trace')),
      receivedAt: Date.now(),
    }),
    staleTime: 30_000,
    retry: 1,
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => setZoom(false), [selected])

  const data = query.data?.snapshot
  const serverNow = data ? Date.parse(data.server_time) + Math.max(0, now - query.data!.receivedAt) : now
  const report = data?.report && serverNow < modelTraceRetainedUntil(data.report.completed_at) ? data.report : undefined
  const history = data?.history.filter(item => serverNow < modelTraceRetainedUntil(item.completed_at)) || []
  const imagePath = report?.image?.url?.slice('/api/v1'.length)
  const image = useQuery({
    queryKey: ['model-trace-image', imagePath],
    queryFn: () => api<string>(imagePath!),
    enabled: !!imagePath,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: 1,
  })
  const status: ModelTraceStatus | undefined =
    report && serverNow >= Date.parse(report.expires_at) ? 'stale' : report?.status
  const textModel = report?.stages.find(s => s.key === 'text')?.model
  const imageModel = report?.stages.find(s => s.key === 'image')?.model

  return (
    <>
      <ErrorMessage error={query.error} retry={() => query.refetch()} />

      {query.isPending ? (
        <div className="card">
          <Loading label="正在读取检测报告" />
        </div>
      ) : (
        <div className="trace-layout trace-layout-compact">
          <div className="trace-main">
            {/* Compact Top Bar: Verdict + Stage Chips + Refresh */}
            <div className={`trace-result trace-result-compact ${status ? `trace-${status}` : ''}`}>
              <span className="trace-result-icon">
                <ShieldCheck size={17} />
              </span>
              <div className="trace-result-meta">
                <div className="trace-result-title-row">
                  <strong>{report ? statuses[status!] : 'GPT分组降智检测'}</strong>
                  <span className="pill">
                    <Clock size={11} />
                    24h · 北京时间
                  </span>
                </div>
                {report && (
                  <small className="mono">
                    完成 {beijingShort(report.completed_at)} · 有效至 {beijingShort(report.expires_at)}
                  </small>
                )}
              </div>

              {!!report?.stages.length && (
                <div className="trace-stage-chips">
                  {report.stages.map(stage => (
                    <span key={stage.key} className="trace-stage-chip" title={`${stageLabels[stage.key]}：${stage.model}`}>
                      <span className="trace-stage-chip-key">{stageLabels[stage.key]}</span>
                      <VendorIcon vendor={stage.model} size={13} />
                      <code>{stage.model}</code>
                      {stage.reasoning_effort && <em className="mono">{stage.reasoning_effort}</em>}
                    </span>
                  ))}
                </div>
              )}

              <span className="spacer" />

              <div className="trace-result-actions">
                {selected && (
                  <button type="button" onClick={() => setSelected('')}>
                    最新检测
                  </button>
                )}
                <IconButton
                  label="刷新GPT分组降智检测"
                  disabled={query.isFetching}
                  onClick={() => {
                    void query.refetch()
                    if (imagePath) void image.refetch()
                  }}
                >
                  <RefreshCw size={15} className={query.isFetching ? 'spin' : ''} />
                </IconButton>
              </div>
            </div>

            {!report ? (
              !query.error && (
                <div className="card">
                  <Empty
                    icon={<ShieldCheck size={20} />}
                    title="暂无有效检测报告"
                    detail="已完成的检测报告会保留 24 小时，全程只读同步不消耗额度。"
                  />
                </div>
              )
            ) : (
              /* Side-by-Side Two-Column Evidence Cards — Fits Above the Fold! */
              <div className="trace-evidence-grid">
                <section className="trace-stage-card compact">
                  <div className="trace-stage-head compact">
                    <div className="trace-stage-title">
                      <span className="trace-num">01</span>
                      <h2 style={{ fontSize: 13.5 }}>文本测试</h2>
                      {report.text?.result_label && <span className="pill">{report.text.result_label}</span>}
                    </div>
                    {textModel && <code className="muted">{textModel}</code>}
                  </div>
                  <div className="trace-stage-body compact">
                    {report.text ? (
                      <>
                        <details open className="trace-details">
                          <summary>测试题目</summary>
                          <div className="trace-qa-box compact">{report.text.question || '未提供题目'}</div>
                        </details>
                        <div className="trace-qa-label">模型回答</div>
                        <div className="trace-qa-box answer compact">{report.text.answer || '未提供回答'}</div>
                        {report.text.passed !== undefined && (
                          <p
                            className={report.text.passed ? 'success-text' : 'error-text'}
                            style={{ marginBottom: 0, fontSize: 12, fontWeight: 600 }}
                          >
                            {report.text.passed ? '文本测试通过' : '文本测试未通过'}
                          </p>
                        )}
                      </>
                    ) : (
                      <Empty title="暂无文本测试内容" />
                    )}
                  </div>
                </section>

                <section className="trace-stage-card compact">
                  <div className="trace-stage-head compact">
                    <div className="trace-stage-title">
                      <span className="trace-num">02</span>
                      <h2 style={{ fontSize: 13.5 }}>图片测试</h2>
                    </div>
                    {imageModel && <code className="muted">{imageModel}</code>}
                  </div>
                  <div className="trace-stage-body compact">
                    <ErrorMessage error={image.error} retry={() => image.refetch()} />
                    {imagePath && image.isPending ? (
                      <Loading label="正在加载检测图片" />
                    ) : imagePath && image.data ? (
                      <button
                        type="button"
                        className="trace-image-button compact"
                        aria-label="放大检测图片"
                        onClick={() => setZoom(true)}
                      >
                        <img src={image.data} alt={report.image?.title || '检测生成图片'} />
                        <span>
                          <ZoomIn size={14} />
                        </span>
                      </button>
                    ) : (
                      !image.error && <Empty icon={<ImageIcon size={20} />} title="暂无检测图片" />
                    )}
                    {(report.image?.title || report.image?.generated_at) && (
                      <p className="small muted mono" style={{ marginTop: 8, marginBottom: 0 }}>
                        {report.image?.title || '检测样张'}
                        {report.image?.generated_at ? ` · ${beijing(report.image.generated_at)}` : ''}
                      </p>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>

          <aside className="card trace-history">
            <div className="card-header compact">
              <h2>
                <Clock size={14} />
                检测历史
              </h2>
              <span className="count-pill">{history.length} 轮</span>
            </div>
            {!history.length ? (
              <Empty title="暂无历史记录" />
            ) : (
              <div className="trace-history-list">
                {history.map(item => {
                  const itemStatus: ModelTraceStatus = item.expired ? 'stale' : item.status
                  const isActive = report?.id === item.id
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`trace-history-btn ${isActive ? 'selected active' : ''}`}
                      onClick={() => setSelected(item.id)}
                      aria-pressed={isActive}
                    >
                      <span className="mono">{beijingShort(item.completed_at)}</span>
                      <span className={`trace-history-status trace-${itemStatus}`}>{statuses[itemStatus]}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </aside>
        </div>
      )}

      {zoom && report && imagePath && image.data && (
        <Drawer title={report.image?.title || '检测图片'} wide onClose={() => setZoom(false)}>
          <img className="trace-image-large" src={image.data} alt={report.image?.title || '检测生成图片'} />
        </Drawer>
      )}
    </>
  )
}
