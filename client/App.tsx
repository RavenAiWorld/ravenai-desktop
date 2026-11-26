import { Component, useEffect, useState, type ReactNode } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Check,
  CircleHelp,
  Compass,
  Copy,
  Download,
  Fingerprint,
  Gift,
  Globe,
  House,
  Image,
  KeyRound,
  LoaderCircle,
  Lock,
  LogOut,
  MessageSquare,
  Minus,
  Moon,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import icon from '../assets/icon.png'
import { api, date, native, site, useApi } from './native'
import type { Announcement, ClientState, Settings, TicketSummary, User } from './types'
import { CopyButton, Drawer, Empty, ErrorMessage, IconButton, KeyValue, Loading, NoticeContext, useAction } from './ui'
import Dashboard from './Dashboard'
import Keys from './Keys'
import Usage from './Usage'
import Models from './Models'
import ChannelStatus from './ChannelStatus'
import ModelTrace from './ModelTrace'
import ModelDetector from './ModelDetector'
import ImageStudio from './ImageStudio'
import Purchase from './Purchase'
import Redemption from './Redemption'
import Support from './Support'
import Profile from './Profile'
import AppRecommendations from './AppRecommendations'
import {
  AUTO_UPDATE_STORAGE_KEY,
  SKIPPED_VERSION_STORAGE_KEY,
  UpdateBanner,
  UpdateDrawer,
  formatDisplayVersion,
  type ReleaseInfo,
} from './UpdateCenter'

type NavSectionId = 'workspace' | 'ecosystem' | 'account'
type NavTone = 'coral' | 'indigo' | 'emerald' | 'amber' | 'violet' | 'blue' | 'cyan' | 'rose' | 'teal' | 'slate'

interface NavPageDef {
  id: string
  label: string
  subtitle: string
  icon: typeof House
  section: NavSectionId
  tone: NavTone
  badge?: string
}

const NAV_SECTIONS: { id: NavSectionId; label: string }[] = [
  { id: 'workspace', label: '核心工作台' },
  { id: 'ecosystem', label: '创作与生态' },
  { id: 'account', label: '额度与服务' },
]

const pages: NavPageDef[] = [
  { id: 'dashboard', label: '概览', subtitle: '账户余额、消费趋势与平台配额', icon: House, section: 'workspace', tone: 'coral' },
  { id: 'models', label: '模型广场', subtitle: '可用模型、实时倍率与场景估价', icon: Boxes, section: 'workspace', tone: 'indigo' },
  { id: 'channels', label: '渠道状态', subtitle: '6 小时线路健康度与响应延迟', icon: Radio, section: 'workspace', tone: 'emerald' },
  { id: 'trace', label: 'GPT分组降智检测', subtitle: '最近 24 小时官方问答与生图核验', icon: Sparkles, section: 'workspace', tone: 'amber' },
  { id: 'detector', label: '模型指纹检测', subtitle: '数字指纹核验 API 真实模型身份', icon: Fingerprint, section: 'workspace', tone: 'violet' },
  { id: 'keys', label: 'API 密钥', subtitle: '密钥凭证、分组路由与一键接入', icon: KeyRound, section: 'workspace', tone: 'blue' },
  { id: 'usage', label: '用量记录', subtitle: '调用明细、错误排查与 CSV 导出', icon: Activity, section: 'workspace', tone: 'cyan' },
  { id: 'studio', label: '生图平台', subtitle: '创作工作台、图片编辑与作品库', icon: Image, section: 'ecosystem', tone: 'rose', badge: 'Nova' },
  { id: 'ecosystem', label: '应用推荐', subtitle: '精选支持 Ravenai 中转接入的开源生态工具', icon: Compass, section: 'ecosystem', tone: 'teal', badge: '4 款' },
  { id: 'purchase', label: '购买额度', subtitle: 'Ravenai 官方额度商店', icon: Wallet, section: 'account', tone: 'amber' },
  { id: 'redeem', label: '兑换额度', subtitle: '兑换卡密、活动额度与订阅套餐', icon: Gift, section: 'account', tone: 'coral' },
  { id: 'support', label: '支持工单', subtitle: '技术支持与历史工单对话', icon: MessageSquare, section: 'account', tone: 'emerald' },
  { id: 'profile', label: '我的账号', subtitle: '个人资料、订阅套餐与邀请返利', icon: UserRound, section: 'account', tone: 'slate' },
]

export default function App() {
  const [state, setState] = useState<ClientState | null>(null)
  const [startupError, setStartupError] = useState('')
  const [settings, setSettings] = useState<Settings>({})
  const [page, setPage] = useState('dashboard')
  const [modelGroup, setModelGroup] = useState('')
  const [studioOpened, setStudioOpened] = useState(false)
  const [pending, setPending] = useState(false)
  const [authError, setAuthError] = useState('')
  const [notice, setNotice] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('ravenai-theme') || 'light')
  const [preferences, setPreferences] = useState(false)
  const [announcementsOpen, setAnnouncementsOpen] = useState(false)
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<ReleaseInfo | null>(null)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false)
  const [autoUpdateCheck, setAutoUpdateCheck] = useState(
    () => localStorage.getItem(AUTO_UPDATE_STORAGE_KEY) !== 'false',
  )
  const [skippedVersion, setSkippedVersion] = useState(
    () => localStorage.getItem(SKIPPED_VERSION_STORAGE_KEY) || '',
  )
  const [maximized, setMaximized] = useState(false)
  const isDesktopWindow =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window && !('qa' in window)
  const action = useAction()
  const cache = useQueryClient()
  const fetching = useIsFetching()

  const authed = !!state?.authenticated
  const user = useApi<User>('/auth/me', authed)
  const announcements = useApi<Announcement[]>('/announcements', authed && !state?.verify_studio)
  const ticketSummary = useApi<TicketSummary>('/support-tickets/summary', authed && !state?.verify_studio)

  async function load() {
    try {
      setStartupError('')
      const next = await native<ClientState>('client_state')
      setState(next)
      if (next.verify_studio) setPage('studio')
    } catch (e) {
      setStartupError(String(e))
    }
  }

  useEffect(() => {
    void load()
    void native<Settings>('public_settings').then(setSettings).catch(() => {})
  }, [])

  async function runUpdateCheck(manual = false) {
    if (updateChecking) return
    setUpdateChecking(true)
    setUpdateError('')
    try {
      const info = await native<ReleaseInfo>('check_update')
      setUpdateInfo(info)
      if (manual) {
        if (info.has_update) {
          setUpdateBannerDismissed(false)
          setNotice(`发现新版本 ${info.display_version}`)
        } else {
          setNotice(`当前已是最新版本 ${formatDisplayVersion(info.current_version)}`)
        }
      }
    } catch (e) {
      if (manual) {
        setUpdateError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setUpdateChecking(false)
    }
  }

  useEffect(() => {
    if (!authed || state?.verify_studio || !autoUpdateCheck) return
    void runUpdateCheck(false)
  }, [authed, state?.verify_studio, autoUpdateCheck])

  function toggleAutoUpdateCheck(next: boolean) {
    setAutoUpdateCheck(next)
    localStorage.setItem(AUTO_UPDATE_STORAGE_KEY, next ? 'true' : 'false')
  }

  function skipUpdateVersion(version: string) {
    setSkippedVersion(version)
    localStorage.setItem(SKIPPED_VERSION_STORAGE_KEY, version)
    setUpdateBannerDismissed(true)
  }

  useEffect(() => {
    if (state) {
      void native('frontend_ready', { phase: state.authenticated ? 'workspace' : 'login' }).catch(() => {})
    }
  }, [state])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.dispatchEvent(new CustomEvent('raven-theme', { detail: theme }))
    localStorage.setItem('ravenai-theme', theme)
    void native('set_window_theme', { theme }).catch(() => {})
  }, [theme])

  useEffect(() => {
    if (page === 'studio') setStudioOpened(true)
  }, [page])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(''), 4200)
    return () => clearTimeout(id)
  }, [notice])

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    void listen<{ success: boolean; error?: string }>('auth-complete', event => {
      setPending(false)
      if (event.payload.success) {
        setAuthError('')
        cache.clear()
        void load()
      } else {
        setAuthError(event.payload.error || '登录未完成，请重试。')
      }
    })
      .then(stop => {
        if (disposed) stop()
        else unlisten = stop
      })
      .catch(e => setStartupError(String(e)))

    const ended = () => {
      setState(s => (s ? { ...s, authenticated: false, user: null } : s))
      setStudioOpened(false)
      cache.clear()
      setAuthError('登录已失效，请在官网重新授权。')
    }
    window.addEventListener('session-ended', ended)
    return () => {
      disposed = true
      unlisten?.()
      window.removeEventListener('session-ended', ended)
    }
  }, [cache])

  async function login() {
    setAuthError('')
    setPending(true)
    try {
      await native('login')
    } catch (e) {
      setPending(false)
      setAuthError(String(e))
    }
  }

  async function cancel() {
    try {
      await native('cancel_login')
      setPending(false)
      setAuthError('')
    } catch (e) {
      setAuthError(String(e))
    }
  }

  const currentUser = user.data || state?.user
  const baseUrl = settings.api_base_url || 'https://api.ravenaiworld.org/v1'
  const activePage = pages.find(p => p.id === page) || pages[0]
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  const announceList = Array.isArray(announcements.data) ? announcements.data : []
  const unreadAnnouncements = announceList.filter(a => !a.is_read && !a.read_at)
  const unreadTickets = ticketSummary.data?.unread_count || 0
  const isEmbedded = ['studio', 'purchase'].includes(page)

  useEffect(() => {
    if (!isDesktopWindow) return
    const syncMax = () => {
      void native<boolean>('window_control', { action: 'is_maximized' }).then(setMaximized).catch(() => {})
    }
    syncMax()
    window.addEventListener('resize', syncMax)
    return () => window.removeEventListener('resize', syncMax)
  }, [isDesktopWindow])

  const startWindowDrag = (e: React.MouseEvent<HTMLElement>) => {
    if (!isDesktopWindow || e.button !== 0 || e.detail > 1) return
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a, [role="button"]')) return
    void native('window_control', { action: 'drag' }).catch(() => {})
  }

  const toggleMaximize = (e?: React.MouseEvent<HTMLElement>) => {
    if (!isDesktopWindow) return
    if (e && (e.target as HTMLElement).closest('button, input, select, textarea, a, [role="button"]')) return
    void native<boolean>('window_control', { action: 'toggle_maximize' }).then(setMaximized).catch(() => {})
  }

  const windowControls = isDesktopWindow ? (
    <div className="win-controls" aria-label="窗口控制">
      <button
        type="button"
        className="win-btn"
        aria-label="最小化"
        title="最小化"
        onClick={() => void native('window_control', { action: 'minimize' }).catch(() => {})}
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        className="win-btn"
        aria-label={maximized ? '还原窗口' : '最大化'}
        title={maximized ? '还原窗口' : '最大化'}
        onClick={() => toggleMaximize()}
      >
        {maximized ? <Copy size={12} /> : <Square size={12} />}
      </button>
      <button
        type="button"
        className="win-btn close"
        aria-label="关闭窗口"
        title="关闭窗口"
        onClick={() => void native('window_control', { action: 'close' }).catch(() => {})}
      >
        <X size={15} />
      </button>
    </div>
  ) : null

  return (
    <NoticeContext.Provider value={setNotice}>
      <Boundary>
        <div className={`app ${isDesktopWindow ? 'desktop-framed' : ''} ${maximized ? 'maximized' : ''}`}>
          {!state ? (
            <div className="startup">
              {startupError ? <ErrorMessage error={startupError} retry={load} /> : <Loading label="正在初始化 Ravenai" />}
            </div>
          ) : !state.authenticated ? (
            <div className="login-page">
              <header onMouseDown={startWindowDrag} onDoubleClick={toggleMaximize}>
                <div className="brand-mark">
                  <img src={icon} alt="" />
                </div>
                <span className="brand-name">Ravenai</span>
                <span className="brand-tag">{formatDisplayVersion(state.version)}</span>
                <span className="spacer" />
                <IconButton
                  className="subtle"
                  label={theme === 'dark' ? '浅色外观' : '深色外观'}
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </IconButton>
                {windowControls}
              </header>

              <main className="login-main">
                <div className="login-card">
                  <div className="login-emblem">
                    <img className="login-logo" src={icon} alt="Ravenai" />
                  </div>
                  <h1>Ravenai</h1>
                  <p className="login-subtitle">
                    {pending
                      ? '请在默认浏览器中完成官网认证，并确认将本次会话授权给桌面端。'
                      : '连接你的 Ravenai 账户，探索模型广场、渠道实况、GPT分组降智检测与创作工作台。'}
                  </p>

                  <ErrorMessage error={authError} />

                  {pending ? (
                    <>
                      <div className="auth-wait">
                        <LoaderCircle size={15} className="spin" />
                        <span>等待官网授权</span>
                      </div>
                      <button
                        className="primary login-button"
                        onClick={() => {
                          void native('reopen_login').catch(e => setAuthError(String(e)))
                        }}
                      >
                        <Globe size={17} />
                        重新打开官网
                        <ArrowUpRight size={16} />
                      </button>
                      <button className="text-link login-cancel" onClick={cancel}>
                        取消登录
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="primary login-button" onClick={login}>
                        <Globe size={17} />
                        通过官网登录
                        <ArrowRight size={16} />
                      </button>
                      {settings.registration_enabled !== false && (
                        <button
                          className="text-link login-cancel"
                          onClick={() => {
                            void site('/register').catch(e => setAuthError(String(e)))
                          }}
                        >
                          注册账号
                          <ArrowUpRight size={14} />
                        </button>
                      )}
                    </>
                  )}

                  <div className="login-trust">
                    <span className="login-trust-item">
                      <span className="status-dot" />
                      ravenaiworld.org
                    </span>
                    <span className="login-trust-item">
                      <ShieldCheck size={13} />
                      PKCE 授权
                    </span>
                    <span className="login-trust-item">
                      <Lock size={13} />
                      DPAPI 加密
                    </span>
                  </div>
                </div>
              </main>

              <footer>
                <span>Ravenai Desktop for Windows</span>
                <span className="mono">{formatDisplayVersion(state.version)}</span>
              </footer>
            </div>
          ) : (
            <>
              <aside className="sidebar">
                <div className="brand" onMouseDown={startWindowDrag} onDoubleClick={toggleMaximize}>
                  <div className="brand-mark">
                    <img src={icon} alt="" />
                  </div>
                  <div className="brand-meta">
                    <span className="brand-name">Ravenai</span>
                    <span className="brand-tag">{formatDisplayVersion(state.version)}</span>
                  </div>
                </div>

                <nav aria-label="主要导航" className="sidebar-nav">
                  {NAV_SECTIONS.map(section => {
                    const sectionItems = pages.filter(
                      p =>
                        p.section === section.id &&
                        (!['models', 'channels'].includes(p.id) || settings.model_plaza_enabled !== false),
                    )
                    if (!sectionItems.length) return null
                    return (
                      <div key={section.id} className="nav-section">
                        <div className="nav-section-title">{section.label}</div>
                        {sectionItems.map(item => (
                          <button
                            key={item.id}
                            aria-label={item.label}
                            title={item.label}
                            data-tone={item.tone}
                            className={page === item.id ? 'active' : ''}
                            onClick={() => {
                              if (item.id === 'models') setModelGroup('')
                              setPage(item.id)
                            }}
                          >
                            <span className="nav-icon-tile" aria-hidden="true">
                              <item.icon size={14} />
                            </span>
                            <span className="nav-label">{item.label}</span>
                            {item.badge && (
                              <span className="nav-badge" aria-hidden="true">
                                {item.badge}
                              </span>
                            )}
                            {item.id === 'support' && unreadTickets > 0 && <i className="nav-dot" aria-hidden="true" />}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </nav>

                <div className="spacer" />

                <button className="account" onClick={() => setPage('profile')}>
                  <span className="avatar">
                    {(currentUser?.username || currentUser?.email || 'R').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="account-info">
                    <strong>{currentUser?.username || '我的账号'}</strong>
                    <small>{currentUser?.email || '正在读取账号'}</small>
                  </span>
                </button>

                <div className="sidebar-bottom">
                  <IconButton label="偏好设置" onClick={() => setPreferences(true)}>
                    <Settings2 size={16} />
                  </IconButton>
                  <button
                    type="button"
                    className={`sidebar-version-btn ${updateInfo?.has_update ? 'has-update' : ''}`}
                    aria-label="版本与更新"
                    title={updateInfo?.has_update ? `发现新版本 ${updateInfo.display_version}` : '点击检查更新'}
                    onClick={() => setUpdateOpen(true)}
                  >
                    <span>{formatDisplayVersion(state.version)}</span>
                    {updateInfo?.has_update && <i className="nav-dot" aria-hidden="true" />}
                  </button>
                  <IconButton label="退出登录" onClick={() => setLogoutConfirm(true)}>
                    <LogOut size={16} />
                  </IconButton>
                </div>
              </aside>

              <div className="main-shell">
                <header className="topbar" onMouseDown={startWindowDrag} onDoubleClick={toggleMaximize}>
                  <div className="topbar-title">
                    <h1>{activePage.label}</h1>
                    <span className="topbar-subtitle">{activePage.subtitle}</span>
                  </div>
                  <span className="spacer" />
                  <span className="server-pill">
                    <span className="status-dot" />
                    ravenaiworld.org
                  </span>
                  <IconButton label="系统公告" onClick={() => setAnnouncementsOpen(true)}>
                    <Bell size={16} />
                    {unreadAnnouncements.length > 0 && <span className="icon-button-dot" aria-hidden="true" />}
                  </IconButton>
                  <IconButton
                    label={theme === 'dark' ? '切换浅色外观' : '切换深色外观'}
                    onClick={toggleTheme}
                  >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  </IconButton>
                  <IconButton label="刷新数据" onClick={() => cache.invalidateQueries()}>
                    <RefreshCw size={16} className={fetching > 0 ? 'spin' : ''} />
                  </IconButton>
                  <IconButton label="支持工单" onClick={() => setPage('support')}>
                    <CircleHelp size={16} />
                  </IconButton>
                  {windowControls}
                </header>

                <main className={`content ${isEmbedded ? 'embedded-content' : ''}`}>
                  <div className="content-inner">
                    {updateInfo?.has_update &&
                      !updateBannerDismissed &&
                      updateInfo.latest_version !== skippedVersion && (
                        <UpdateBanner
                          info={updateInfo}
                          onOpen={() => setUpdateOpen(true)}
                          onDismiss={() => setUpdateBannerDismissed(true)}
                        />
                      )}
                    <ErrorMessage error={action.error} />
                    <ErrorMessage error={user.error} retry={() => user.refetch()} />
                    {!currentUser ? (
                      <Loading label="正在同步账户数据" />
                    ) : (
                      <>
                        {page === 'dashboard' && (
                          <Dashboard
                            user={currentUser}
                            navigate={setPage}
                            unreadAnnouncements={unreadAnnouncements}
                            onOpenAnnouncements={() => setAnnouncementsOpen(true)}
                          />
                        )}
                        {page === 'models' && <Models key={modelGroup} initialGroup={modelGroup} />}
                        {page === 'channels' && (
                          <ChannelStatus
                            onModels={group => {
                              setModelGroup(group)
                              setPage('models')
                            }}
                          />
                        )}
                        {page === 'trace' && <ModelTrace />}
                        {page === 'detector' && <ModelDetector baseUrl={baseUrl} />}
                        {page === 'keys' && (
                          <Keys baseUrl={baseUrl} customEndpoints={settings.custom_endpoints || []} />
                        )}
                        {page === 'usage' && <Usage />}
                        {page === 'purchase' && <Purchase redeem={() => setPage('redeem')} />}
                        {page === 'redeem' && <Redemption user={currentUser} />}
                        {(studioOpened || page === 'studio') && (
                          <ImageStudio
                            key={currentUser.id}
                            userId={currentUser.id}
                            active={page === 'studio'}
                            navigate={setPage}
                          />
                        )}
                        {page === 'ecosystem' && (
                          <AppRecommendations baseUrl={baseUrl} onOpenKeys={() => setPage('keys')} />
                        )}
                        {page === 'support' && <Support />}
                        {page === 'profile' && (
                          <Profile
                            key={currentUser.id}
                            user={currentUser}
                            onLogout={() => setLogoutConfirm(true)}
                          />
                        )}
                      </>
                    )}
                  </div>
                </main>
              </div>
            </>
          )}

          {announcementsOpen && (
            <Drawer title="系统公告" onClose={() => setAnnouncementsOpen(false)}>
              <ErrorMessage error={announcements.error} retry={() => announcements.refetch()} />
              {announcements.isPending ? (
                <Loading />
              ) : !announceList.length ? (
                <Empty icon={<Bell size={19} />} title="暂无系统公告" detail="重要线路调整与版本通知将显示在这里。" />
              ) : (
                announceList.map(item => {
                  const isUnread = !item.is_read && !item.read_at
                  return (
                    <article key={item.id} className={`announce-card ${isUnread ? 'unread' : ''}`}>
                      <header>
                        <strong>{item.title}</strong>
                        <small className="mono">{date(item.created_at)}</small>
                      </header>
                      <p>{item.content}</p>
                      {isUnread && (
                        <div style={{ marginTop: 10 }}>
                          <button
                            disabled={action.busy}
                            onClick={() =>
                              action.run(async () => {
                                await api(`/announcements/${item.id}/read`, 'POST')
                                await cache.invalidateQueries({ queryKey: ['/announcements'] })
                              })
                            }
                          >
                            标为已读
                          </button>
                        </div>
                      )}
                    </article>
                  )
                })
              )}
            </Drawer>
          )}

          {preferences && (
            <Drawer title="偏好设置" onClose={() => setPreferences(false)}>
              <div className="kv-group">
                <KeyValue label="外观主题">
                  <div className="segmented">
                    <button
                      className={theme === 'light' ? 'selected' : ''}
                      onClick={() => setTheme('light')}
                    >
                      <Sun size={14} />
                      浅色
                    </button>
                    <button
                      className={theme === 'dark' ? 'selected' : ''}
                      onClick={() => setTheme('dark')}
                    >
                      <Moon size={14} />
                      深色
                    </button>
                  </div>
                </KeyValue>
                <KeyValue label="客户端版本">
                  <code>{formatDisplayVersion(state?.version)}</code>
                  <button
                    type="button"
                    className="text-link small"
                    onClick={() => {
                      setPreferences(false)
                      setUpdateOpen(true)
                    }}
                  >
                    <Download size={13} />
                    {updateInfo?.has_update ? `升级至 ${updateInfo.display_version}` : '检查更新'}
                  </button>
                </KeyValue>
                <KeyValue label="运行平台">Windows Desktop (Tauri)</KeyValue>
              </div>

              <h3>服务端点</h3>
              <div className="kv-group">
                <KeyValue label="服务地址">
                  <code>ravenaiworld.org</code>
                </KeyValue>
                <KeyValue label="API 地址">
                  <code>{baseUrl}</code>
                  <CopyButton text={baseUrl} label="复制 API 地址" />
                </KeyValue>
              </div>

              <div className="form-actions">
                <button onClick={() => action.run(() => site('/'))}>
                  访问官网
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </Drawer>
          )}

          {updateOpen && state && (
            <UpdateDrawer
              currentVersion={state.version}
              info={updateInfo}
              checking={updateChecking}
              checkError={updateError}
              autoCheck={autoUpdateCheck}
              onToggleAutoCheck={toggleAutoUpdateCheck}
              onCheck={runUpdateCheck}
              onSkipVersion={skipUpdateVersion}
              onClose={() => setUpdateOpen(false)}
            />
          )}

          {logoutConfirm && (
            <Drawer title="退出登录" onClose={() => !action.busy && setLogoutConfirm(false)}>
              <p>退出当前电脑上的 Ravenai 桌面登录状态？已加密保存的本地会话会被立即清除。</p>
              <ErrorMessage error={action.error} />
              <div className="form-actions">
                <button disabled={action.busy} onClick={() => setLogoutConfirm(false)}>
                  取消
                </button>
                <button
                  className="danger"
                  disabled={action.busy}
                  onClick={() =>
                    action.run(async () => {
                      try {
                        await native('logout')
                      } finally {
                        const next = await native<ClientState>('client_state')
                        setState(next)
                        if (!next.authenticated) {
                          setStudioOpened(false)
                          cache.clear()
                          setLogoutConfirm(false)
                          setPage('dashboard')
                        }
                      }
                    })
                  }
                >
                  退出登录
                </button>
              </div>
            </Drawer>
          )}

          {notice && (
            <div className="toast" role="status">
              <span className="toast-check">
                <Check size={12} />
              </span>
              <span>{notice}</span>
              <IconButton label="关闭提示" onClick={() => setNotice('')}>
                <X size={13} />
              </IconButton>
            </div>
          )}
        </div>
      </Boundary>
    </NoticeContext.Provider>
  )
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <div className="startup">
        <p>此页面未能加载，请重新打开客户端。</p>
        <button className="primary" onClick={() => window.location.reload()}>
          重新加载
        </button>
      </div>
    ) : (
      this.props.children
    )
  }
}
