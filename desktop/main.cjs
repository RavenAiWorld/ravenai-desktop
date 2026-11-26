'use strict'

const { app, BrowserWindow, session, ipcMain, Menu, safeStorage, dialog, nativeTheme } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { SITE_ORIGIN, CONTENT_SECURITY_POLICY, parseURL, siteURL, isLocalPage, cleanFilename } = require('./policy.cjs')
const { createVault } = require('./vault.cjs')
const { forwardRequest } = require('./transport.cjs')

const qa = !app.isPackaged && process.env.RAVEN_QA === '1'
const verifying = process.argv.includes('--verify-install')
if (verifying) app.setPath('userData', require('node:fs').mkdtempSync(path.join(app.getPath('temp'), 'ravenai-install-check-')))
if (qa && process.env.RAVEN_QA_DATA) app.setPath('userData', path.resolve(process.env.RAVEN_QA_DATA))
app.setName('Ravenai')
app.setAppUserModelId('org.ravenai.desktop')
app.commandLine.appendSwitch('lang', 'zh-CN')

const root = path.resolve(__dirname, '..')
const windows = new Set()
let mainWindow
let vault
let appSession
let closeApproved = false
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.zip': 'application/zip' }

function authorize(event) {
  const win = BrowserWindow.fromWebContents(event.sender)
  const url = parseURL(event.senderFrame?.url)
  if (!win || !windows.has(win) || event.senderFrame !== event.sender.mainFrame || !url || !siteURL(url.href) || !isLocalPage(url.pathname)) throw Error('Untrusted frame')
  return win
}

function sendNavigation(win) {
  if (win.isDestroyed()) return
  win.webContents.send('raven:navigation', {
    back: win.webContents.navigationHistory.canGoBack(),
    forward: win.webContents.navigationHistory.canGoForward(),
  })
}

async function createProtocol() {
  const renderer = path.join(root, 'renderer')
  const files = new Map()
  async function scan(directory, prefix = '') {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const relative = prefix + '/' + entry.name
      if (entry.isDirectory()) await scan(path.join(directory, entry.name), relative)
      else if (entry.isFile()) files.set(relative, path.join(directory, entry.name))
    }
  }
  await scan(renderer)
  appSession.protocol.handle('https', async (request) => {
    const url = parseURL(request.url)
    if (!url) return new Response('Invalid URL', { status: 400 })
    if (url.origin === SITE_ORIGIN && ['GET', 'HEAD'].includes(request.method)) {
      const file = files.get(url.pathname) || (isLocalPage(url.pathname) ? files.get('/index.html') : null)
      if (file) {
        const type = mimeTypes[path.extname(file)] || 'application/octet-stream'
        return new Response(request.method === 'HEAD' ? null : await fs.readFile(file), {
          headers: { 'content-type': type, 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', 'referrer-policy': 'strict-origin-when-cross-origin', 'content-security-policy': CONTENT_SECURITY_POLICY },
        })
      }
    }
    try {
      return await forwardRequest(appSession, request)
    } catch (error) {
      if (qa && url.hostname === 'challenges.cloudflare.com') console.log('Captcha transport:', error.name, String(error.message).replace(/https?:\/\/\S+/g, '[url]'))
      return new Response(JSON.stringify({ code: -1, message: '无法连接服务器，请检查网络后重试。' }), { status: 503, headers: { 'content-type': 'application/json' } })
    }
  })
}

function secureWindow(win) {
  windows.add(win)
  win.on('closed', () => windows.delete(win))
  const contents = win.webContents
  contents.on('will-attach-webview', (event) => event.preventDefault())
  const guardNavigation = (event, url) => {
    const parsed = parseURL(url)
    if (!parsed || parsed.protocol !== 'https:') event.preventDefault()
  }
  contents.on('will-navigate', guardNavigation)
  contents.on('will-redirect', guardNavigation)
  contents.setWindowOpenHandler(({ url }) => {
    const parsed = parseURL(url)
    const source = parseURL(contents.getURL())
    const trustedBlank = url === 'about:blank' && source && source.origin === SITE_ORIGIN && isLocalPage(source.pathname)
    if ((!parsed || parsed.protocol !== 'https:') && !trustedBlank) return { action: 'deny' }
    return { action: 'allow', overrideBrowserWindowOptions: {
      parent: mainWindow, width: 1040, height: 800, minWidth: 680, minHeight: 560,
      show: !qa && !verifying, backgroundColor: '#ffffff', autoHideMenuBar: true,
      webPreferences: { session: appSession, preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, devTools: !app.isPackaged },
    } }
  })
  contents.on('did-create-window', secureWindow)
  contents.on('did-navigate', () => sendNavigation(win))
  contents.on('did-navigate-in-page', () => sendNavigation(win))
  contents.on('did-finish-load', () => sendNavigation(win))
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.alt && input.key === 'ArrowLeft' && contents.navigationHistory.canGoBack()) {
      event.preventDefault(); contents.navigationHistory.goBack()
    } else if (input.alt && input.key === 'ArrowRight' && contents.navigationHistory.canGoForward()) {
      event.preventDefault(); contents.navigationHistory.goForward()
    }
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320, height: 920, minWidth: 820, minHeight: 660,
    show: false, backgroundColor: '#f7f8fa', title: 'Ravenai',
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#f3f4f6', symbolColor: '#4b5058', height: 39 },
    icon: path.join(root, 'assets/icon.png'), autoHideMenuBar: true,
    webPreferences: { session: appSession, preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, devTools: !app.isPackaged, spellcheck: false, backgroundThrottling: !qa && !verifying },
  })
  secureWindow(mainWindow)
  if (!qa && !verifying) mainWindow.once('ready-to-show', () => mainWindow.show())
  await mainWindow.loadURL(SITE_ORIGIN + '/login')
  return mainWindow
}

async function start() {
  appSession = session.fromPartition('ravenai-memory', { cache: false })
  appSession.setPermissionRequestHandler((contents, permission, callback) => callback(
    siteURL(contents.getURL()) && ['clipboard-sanitized-write', 'fullscreen'].includes(permission)))
  appSession.setPermissionCheckHandler((contents, permission, origin) =>
    siteURL(origin) && ['clipboard-sanitized-write', 'fullscreen'].includes(permission))
  appSession.on('will-download', async (_event, item) => {
    item.setSaveDialogOptions({ title: '保存文件', defaultPath: path.join(app.getPath('downloads'), cleanFilename(item.getFilename())) })
  })
  vault = createVault(app.getPath('userData'), safeStorage)
  ipcMain.handle('raven:storage:read', async (event) => { authorize(event); return vault.read() })
  ipcMain.handle('raven:storage:write', async (event, data) => { authorize(event); await vault.write(data) })
  ipcMain.handle('raven:info', (event) => { const win = authorize(event); sendNavigation(win); return { version: app.getVersion(), server: SITE_ORIGIN } })
  ipcMain.handle('raven:theme', (event, dark) => { const win = authorize(event); nativeTheme.themeSource = dark ? 'dark' : 'light'; if (win === mainWindow) win.setTitleBarOverlay({ color: dark ? '#202124' : '#f3f4f6', symbolColor: dark ? '#e5e7eb' : '#4b5058', height: 39 }) })
  ipcMain.handle('raven:navigate', (event, action) => {
    const win = authorize(event)
    const history = win.webContents.navigationHistory
    if (action === 'back' && history.canGoBack()) history.goBack()
    else if (action === 'forward' && history.canGoForward()) history.goForward()
    else if (action === 'reload') win.webContents.reload()
    sendNavigation(win)
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Ravenai', submenu: [{ label: '关于 Ravenai', click: () => dialog.showMessageBox(mainWindow, { type: 'info', title: '关于 Ravenai', message: 'Ravenai ' + app.getVersion(), detail: 'ravenaiworld.org\n基于 Sub2API · AGPL-3.0\n完整源码随安装包提供。' }) }, { type: 'separator' }, { role: 'quit', label: '退出' }] },
    { label: '编辑', submenu: [{ role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' }, { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }] },
    { label: '视图', submenu: [{ label: '返回 Ravenai', accelerator: 'Alt+Home', click: () => mainWindow.loadURL(SITE_ORIGIN + '/dashboard') }, { role: 'reload', label: '重新加载' }, { role: 'resetZoom', label: '实际大小' }, { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' }, { role: 'togglefullscreen', label: '全屏' }] },
  ]))
  await createProtocol()
  const win = await createWindow()
  if (verifying) await require('./verify.cjs').run({ app, win })
  if (qa) await require(path.join(root, 'tests/qa-driver.cjs')).run({ app, win, session: appSession, vault })
}

if (!qa && !verifying && !app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus() } })
  app.whenReady().then(start).catch(() => {
    if (!qa && !verifying) dialog.showErrorBox('Ravenai 启动失败', '应用未能启动，请重新安装或联系支持。')
    process.exitCode = 1
    app.quit()
  })
  app.on('before-quit', (event) => {
    if (closeApproved || !vault) return
    event.preventDefault()
    vault.flush().finally(() => { closeApproved = true; app.quit() })
  })
  app.on('window-all-closed', () => app.quit())
}
