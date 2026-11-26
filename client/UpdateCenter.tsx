import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { date, native } from './native'
import { CopyButton, Drawer, ErrorMessage, KeyValue, Switch, useNotice } from './ui'

export interface ReleaseInfo {
  current_version: string
  latest_version: string
  display_version: string
  has_update: boolean
  release_url: string
  download_url: string
  asset_name: string
  file_size: number
  sha256: string | null
  release_notes: string
  published_at: string
  source: string
}

export interface UpdateProgress {
  phase: 'downloading' | 'verifying' | 'launching'
  downloaded: number
  total: number
  percent: number
}

export const AUTO_UPDATE_STORAGE_KEY = 'ravenai-auto-update-check'
export const SKIPPED_VERSION_STORAGE_KEY = 'ravenai-skipped-version'

export function formatDisplayVersion(version: string | null | undefined): string {
  const clean = (version || '1.0.0').trim().replace(/^v/i, '')
  return clean === '1.0.0' ? 'v1.00' : `v${clean}`
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '--'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

interface ParsedNoteLine {
  kind: 'heading' | 'bullet' | 'text'
  text: string
}

function cleanInlineMarkdown(raw: string): string {
  return raw
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .trim()
}

function parseReleaseNotes(notes: string): ParsedNoteLine[] {
  return notes
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      if (/^#{1,4}\s+/.test(line)) {
        return { kind: 'heading' as const, text: cleanInlineMarkdown(line.replace(/^#{1,4}\s+/, '')) }
      }
      if (/^[-*•]\s+/.test(line)) {
        return { kind: 'bullet' as const, text: cleanInlineMarkdown(line.replace(/^[-*•]\s+/, '')) }
      }
      return { kind: 'text' as const, text: cleanInlineMarkdown(line) }
    })
}

export function UpdateBanner({
  info,
  onOpen,
  onDismiss,
}: {
  info: ReleaseInfo
  onOpen: () => void
  onDismiss: () => void
}) {
  return (
    <div className="update-banner" role="region" aria-label="发现新版本提醒">
      <div className="update-banner-main">
        <span className="update-banner-badge">
          <Sparkles size={13} />
          新版本 {info.display_version}
        </span>
        <span className="update-banner-text">
          当前 {formatDisplayVersion(info.current_version)} 可升级至 {info.display_version}（支持一键在线更新与 SHA256 校验）
        </span>
      </div>
      <div className="update-banner-actions">
        <button type="button" className="primary" onClick={onOpen}>
          <Download size={14} />
          查看并更新
        </button>
        <button type="button" className="icon-button" aria-label="暂时关闭更新提醒" onClick={onDismiss}>
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

export function UpdateDrawer({
  currentVersion,
  info,
  checking,
  checkError,
  autoCheck,
  onToggleAutoCheck,
  onCheck,
  onSkipVersion,
  onClose,
}: {
  currentVersion: string
  info: ReleaseInfo | null
  checking: boolean
  checkError: string
  autoCheck: boolean
  onToggleAutoCheck: (next: boolean) => void
  onCheck: (manual?: boolean) => Promise<void>
  onSkipVersion: (version: string) => void
  onClose: () => void
}) {
  const notice = useNotice()
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState('')
  const [progress, setProgress] = useState<UpdateProgress | null>(null)

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    void listen<UpdateProgress>('update-progress', event => {
      setProgress(event.payload)
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

  async function startInstall() {
    if (!info || installing) return
    setInstallError('')
    setInstalling(true)
    setProgress({ phase: 'downloading', downloaded: 0, total: info.file_size || 0, percent: 0 })
    try {
      await native('install_update', {
        input: {
          download_url: info.download_url,
          asset_name: info.asset_name,
          sha256: info.sha256,
        },
      })
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : String(e))
      setInstalling(false)
    }
  }

  async function openManualDownload() {
    try {
      await native('open_release_page', { url: info?.release_url || '' })
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : String(e))
    }
  }

  const phaseText =
    progress?.phase === 'verifying'
      ? '正在验证安装包 SHA256 完整性...'
      : progress?.phase === 'launching'
        ? '校验通过，正在静默安装并重启新版...'
        : `正在下载 ${info?.asset_name || '更新安装包'} (${progress?.percent ?? 0}%)`

  return (
    <Drawer title="版本与更新" onClose={() => !installing && onClose()}>
      <div className={`update-hero ${info?.has_update ? 'has-update' : 'up-to-date'}`}>
        <div>
          <div className="small muted">当前安装版本</div>
          <strong className="mono">{formatDisplayVersion(currentVersion)}</strong>
          <small className="mono muted">SemVer {currentVersion}</small>
        </div>
        <span className={`pill ${info?.has_update ? 'detector-status-live' : 'badge-active'}`}>
          {checking ? (
            <>
              <LoaderCircle size={12} className="spin" />
              正在检查...
            </>
          ) : info?.has_update ? (
            <>
              <Sparkles size={12} />
              发现新版 {info.display_version}
            </>
          ) : info ? (
            <>
              <CheckCircle2 size={12} />
              已是最新版本
            </>
          ) : (
            '点击下方检查更新'
          )}
        </span>
      </div>

      <div className="form-section" style={{ marginBottom: 14 }}>
        <Switch
          label="启动时自动检查更新"
          hint="开启后每次启动客户端自动静默查询新版本并在顶部提醒；关闭后可随时手动检查"
          checked={autoCheck}
          onChange={onToggleAutoCheck}
        />
      </div>

      <ErrorMessage error={checkError} />
      <ErrorMessage error={installError} />

      {info && (
        <div className="kv-group">
          <KeyValue label="最新正式版">
            <code className="mono">{info.display_version}</code>
            <span className="small muted mono">({info.latest_version})</span>
          </KeyValue>
          <KeyValue label="发布时间">{info.published_at ? date(info.published_at) : '--'}</KeyValue>
          <KeyValue label="安装包体积">
            <span className="mono">{formatBytes(info.file_size)}</span>
          </KeyValue>
          <KeyValue label="更新检查源">
            {info.source === 'ravenai' ? 'Ravenai 官网加速源' : 'GitHub Releases 直连'}
          </KeyValue>
          {info.sha256 && (
            <KeyValue label="SHA256 校验">
              <code className="mono" style={{ fontSize: 11 }}>
                {info.sha256.slice(0, 16)}...{info.sha256.slice(-8)}
              </code>
              <CopyButton text={info.sha256} label="复制完整 SHA256" />
            </KeyValue>
          )}
        </div>
      )}

      {info?.release_notes && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>更新说明</h3>
          <div className="update-notes-box">
            {parseReleaseNotes(info.release_notes).map((line, i) =>
              line.kind === 'heading' ? (
                <div key={i} className="update-note-heading">
                  {line.text}
                </div>
              ) : line.kind === 'bullet' ? (
                <div key={i} className="update-note-bullet">
                  <span className="update-note-dot" aria-hidden="true" />
                  <span>{line.text}</span>
                </div>
              ) : (
                <p key={i} className="update-note-text">
                  {line.text}
                </p>
              ),
            )}
          </div>
        </div>
      )}

      {installing && progress && (
        <div className="update-progress-box" role="status" aria-live="polite">
          <div className="update-progress-head">
            <span>{phaseText}</span>
            <span className="mono">{progress.percent}%</span>
          </div>
          <div className="detector-lane-bar">
            <div style={{ width: `${Math.max(4, progress.percent)}%` }} />
          </div>
          {progress.total > 0 && (
            <small className="mono muted">
              {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
            </small>
          )}
        </div>
      )}

      <div className="update-actions-stack">
        {info?.has_update && (
          <button type="button" className="primary" disabled={installing || checking} onClick={() => void startInstall()}>
            {installing ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />}
            {installing ? '正在自动更新...' : `一键下载并更新到 ${info.display_version}`}
          </button>
        )}

        <div className="form-actions" style={{ marginTop: 4, justifyContent: 'space-between' }}>
          <button
            type="button"
            disabled={checking || installing}
            onClick={() => void onCheck(true)}
          >
            <RefreshCw size={14} className={checking ? 'spin' : ''} />
            立即检查更新
          </button>

          <button type="button" disabled={installing} onClick={() => void openManualDownload()}>
            前往 GitHub 手动下载
            <ArrowUpRight size={14} />
          </button>
        </div>

        {info?.has_update && !installing && (
          <button
            type="button"
            className="text-link small"
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
            onClick={() => {
              onSkipVersion(info.latest_version)
              notice(`已暂不提醒 ${info.display_version}，你仍可随时手动更新`)
              onClose()
            }}
          >
            跳过此版本提醒
          </button>
        )}
      </div>

      <p className="small muted" style={{ marginTop: 16, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ShieldCheck size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
        所有更新包均仅从官方仓库 RavenAiWorld/ravenai-desktop 的 HTTPS GitHub Releases 拉取并在本地校验 SHA256。
      </p>
    </Drawer>
  )
}
