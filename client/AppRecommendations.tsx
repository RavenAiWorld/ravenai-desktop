import { ArrowUpRight, Compass, KeyRound, Layers, Sparkles, Terminal, Wrench } from 'lucide-react'
import { native } from './native'
import { splitEndpoints } from './keySetup'
import { CopyButton, ErrorMessage, useAction } from './ui'

interface RecommendedApp {
  id: string
  name: string
  tagline: string
  repo: string
  githubUrl: string
  homeUrl?: string
  protocol: 'openai' | 'both'
  tags: string[]
  description: string
  setupTip: string
}

const RECOMMENDED_APPS: RecommendedApp[] = [
  {
    id: 'codex-pp',
    name: 'Codex++',
    tagline: 'CodexApp 全能增强套件与自定义中转启动器',
    repo: 'BigPizzaV3/CodexPlusPlus',
    githubUrl: 'https://github.com/BigPizzaV3/CodexPlusPlus',
    homeUrl: 'https://codexpp.cc/',
    protocol: 'openai',
    tags: ['Codex Desktop', '自定义网关', '多模型路由'],
    description:
      '专为 Codex Desktop 打造的社区增强工具，支持无侵入接入第三方中转 API、多模型与 Provider 切换、会话导出与扩展工作流。',
    setupTip: '在 Provider / API 设置中填入下方 OpenAI 兼容地址（含 /v1）与 Ravenai API Key 即可使用。',
  },
  {
    id: 'cockpit-tools',
    name: 'Cockpit Tools',
    tagline: '通用 AI IDE 多账号与配额中控台',
    repo: 'jlcodes99/cockpit-tools',
    githubUrl: 'https://github.com/jlcodes99/cockpit-tools',
    protocol: 'both',
    tags: ['Antigravity', 'Codex', 'Cursor / Kiro', '配额监控'],
    description:
      '支持 Antigravity、Codex、Cursor、Windsurf、Kiro、GitHub Copilot 与 Gemini CLI 等多工具的账号切换、配额监测、自动唤醒与多开实例管理。',
    setupTip: '可根据目标工具选择 Ravenai OpenAI（含 /v1）或 Anthropic（不含 /v1）接入地址。',
  },
  {
    id: 'cc-switch',
    name: 'CC Switch',
    tagline: 'Claude Code / Codex 一站式图形化配置热切换助手',
    repo: 'farion1231/cc-switch',
    githubUrl: 'https://github.com/farion1231/cc-switch',
    homeUrl: 'https://ccswitch.io',
    protocol: 'both',
    tags: ['Claude Code', 'Codex', 'OpenCode', '一键热切'],
    description:
      '跨平台桌面 All-in-One 配置管家，告别手改 JSON / TOML / 环境变量，支持 Claude Code、Codex、OpenCode、DeepSeek Harness 的中转站预设、本地代理与 MCP 统一管理。',
    setupTip: 'Claude Code 填入根地址（不含 /v1），Codex / OpenCode 填入 OpenAI 地址（含 /v1）。',
  },
  {
    id: 'codex-host',
    name: 'CodexHost',
    tagline: '在 Codex Desktop 内原生运行多款 AI Agent Harness',
    repo: 'BytePioneer-AI/codex-host',
    githubUrl: 'https://github.com/BytePioneer-AI/codex-host',
    protocol: 'both',
    tags: ['Codex Desktop', 'Claude Code', '跨 Agent 委派'],
    description:
      '在 Codex Desktop 界面内直接挂载并运行 Claude Code、Pi、Antigravity 等多款编码 Agent，支持跨 Agent 子任务委派与统一会话管理。',
    setupTip: '为各个挂载的 Agent 分别配置对应协议的 Ravenai 中转地址，即可在单一工作台协同调度。',
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

  async function openUrl(url: string) {
    await action.run(() => native('open_ecosystem_url', { url }))
  }

  return (
    <div className="eco-shell">
      <section className="card eco-endpoint-card">
        <div className="eco-endpoint-head">
          <div>
            <h2>
              <Compass size={16} />
              推荐生态接入工具
            </h2>
            <p className="small muted" style={{ margin: '3px 0 0' }}>
              精选社区高星开源客户端与配置助手，配合你的 Ravenai API 密钥即可快速接入全系列 GPT / Claude / Gemini / DeepSeek 模型。
            </p>
          </div>
          <button type="button" className="primary" onClick={onOpenKeys}>
            <KeyRound size={14} />
            管理 API 密钥
          </button>
        </div>

        <div className="eco-endpoints-bar">
          <div className="eco-ep-box">
            <span>OpenAI / Codex 兼容地址（含 /v1）</span>
            <div className="eco-ep-row">
              <code className="mono">{ep.openai}</code>
              <CopyButton text={ep.openai} label="复制 OpenAI 接入地址" />
            </div>
          </div>
          <div className="eco-ep-box">
            <span>Anthropic / Claude Code 地址（不含 /v1）</span>
            <div className="eco-ep-row">
              <code className="mono">{ep.anthropic}</code>
              <CopyButton text={ep.anthropic} label="复制 Anthropic 接入地址" />
            </div>
          </div>
        </div>
      </section>

      <ErrorMessage error={action.error} />

      <div className="eco-grid">
        {RECOMMENDED_APPS.map((item, idx) => {
          const IconComp = idx === 0 ? Sparkles : idx === 1 ? Wrench : idx === 2 ? Layers : Terminal
          const primaryEndpoint = item.protocol === 'openai' ? ep.openai : ep.anthropic
          return (
            <article key={item.id} className="card eco-card">
              <div className="eco-card-top">
                <div className="eco-card-icon">
                  <IconComp size={18} />
                </div>
                <div className="eco-card-title">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3>{item.name}</h3>
                    <span className="pill pill-mono">{item.protocol === 'both' ? 'OpenAI + Claude' : 'OpenAI / Codex'}</span>
                  </div>
                  <small>{item.tagline}</small>
                </div>
              </div>

              <p className="eco-card-desc">{item.description}</p>

              <div className="eco-tags">
                {item.tags.map(tag => (
                  <span key={tag} className="pill">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="eco-tip-box">
                <strong>接入提示</strong>
                <span>{item.setupTip}</span>
              </div>

              <div className="eco-card-foot">
                <span className="mono small muted">{item.repo}</span>
                <div className="eco-card-actions">
                  <CopyButton text={primaryEndpoint} label={`复制 ${item.name} 推荐接入地址`} />
                  {item.homeUrl && (
                    <button
                      type="button"
                      disabled={action.busy}
                      onClick={() => void openUrl(item.homeUrl!)}
                    >
                      官网
                      <ArrowUpRight size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="primary"
                    disabled={action.busy}
                    onClick={() => void openUrl(item.githubUrl)}
                  >
                    GitHub
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
