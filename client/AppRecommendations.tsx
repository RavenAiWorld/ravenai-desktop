import { useEffect, useState } from 'react'
import { ArrowUpRight, KeyRound, Maximize2, X } from 'lucide-react'
import codexppUi from '../assets/ecosystem/codexpp-ui.webp'
import codexppIcon from '../assets/ecosystem/codexpp-icon.png'
import cockpitUi from '../assets/ecosystem/cockpit-ui.webp'
import cockpitIcon from '../assets/ecosystem/cockpit-icon.png'
import ccswitchUi from '../assets/ecosystem/ccswitch-ui.webp'
import ccswitchIcon from '../assets/ecosystem/ccswitch-icon.png'
import codexhostUi from '../assets/ecosystem/codexhost-ui.webp'
import codexhostIcon from '../assets/ecosystem/codexhost-icon.png'
import { native } from './native'
import { splitEndpoints } from './keySetup'
import { CopyButton, ErrorMessage, useAction } from './ui'

interface RecommendedApp {
  id: string
  name: string
  repo: string
  githubUrl: string
  homeUrl?: string
  protocol: 'openai' | 'both'
  summary: string
  setupHint: string
  uiPreview: string
  uiCaption: string
  iconImg: string
}

const RECOMMENDED_APPS: RecommendedApp[] = [
  {
    id: 'codex-pp',
    name: 'Codex++',
    repo: 'BigPizzaV3/CodexPlusPlus',
    githubUrl: 'https://github.com/BigPizzaV3/CodexPlusPlus',
    homeUrl: 'https://codexpp.cc/',
    protocol: 'openai',
    summary: 'Codex Desktop 增强套件与聚合网关，支持多 Provider 路由切换。',
    setupHint: '填 OpenAI 地址（含 /v1）+ API Key',
    uiPreview: codexppUi,
    uiCaption: 'Codex++ · 聚合网关与多 Provider 路由',
    iconImg: codexppIcon,
  },
  {
    id: 'cockpit-tools',
    name: 'Cockpit Tools',
    repo: 'jlcodes99/cockpit-tools',
    githubUrl: 'https://github.com/jlcodes99/cockpit-tools',
    protocol: 'both',
    summary: 'Antigravity / Codex / Cursor / Kiro 多账号与配额中控台。',
    setupHint: '按工具协议选 /v1 或根地址',
    uiPreview: cockpitUi,
    uiCaption: 'Cockpit Tools · 多 IDE 账号与配额总览',
    iconImg: cockpitIcon,
  },
  {
    id: 'cc-switch',
    name: 'CC Switch',
    repo: 'farion1231/cc-switch',
    githubUrl: 'https://github.com/farion1231/cc-switch',
    homeUrl: 'https://ccswitch.io',
    protocol: 'both',
    summary: 'Claude Code / Codex / OpenCode 图形化中转配置一键热切。',
    setupHint: 'Claude 填根地址，Codex 填 /v1',
    uiPreview: ccswitchUi,
    uiCaption: 'CC Switch · 中转配置一键切换',
    iconImg: ccswitchIcon,
  },
  {
    id: 'codex-host',
    name: 'CodexHost',
    repo: 'BytePioneer-AI/codex-host',
    githubUrl: 'https://github.com/BytePioneer-AI/codex-host',
    protocol: 'both',
    summary: '在 Codex Desktop 内原生挂载 Claude Code 等多款 Agent。',
    setupHint: '按各 Agent 协议填对应中转地址',
    uiPreview: codexhostUi,
    uiCaption: 'CodexHost · 多 Agent Harness 工作台',
    iconImg: codexhostIcon,
  },
]

export default function AppRecommendations({
  baseUrl,
  onOpenKeys,
}: {
  baseUrl: string
  onOpenKeys: () => void
}) {
  const ep = splitEndpoints(baseUrl)
  const action = useAction()
  const [previewApp, setPreviewApp] = useState<RecommendedApp | null>(null)

  useEffect(() => {
    if (!previewApp) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewApp(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewApp])

  async function openUrl(url: string) {
    await action.run(() => native('open_ecosystem_url', { url }))
  }

  return (
    <div className="eco-shell">
      <section className="card eco-toolbar">
        <div className="eco-ep-inline">
          <span className="eco-ep-tag">OpenAI</span>
          <code className="mono">{ep.openai}</code>
          <CopyButton text={ep.openai} label="复制 OpenAI 接入地址" />
        </div>
        <div className="eco-ep-inline">
          <span className="eco-ep-tag">Claude</span>
          <code className="mono">{ep.anthropic}</code>
          <CopyButton text={ep.anthropic} label="复制 Anthropic 接入地址" />
        </div>
        <button type="button" className="primary eco-keys-btn" onClick={onOpenKeys}>
          <KeyRound size={13} />
          管理密钥
        </button>
      </section>

      <ErrorMessage error={action.error} />

      <div className="eco-grid">
        {RECOMMENDED_APPS.map(item => {
          const primaryEndpoint = item.protocol === 'openai' ? ep.openai : ep.anthropic
          return (
            <article key={item.id} className="card eco-card">
              <button
                type="button"
                className="eco-preview-btn"
                aria-label={`查看大图：${item.name}`}
                onClick={() => setPreviewApp(item)}
              >
                <img
                  className="eco-preview-img"
                  src={item.uiPreview}
                  alt={item.uiCaption}
                  loading="lazy"
                />
                <span className="eco-preview-badge">
                  <Maximize2 size={10} />
                  <span>查看大图</span>
                </span>
              </button>

              <div className="eco-card-body">
                <div className="eco-card-top">
                  <div className="eco-card-icon">
                    <img src={item.iconImg} alt="" />
                  </div>
                  <div className="eco-card-title">
                    <div className="eco-card-title-row">
                      <h3>{item.name}</h3>
                      <span className="pill pill-mono">
                        {item.protocol === 'both' ? 'OpenAI + Claude' : 'OpenAI'}
                      </span>
                    </div>
                    <p className="eco-card-desc">{item.summary}</p>
                  </div>
                </div>

                <div className="eco-card-foot">
                  <span className="eco-hint-inline">{item.setupHint}</span>
                  <div className="eco-card-actions">
                    <CopyButton text={primaryEndpoint} label={`复制 ${item.name} 接入地址`} />
                    {item.homeUrl && (
                      <button
                        type="button"
                        disabled={action.busy}
                        onClick={() => void openUrl(item.homeUrl!)}
                      >
                        官网
                      </button>
                    )}
                    <button
                      type="button"
                      className="primary"
                      disabled={action.busy}
                      onClick={() => void openUrl(item.githubUrl)}
                    >
                      GitHub
                      <ArrowUpRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {previewApp && (
        <div
          className="eco-lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${previewApp.name} 界面大图`}
          onClick={() => setPreviewApp(null)}
        >
          <div className="eco-lightbox-dialog" onClick={e => e.stopPropagation()}>
            <div className="eco-lightbox-head">
              <div className="eco-lightbox-title">
                <img src={previewApp.iconImg} alt="" />
                <div>
                  <strong>{previewApp.name}</strong>
                  <span>{previewApp.uiCaption}</span>
                </div>
              </div>
              <div className="eco-lightbox-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => void openUrl(previewApp.githubUrl)}
                >
                  GitHub
                  <ArrowUpRight size={13} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="关闭大图预览"
                  onClick={() => setPreviewApp(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="eco-lightbox-stage">
              <img src={previewApp.uiPreview} alt={previewApp.uiCaption} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
