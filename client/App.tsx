import { Component, useEffect, useState, type ReactNode } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowRight, ArrowUpRight, Boxes, Check, CircleHelp, Globe, House, Image, KeyRound, LoaderCircle, LogOut, MessageSquare, Moon, RefreshCw, Settings2, Sun, UserRound, Wallet, X } from 'lucide-react'
import icon from '../assets/icon.png'
import { native, site, useApi } from './native'
import type { ClientState, Settings, User } from './types'
import { Drawer, ErrorMessage, IconButton, KeyValue, Loading, NoticeContext, useAction } from './ui'
import Dashboard from './Dashboard'
import Keys from './Keys'
import Usage from './Usage'
import Models from './Models'
import Billing from './Billing'
import Support from './Support'
import Profile from './Profile'

const pages = [
  { id: 'dashboard', label: '概览', icon: House }, { id: 'models', label: '模型目录', icon: Boxes },
  { id: 'keys', label: 'API 密钥', icon: KeyRound }, { id: 'usage', label: '用量记录', icon: Activity },
  { id: 'billing', label: '账单与余额', icon: Wallet }, { id: 'support', label: '支持工单', icon: MessageSquare },
  { id: 'profile', label: '我的账号', icon: UserRound },
]
export default function App() {
  const [state, setState] = useState<ClientState | null>(null), [startupError, setStartupError] = useState(''), [settings, setSettings] = useState<Settings>({}), [page, setPage] = useState('dashboard')
  const [pending, setPending] = useState(false), [authError, setAuthError] = useState(''), [notice, setNotice] = useState(''), [theme, setTheme] = useState(() => localStorage.getItem('ravenai-theme') || 'light')
  const [preferences, setPreferences] = useState(false), [logoutConfirm, setLogoutConfirm] = useState(false), action = useAction(), cache = useQueryClient()
  const user = useApi<User>('/auth/me', !!state?.authenticated)
  async function load() { try { setStartupError(''); setState(await native<ClientState>('client_state')) } catch (e) { setStartupError(String(e)) } }
  useEffect(() => { void load(); void native<Settings>('public_settings').then(setSettings).catch(() => {}) }, [])
  useEffect(() => { if (state) void native('frontend_ready', { phase: state.authenticated ? 'workspace' : 'login' }).catch(() => {}) }, [state])
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('ravenai-theme', theme) }, [theme])
  useEffect(() => { if (notice) { const id = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(id) } }, [notice])
  useEffect(() => {
    let disposed = false, unlisten: (() => void) | undefined
    void listen<{ success: boolean; error?: string }>('auth-complete', event => { setPending(false); if (event.payload.success) { setAuthError(''); cache.clear(); void load() } else setAuthError(event.payload.error || '登录未完成，请重试。') }).then(stop => { if (disposed) stop(); else unlisten = stop }).catch(e => setStartupError(String(e)))
    const ended = () => { setState(s => s ? { ...s, authenticated: false, user: null } : s); cache.clear(); setAuthError('登录已失效，请在官网重新授权。') }
    window.addEventListener('session-ended', ended)
    return () => { disposed = true; unlisten?.(); window.removeEventListener('session-ended', ended) }
  }, [cache])
  async function login() { setAuthError(''); setPending(true); try { await native('login') } catch (e) { setPending(false); setAuthError(String(e)) } }
  async function cancel() { try { await native('cancel_login'); setPending(false); setAuthError('') } catch (e) { setAuthError(String(e)) } }
  const currentUser = user.data || state?.user, baseUrl = settings.api_base_url || 'https://api.ravenaiworld.org/v1'
  return <NoticeContext.Provider value={setNotice}><Boundary><div className="app">
    {!state ? <div className="startup">{startupError ? <ErrorMessage error={startupError} retry={load}/> : <Loading/>}</div> : !state.authenticated ? <div className="login-page"><header><img src={icon} alt=""/><span>Ravenai</span><span className="spacer"/><IconButton label={theme === 'dark' ? '浅色外观' : '深色外观'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</IconButton></header><main><img className="login-logo" src={icon} alt="Ravenai"/><h1>Ravenai</h1><p>{pending ? '在浏览器中完成官网认证并确认授权。' : '登录你的账号，继续工作。'}</p><ErrorMessage error={authError}/>{pending ? <><div className="auth-wait"><LoaderCircle size={19} className="spin"/><span>等待官网授权</span></div><button className="primary login-button" onClick={() => { void native('reopen_login').catch(e => setAuthError(String(e))) }}><Globe size={18}/>重新打开官网<ArrowUpRight size={16}/></button><button className="text-link login-cancel" onClick={cancel}>取消登录</button></> : <><button className="primary login-button" onClick={login}><Globe size={18}/>通过官网登录<ArrowRight size={17}/></button>{settings.registration_enabled !== false && <button className="text-link login-cancel" onClick={() => { void site('/register').catch(e => setAuthError(String(e))) }}>注册账号<ArrowUpRight size={14}/></button>}</>}<div className="login-origin"><span className="status-dot"/>ravenaiworld.org</div></main><footer><span>Ravenai for Windows</span><span>版本 {state.version}</span></footer></div> : <>
      <aside className="sidebar"><div className="brand"><img src={icon} alt=""/><span>Ravenai</span></div><div className="workspace-label">工作空间</div><nav aria-label="主要导航">{pages.filter(p => p.id !== 'models' || settings.model_plaza_enabled !== false).map(item => <button key={item.id} aria-label={item.label} title={item.label} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><item.icon size={18}/><span>{item.label}</span></button>)}</nav><div className="sidebar-divider"/><div className="workspace-label">官网工具</div><nav aria-label="官网工具"><button aria-label="图片工作室" title="图片工作室" onClick={() => action.run(() => site('/image-studio'))}><Image size={18}/><span>图片工作室</span><ArrowUpRight size={14}/></button><button aria-label="模型实况" title="模型实况" onClick={() => action.run(() => site('/model-trace'))}><Activity size={18}/><span>模型实况</span><ArrowUpRight size={14}/></button></nav><div className="spacer"/><button className="account" onClick={() => setPage('profile')}><span className="avatar">{(currentUser?.username || currentUser?.email || 'R').slice(0, 1).toUpperCase()}</span><span><strong>{currentUser?.username || '我的账号'}</strong><small>{currentUser?.email || '正在读取账号'}</small></span></button><div className="sidebar-bottom"><IconButton label="偏好设置" onClick={() => setPreferences(true)}><Settings2 size={17}/></IconButton><span>v{state.version}</span><IconButton label="退出登录" onClick={() => setLogoutConfirm(true)}><LogOut size={17}/></IconButton></div></aside>
      <div className="main-shell"><header className="topbar"><h1>{pages.find(p => p.id === page)?.label || '概览'}</h1><span className="spacer"/><span className="server-label"><span className="status-dot"/>Ravenai</span><IconButton label="刷新数据" onClick={() => cache.invalidateQueries()}><RefreshCw size={17}/></IconButton><IconButton label="支持工单" onClick={() => setPage('support')}><CircleHelp size={18}/></IconButton></header><main className="content"><ErrorMessage error={action.error}/><ErrorMessage error={user.error} retry={() => user.refetch()}/>{!currentUser ? <Loading/> : <>{page === 'dashboard' && <Dashboard user={currentUser} navigate={setPage}/>} {page === 'models' && <Models/>}{page === 'keys' && <Keys baseUrl={baseUrl}/>} {page === 'usage' && <Usage/>}{page === 'billing' && <Billing user={currentUser}/>} {page === 'support' && <Support/>} {page === 'profile' && <Profile key={currentUser.id} user={currentUser} onLogout={() => setLogoutConfirm(true)}/>}</>}</main></div>
    </>}
    {preferences && <Drawer title="偏好设置" onClose={() => setPreferences(false)}><KeyValue label="外观"><div className="segmented"><button className={theme === 'light' ? 'selected' : ''} onClick={() => setTheme('light')}><Sun size={15}/>浅色</button><button className={theme === 'dark' ? 'selected' : ''} onClick={() => setTheme('dark')}><Moon size={15}/>深色</button></div></KeyValue><KeyValue label="版本">{state?.version}</KeyValue><KeyValue label="服务地址"><code>ravenaiworld.org</code></KeyValue><KeyValue label="API 地址"><code>{baseUrl}</code></KeyValue><KeyValue label="平台">Windows</KeyValue><button onClick={() => action.run(() => site('/'))}>访问官网<ArrowUpRight size={15}/></button></Drawer>}
    {logoutConfirm && <Drawer title="退出登录" onClose={() => !action.busy && setLogoutConfirm(false)}><p>退出这台电脑的 Ravenai 登录？</p><ErrorMessage error={action.error}/><div className="form-actions"><button disabled={action.busy} onClick={() => setLogoutConfirm(false)}>取消</button><button className="primary" disabled={action.busy} onClick={() => action.run(async () => { try { await native('logout') } finally { const next = await native<ClientState>('client_state'); setState(next); if (!next.authenticated) { cache.clear(); setLogoutConfirm(false); setPage('dashboard') } } })}>退出登录</button></div></Drawer>}
    {notice && <div className="toast" role="status"><Check size={17}/><span>{notice}</span><IconButton label="关闭提示" onClick={() => setNotice('')}><X size={14}/></IconButton></div>}
  </div></Boundary></NoticeContext.Provider>
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="startup"><p>此页面未能加载，请重新打开客户端。</p><button onClick={() => window.location.reload()}>重新加载</button></div> : this.props.children }
}
