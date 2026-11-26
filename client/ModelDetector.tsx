import { useEffect, useMemo, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import {
  CheckCircle2,
  ClipboardCheck,
  Fingerprint,
  Info,
  LoaderCircle,
  Lock,
  Play,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { native, useApi } from './native'
import type { ApiKey, Page } from './types'
import type { ModelPlazaResponse } from './pricing/modelPlaza'
import { splitEndpoints } from './keySetup'
import {
  CopyButton,
  ErrorMessage,
  SelectMenu,
  Switch,
  useNotice,
  type SelectOptionItem,
} from './ui'
import { VendorIcon } from './VendorIcon'

interface Challenge {
  id: string
  expected_count: number
  prompt: string
}

type SampleState = 'queued' | 'waiting' | 'streaming' | 'complete' | 'truncated' | 'failed'

interface Sample {
  state: SampleState
  text: string
  raw_text: string
  count: number
  expected_count: number
  first_byte_ms: number | null
  response_model: string | null
  response_id: string | null
  error: string | null
}

interface AnalysisResult {
  model: string
  display_name: string
  family: string
  family_name: string
  score: number
  probability: number | null
}

interface Diagnostic {
  index: number
  parsed_numbers: number
  minimum_numbers: number
  accepted: boolean
  raw_out_of_range_count: number
}

interface Analysis {
  decision: 'scored' | 'partial' | 'unscorable' | 'not_model'
  prediction: string
  prediction_name: string
  family_prediction: string
  family_prediction_name: string
  results: AnalysisResult[]
  ranking_score: number | null
  probability: number | null
  probability_status: 'unavailable' | 'reference_calibrated'
  used_outputs: number
  diagnostics: Diagnostic[]
  sequence: { autocorrelation: number; small_step_share: number; model_like: boolean } | null
  evidence: { insufficient: boolean; label: string; reason: string; method: string }
}

interface DetectResult {
  challenges: Challenge[]
  samples: Sample[]
  analysis: Analysis | null
  error: string | null
}

interface DetectorStatus {
  loaded: boolean
  built_at: string | null
  cached: boolean
}

const API_OPTIONS: SelectOptionItem[] = [
  { value: 'responses', label: 'OpenAI Responses', description: '推荐用于 GPT-5 / GPT-6 / Codex 系列' },
  { value: 'chat_completions', label: 'Chat Completions', description: '通用 OpenAI 兼容 /chat/completions 接口' },
  { value: 'messages', label: 'Anthropic Messages', description: 'Claude 原生 /v1/messages 接口' },
]

const EFFORT_OPTIONS: SelectOptionItem[] = [
  { value: '', label: '默认（不指定）' },
  { value: 'none', label: 'none（关闭思考）' },
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
]

const TIER_OPTIONS: SelectOptionItem[] = [
  { value: 'default', label: 'default（默认）' },
  { value: 'fast', label: 'fast' },
  { value: 'flex', label: 'flex' },
]

const STATE_LABEL: Record<SampleState, string> = {
  queued: '排队中',
  waiting: '等待首字',
  streaming: '流式采样中',
  complete: '已完成',
  truncated: '部分截断',
  failed: '采样失败',
}

const DECISION_LABEL: Record<Analysis['decision'], string> = {
  scored: '指纹匹配完成',
  partial: '部分样本评分',
  unscorable: '有效数字不足',
  not_model: '非典型模型输出',
}

function countValidIntegers(text: string): number {
  const matches = text.match(/\b\d+\b/g) || []
  let n = 0
  for (const m of matches) {
    const v = Number(m)
    if (v >= 1 && v <= 355) n++
  }
  return n
}

export default function ModelDetector({ baseUrl }: { baseUrl: string }) {
  const ep = splitEndpoints(baseUrl)
  const keysQuery = useApi<Page<ApiKey>>('/keys?page=1&page_size=100')
  const plazaQuery = useApi<ModelPlazaResponse>('/model-plaza')
  const notice = useNotice()

  const [mode, setMode] = useState<'api' | 'manual'>('api')
  const [status, setStatus] = useState<DetectorStatus | null>(null)
  const [selectedKeyId, setSelectedKeyId] = useState('')
  const [endpoint, setEndpoint] = useState(ep.openai)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [protocol, setProtocol] = useState('responses')
  const [effort, setEffort] = useState('')
  const [serviceTier, setServiceTier] = useState('default')
  const [count, setCount] = useState(3)
  const [strict, setStrict] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Live API detection state
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [liveSamples, setLiveSamples] = useState<Sample[]>([])
  const [result, setResult] = useState<DetectResult | null>(null)
  const [builtAt, setBuiltAt] = useState<string | null>(null)
  const activeRunId = useRef('')

  // Offline manual mode state
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [manualReplies, setManualReplies] = useState<string[]>(['', '', ''])
  const [manualAnalysis, setManualAnalysis] = useState<Analysis | null>(null)
  const [manualBusy, setManualBusy] = useState(false)

  useEffect(() => {
    void native<DetectorStatus>('detector_status')
      .then(s => {
        setStatus(s)
        if (s.built_at) setBuiltAt(s.built_at)
      })
      .catch(() => {})
  }, [])

  // Pre-select first active key once loaded
  useEffect(() => {
    if (selectedKeyId || !keysQuery.data?.items.length) return
    const first = keysQuery.data.items.find(k => k.status === 'active') || keysQuery.data.items[0]
    if (first) applyKeySelection(String(first.id), keysQuery.data.items)
  }, [keysQuery.data, selectedKeyId])

  // Subscribe to streaming sample progress from Rust lmfpd::detect_with
  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    void listen<{ run_id: string; index: number; sample: Sample }>('detector-progress', event => {
      if (event.payload.run_id !== activeRunId.current) return
      setLiveSamples(prev => {
        const next = [...prev]
        next[event.payload.index] = event.payload.sample
        return next
      })
    })
      .then(stop => {
        if (disposed) stop()
        else unlisten = stop
      })
      .catch(() => {})
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  function applyKeySelection(id: string, list: ApiKey[]) {
    setSelectedKeyId(id)
    if (id === 'custom') {
      setApiKey('')
      return
    }
    const found = list.find(k => String(k.id) === id)
    if (!found) return
    setApiKey(found.key)
    const plat = found.group?.platform || 'openai'
    if (plat === 'anthropic') {
      setEndpoint(ep.anthropic)
      setProtocol('messages')
    } else {
      setEndpoint(ep.openai)
      setProtocol(plat === 'openai' ? 'responses' : 'chat_completions')
    }
  }

  const keyOptions = useMemo<SelectOptionItem[]>(() => {
    const items = (keysQuery.data?.items || []).map(k => ({
      value: String(k.id),
      label: k.name,
      description: `${k.group?.name || '默认分组'} · ${k.key.slice(0, 7)}...${k.key.slice(-4)}`,
      icon: <VendorIcon vendor={k.group?.platform || 'openai'} size={14} />,
    }))
    return [
      ...items,
      { value: 'custom', label: '自定义外部 API', description: '手动填入任意第三方 Base URL 与 API Key' },
    ]
  }, [keysQuery.data])

  const modelOptions = useMemo<SelectOptionItem[]>(() => {
    const names = new Set<string>()
    for (const g of plazaQuery.data?.groups || []) {
      for (const m of g.models) names.add(m.name)
    }
    return [...names].sort().map(name => ({
      value: name,
      label: name,
      icon: <VendorIcon vendor={name} size={14} />,
    }))
  }, [plazaQuery.data])

  async function runApiDetect(e: React.FormEvent) {
    e.preventDefault()
    if (running) return
    setError('')
    setResult(null)
    const runId = crypto.randomUUID()
    activeRunId.current = runId
    setLiveSamples(
      Array.from({ length: count }, () => ({
        state: 'queued',
        text: '',
        raw_text: '',
        count: 0,
        expected_count: 312,
        first_byte_ms: null,
        response_model: null,
        response_id: null,
        error: null,
      })),
    )
    setRunning(true)
    try {
      const response = await native<{ built_at: string; result: DetectResult }>('detector_detect', {
        input: {
          run_id: runId,
          base_url: endpoint.trim(),
          api_key: apiKey.trim(),
          model: model.trim(),
          api: protocol,
          effort,
          service_tier: serviceTier,
          stream: true,
          strict,
          count,
        },
      })
      setBuiltAt(response.built_at)
      setResult(response.result)
      setLiveSamples(response.result.samples || [])
      if (response.result.error && !response.result.analysis?.results.length) {
        setError(response.result.error)
      } else {
        notice('模型指纹检测完成')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  async function generateManual() {
    setError('')
    try {
      const list = await native<Challenge[]>('detector_challenges', { count: 3 })
      setChallenges(list)
      setManualReplies(list.map(() => ''))
      setManualAnalysis(null)
      notice('已生成 3 组随机数字指纹测试题')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function runManualAnalyze() {
    if (manualBusy) return
    const outputs = challenges
      .map((c, idx) => ({ text: (manualReplies[idx] || '').trim(), expected_count: c.expected_count }))
      .filter(o => o.text.length > 0)
    if (!outputs.length) {
      setError('请至少粘贴 1 组模型回答后再评分。')
      return
    }
    setError('')
    setManualBusy(true)
    try {
      const res = await native<{ built_at: string; analysis: Analysis }>('detector_analyze', {
        outputs,
        strict: strict && outputs.length === 3,
      })
      setBuiltAt(res.built_at)
      setManualAnalysis(res.analysis)
      notice('离线指纹评分完成')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setManualBusy(false)
    }
  }

  const activeAnalysis = mode === 'api' ? result?.analysis || null : manualAnalysis
  const activeSamples = mode === 'api' ? liveSamples : []
  const topCandidate = activeAnalysis?.results?.[0]
  const matchesClaimed =
    mode === 'api' &&
    model.trim() &&
    activeAnalysis?.prediction &&
    (activeAnalysis.prediction.toLowerCase().includes(model.trim().toLowerCase()) ||
      model.trim().toLowerCase().includes(activeAnalysis.prediction.toLowerCase()))

  const advSummary = [
    `${count} 轮`,
    effort ? `effort:${effort}` : '',
    serviceTier !== 'default' ? serviceTier : '',
    strict ? '严格' : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const stageStatus = running
    ? '采样中'
    : activeAnalysis
      ? DECISION_LABEL[activeAnalysis.decision]
      : '等待检测'

  return (
    <div className="detector-shell">
      {/* Slim Top Mode & Status Bar */}
      <div className="toolbar detector-topbar">
        <div className="segmented" role="tablist" aria-label="指纹检测模式">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'api'}
            className={mode === 'api' ? 'selected' : ''}
            onClick={() => {
              setMode('api')
              setError('')
            }}
          >
            一键 API 检测
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'manual'}
            className={mode === 'manual' ? 'selected' : ''}
            onClick={() => {
              setMode('manual')
              setError('')
              if (!challenges.length) void generateManual()
            }}
          >
            离线手动评分
          </button>
        </div>

        <span className="pill">
          <Fingerprint size={13} />
          {builtAt
            ? `指纹参考库 ${builtAt.slice(0, 10)}`
            : status?.cached
              ? '本地指纹库已缓存'
              : '首次检测自动下载约 3.6MB 指纹库'}
        </span>

        <span className="spacer" />

        <span className="small muted">本地 Rust 直连 · 基于 Ikaleio/lm-detector (MIT)</span>
      </div>

      <ErrorMessage error={error} />

      {/* Top Full-Width Control Deck (API Config OR 3-Column Manual Challenges) */}
      {mode === 'api' ? (
        <form className="card detector-deck" onSubmit={runApiDetect}>
          <div className="detector-deck-row">
            <div className="field">
              <span>检测密钥</span>
              <SelectMenu
                ariaLabel="选择检测密钥"
                value={selectedKeyId}
                options={keyOptions}
                searchable
                searchPlaceholder="搜索密钥或分组..."
                placeholder="选择已有 API 密钥或自定义"
                className="full"
                onChange={id => applyKeySelection(id, keysQuery.data?.items || [])}
              />
            </div>

            <div className="field">
              <span>目标模型</span>
              <div className="detector-model-combo">
                {modelOptions.length > 0 && (
                  <SelectMenu
                    ariaLabel="从模型广场选择"
                    value={modelOptions.some(o => o.value === model) ? model : ''}
                    options={[{ value: '', label: '快捷选择模型' }, ...modelOptions]}
                    searchable
                    searchPlaceholder="搜索模型 ID..."
                    onChange={v => {
                      if (v) setModel(v)
                    }}
                  />
                )}
                <input
                  required
                  aria-label="目标模型 ID"
                  className="mono"
                  placeholder="输入模型 ID，如 gpt-6.1-sol"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  disabled={running}
                />
              </div>
            </div>

            <div className="field">
              <span>接口协议</span>
              <SelectMenu
                ariaLabel="接口协议"
                value={protocol}
                options={API_OPTIONS}
                className="full"
                disabled={running}
                onChange={setProtocol}
              />
            </div>
          </div>

          <div className="detector-deck-bar">
            <div className="field detector-url-field">
              <span>API Base URL</span>
              <input
                required
                aria-label="API Base URL"
                className="mono"
                placeholder="https://api.ravenaiworld.org/v1"
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
                disabled={running}
              />
            </div>

            {selectedKeyId === 'custom' && (
              <div className="field detector-key-field">
                <span>API Key</span>
                <input
                  required
                  aria-label="API Key"
                  type="password"
                  className="mono"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  disabled={running}
                />
              </div>
            )}

            <div className="detector-deck-actions">
              <button
                type="button"
                className={`detector-adv-btn ${showAdvanced ? 'active' : ''}`}
                onClick={() => setShowAdvanced(v => !v)}
              >
                <SlidersHorizontal size={14} />
                <span>高级参数</span>
                <span className="detector-adv-pill">{advSummary}</span>
              </button>

              <button
                type="submit"
                className="primary detector-run-btn"
                disabled={running || !model.trim() || !endpoint.trim() || !apiKey.trim()}
              >
                {running ? <LoaderCircle size={15} className="spin" /> : <Play size={14} />}
                {running ? '并行采样中...' : '开始指纹检测'}
              </button>
            </div>
          </div>

          {showAdvanced && (
            <div className="detector-adv-panel">
              <div className="field">
                <span>采样轮数</span>
                <SelectMenu
                  ariaLabel="采样轮数"
                  value={String(count)}
                  className="full"
                  options={[
                    { value: '3', label: '3 轮（推荐 · 校准概率）' },
                    { value: '1', label: '1 轮（快速省额）' },
                  ]}
                  onChange={v => setCount(Number(v))}
                />
              </div>
              <div className="field">
                <span>服务层级</span>
                <SelectMenu
                  ariaLabel="服务层级"
                  value={serviceTier}
                  className="full"
                  options={TIER_OPTIONS}
                  onChange={setServiceTier}
                />
              </div>
              <div className="field">
                <span>思考强度 (Effort)</span>
                <SelectMenu
                  ariaLabel="思考强度"
                  value={effort}
                  className="full"
                  options={EFFORT_OPTIONS}
                  onChange={setEffort}
                />
              </div>
              <div className="detector-adv-switch">
                <Switch
                  label="严格模式"
                  hint="全部无截断才出评分"
                  checked={strict}
                  onChange={setStrict}
                />
              </div>
            </div>
          )}

          <div className="detector-deck-foot">
            <span>
              每轮发送 {count} 条短请求（输出 ~300 个 1–355 整数），由本地 Rust 直连目标端点，按所选密钥消耗少量 Token。
            </span>
          </div>
        </form>
      ) : (
        <section className="card detector-deck">
          <div className="detector-manual-top">
            <div>
              <h2>
                <ClipboardCheck size={16} />
                离线手动测试题
              </h2>
              <p className="small muted" style={{ margin: '2px 0 0' }}>
                复制下方挑战题发给任意大模型，将输出的数字序列粘贴回来（每组至少 80 个 1–355 整数），零费用本地离线比对。
              </p>
            </div>
            <div className="detector-manual-actions">
              <button type="button" onClick={() => void generateManual()}>
                <RefreshCw size={13} />
                换一组题
              </button>
              <button
                type="button"
                className="primary"
                disabled={manualBusy}
                onClick={() => void runManualAnalyze()}
              >
                {manualBusy ? <LoaderCircle size={15} className="spin" /> : <Fingerprint size={15} />}
                {manualBusy ? '本地比对中...' : '本地评分分析'}
              </button>
            </div>
          </div>

          <div className="detector-manual-grid">
            {challenges.map((ch, idx) => {
              const n = countValidIntegers(manualReplies[idx] || '')
              return (
                <div key={ch.id} className="manual-challenge-card">
                  <div className="manual-challenge-head">
                    <strong style={{ fontSize: 12.5 }}>
                      采样 #{idx + 1} <span className="muted mono">目标 {ch.expected_count}</span>
                    </strong>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span className={`pill pill-mono ${n >= 80 ? 'badge-active' : ''}`}>{n} 个</span>
                      <CopyButton text={ch.prompt} label={`复制测试题 #${idx + 1}`} />
                    </div>
                  </div>
                  <div className="manual-prompt-box">{ch.prompt}</div>
                  <textarea
                    rows={4}
                    aria-label={`采样 #${idx + 1} 回答`}
                    placeholder="将模型输出的整数序列粘贴到这里..."
                    value={manualReplies[idx] || ''}
                    onChange={e =>
                      setManualReplies(prev => prev.map((val, i) => (i === idx ? e.target.value : val)))
                    }
                  />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Full-Width Report & Telemetry Stage */}
      <section className="card detector-stage">
        <div className="detector-stage-head">
          <h2>
            <Fingerprint size={16} />
            指纹检测报告
          </h2>
          <span
            className={`pill ${
              activeAnalysis?.decision === 'scored'
                ? 'badge-active'
                : running
                  ? 'detector-status-live'
                  : ''
            }`}
          >
            {stageStatus}
          </span>
        </div>

        {activeSamples.length > 0 && (
          <div className="detector-lanes" aria-label="采样进度">
            {activeSamples.map((s, idx) => {
              const pct = s.expected_count > 0 ? Math.min(100, (s.count / s.expected_count) * 100) : 0
              return (
                <div key={idx} className={`detector-lane ${s.state}`}>
                  <div className="detector-lane-head">
                    <span>采样 #{idx + 1}</span>
                    <span>{STATE_LABEL[s.state] || s.state}</span>
                  </div>
                  <div className="detector-lane-bar">
                    <div style={{ width: `${pct}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }} className="mono muted">
                    <span>
                      {s.count}/{s.expected_count} 整数
                    </span>
                    <span>{s.first_byte_ms != null ? `TTFT ${s.first_byte_ms}ms` : '--'}</span>
                  </div>
                  {s.error && (
                    <small className="error-text" style={{ fontSize: 11 }}>
                      {s.error}
                    </small>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!activeAnalysis ? (
          <div className="detector-standby">
            <div className="detector-standby-hero">
              <div className="empty-icon" aria-hidden="true">
                {running ? <LoaderCircle size={22} className="spin" /> : <Fingerprint size={22} />}
              </div>
              <div>
                <strong>{running ? '正在并行采集模型数字分布...' : '等待开始模型指纹检测'}</strong>
                <p>
                  {running
                    ? '正在流式接收整数采样，完成后将自动与本地参考库 40+ 主流模型分布比对并输出置信度排行。'
                    : mode === 'api'
                      ? '在上方选择检测密钥与目标模型后点击「开始指纹检测」，或切换「离线手动评分」零费用分析已有回答。'
                      : '在上方复制测试题发给目标模型，粘贴 1–3 组回答后点击「本地评分分析」即可得出候选排行。'}
                </p>
              </div>
            </div>

            <div className="detector-standby-cards">
              <div className="detector-standby-tile">
                <span className="detector-step-num">01</span>
                <div>
                  <strong>3 路并行数字采样</strong>
                  <small>要求模型生成 ~300 个 1–355 随机整数，捕捉底层解码分布指纹与实时 TTFT。</small>
                </div>
              </div>
              <div className="detector-standby-tile">
                <span className="detector-step-num">02</span>
                <div>
                  <strong>
                    <Sparkles size={13} style={{ color: 'var(--coral)' }} /> 40+ 主流参考指纹库
                  </strong>
                  <small>与参考模型概率分布交叉比对，输出库内校准置信度与 Top 8 候选相似度排行。</small>
                </div>
              </div>
              <div className="detector-standby-tile">
                <span className="detector-step-num">03</span>
                <div>
                  <strong>
                    <Lock size={13} style={{ color: 'var(--green)' }} /> 本地 Rust 直连零中转
                  </strong>
                  <small>直接请求 Ravenai 或任意第三方 HTTPS 端点，API Key 仅留在本地内存不经中转。</small>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="detector-result-split">
            {/* Left Column: Primary Verdict & Signal Telemetry */}
            <div
              className={`detector-verdict-card ${
                activeAnalysis.decision === 'scored'
                  ? 'scored'
                  : activeAnalysis.decision === 'partial'
                    ? 'partial'
                    : 'unscorable'
              }`}
            >
              <div className="detector-verdict-pills">
                <span className="pill">{DECISION_LABEL[activeAnalysis.decision]}</span>
                {activeAnalysis.family_prediction_name && (
                  <span className="pill">{activeAnalysis.family_prediction_name}</span>
                )}
                {mode === 'api' && model.trim() && activeAnalysis.prediction && (
                  <span
                    className="pill"
                    style={{
                      background: matchesClaimed ? 'var(--green-soft)' : 'var(--amber-soft)',
                      color: matchesClaimed ? 'var(--green)' : 'var(--amber)',
                    }}
                  >
                    {matchesClaimed ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                    {matchesClaimed ? '与声明模型吻合' : `声明 ${model.trim()}`}
                  </span>
                )}
              </div>

              <div className="detector-verdict-identity">
                {activeAnalysis.prediction && <VendorIcon vendor={activeAnalysis.prediction} size={28} />}
                <div style={{ minWidth: 0 }}>
                  <strong>{activeAnalysis.prediction_name || activeAnalysis.prediction || '无法确定候选模型'}</strong>
                  <small className="mono">{activeAnalysis.prediction || '--'}</small>
                </div>
              </div>

              {activeAnalysis.probability != null && (
                <div className="detector-confidence-box">
                  <div className="detector-confidence-head">
                    <span className="small muted">库内校准置信度</span>
                    <div className="detector-prob">{(activeAnalysis.probability * 100).toFixed(1)}%</div>
                  </div>
                  <div className="detector-confidence-bar">
                    <div style={{ width: `${Math.min(100, Math.max(2, activeAnalysis.probability * 100))}%` }} />
                  </div>
                </div>
              )}

              <div className="detector-telemetry-grid">
                <div>
                  <span>有效样本</span>
                  <strong className="mono">
                    {activeAnalysis.used_outputs} / {Math.max(activeAnalysis.used_outputs, activeAnalysis.diagnostics.length || count)}
                  </strong>
                </div>
                <div>
                  <span>序列自相关</span>
                  <strong className="mono">
                    {activeAnalysis.sequence ? activeAnalysis.sequence.autocorrelation.toFixed(3) : '--'}
                  </strong>
                </div>
                <div>
                  <span>序列特征</span>
                  <strong>
                    {activeAnalysis.sequence
                      ? activeAnalysis.sequence.model_like
                        ? '典型模型分布'
                        : '存在异常波动'
                      : '--'}
                  </strong>
                </div>
              </div>

              {activeAnalysis.evidence.insufficient && (
                <div className="error" style={{ marginTop: 12, marginBottom: 0 }}>
                  <Info size={14} />
                  <span>{activeAnalysis.evidence.reason || '当前样本证据不足，建议再测一轮。'}</span>
                </div>
              )}

              <p className="detector-footnote">
                检测结果为参考库封闭集合排序（引擎源自开源项目 Ikaleio/lm-detector · MIT），仅作 API 渠道一致性辅助参考。
              </p>
            </div>

            {/* Right Column: Candidate Similarity Ranking */}
            <div className="detector-rank-panel">
              <div className="detector-rank-head">
                <h3>候选模型相似度排行</h3>
                <span className="pill pill-mono">Top {Math.min(8, activeAnalysis.results.length)}</span>
              </div>

              {activeAnalysis.results.length > 0 ? (
                <div className="detector-rank-list">
                  {activeAnalysis.results.slice(0, 8).map((cand, idx) => {
                    const pct =
                      cand.probability != null
                        ? Math.max(2, cand.probability * 100)
                        : topCandidate?.score
                          ? Math.max(6, (cand.score / Math.max(0.0001, Math.abs(topCandidate.score))) * 100)
                          : 0
                    return (
                      <div key={cand.model} className={`detector-rank-item ${idx === 0 ? 'top' : ''}`}>
                        <span className="detector-rank-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                        <span className="detector-rank-num">#{idx + 1}</span>
                        <div className="detector-rank-model">
                          <VendorIcon vendor={cand.model} size={16} />
                          <div>
                            <strong>{cand.display_name || cand.model}</strong>
                            <small className="mono">
                              {cand.model} · {cand.family_name || cand.family}
                            </small>
                          </div>
                        </div>
                        <div className="detector-rank-metrics">
                          {cand.probability != null ? `${(cand.probability * 100).toFixed(1)}%` : cand.score.toFixed(3)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="small muted" style={{ padding: '24px 0', textAlign: 'center' }}>
                  暂无足够样本生成候选排行
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
