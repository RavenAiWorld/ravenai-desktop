'use strict'
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')

exports.run = async ({ app, win, session, vault }) => {
  const out = process.env.RAVEN_QA_OUTPUT
  const result = { checks: [], production: {}, pages: [], errors: [] }
  result.console = []
  result.network = []
  win.webContents.on('console-message', (details) => {
    if (details?.level === 'error' || /captcha|turnstile/i.test(details?.message || '')) result.console.push(String(details.message).replace(/https?:\/\/\S+/g, '[url]').slice(0, 400))
  })
  session.webRequest.onErrorOccurred((details) => { const url = new URL(details.url); result.network.push({ host: url.host, error: details.error }) })
  session.webRequest.onCompleted((details) => { const url = new URL(details.url); if (/challenges.cloudflare.com/.test(url.host)) result.network.push({ host: url.host, status: details.statusCode }) })
  const evaluate = (code) => win.webContents.executeJavaScript(code, true)
  const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms))
  async function waitFor(code, timeout = 25000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(code)) return
      await pause(200)
    }
    throw Error('Timed out: ' + code.slice(0, 120))
  }
  async function capture(name) {
    await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))")
    win.webContents.invalidate()
    await pause(800)
    await fs.writeFile(path.join(out, name + '.png'), (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG())
    result.pages.push(await evaluate(`({name:${JSON.stringify(name)},path:location.pathname,width:innerWidth,height:innerHeight,title:document.title,overflow:document.documentElement.scrollWidth>innerWidth,heading:document.querySelector('h1,h2')?.textContent?.trim()})`))
  }
  try {
    try { const response = await session.fetch('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', { bypassCustomProtocolHandlers: true }); result.directCaptcha = { status: response.status, length: (await response.text()).length } } catch (error) { result.directCaptcha = { error: error.message.replace(/https?:\/\/\S+/g, '[url]') } }
    await waitFor("!!document.querySelector('#email')")
    result.checks.push('Bundled login mounted on production HTTPS origin')
    await waitFor("document.querySelector('.desktop-connection')?.textContent.includes('已连接')")
    const production = await evaluate("fetch('/api/v1/settings/public').then(r=>r.json()).then(r=>({code:r.code,site:r.data?.site_name,version:r.data?.version,registration:r.data?.registration_enabled,turnstile:r.data?.turnstile_enabled,linuxdo:r.data?.linuxdo_oauth_enabled}))")
    assert.equal(production.code, 0)
    assert.equal(production.site, 'Ravenai')
    result.production = production
    result.checks.push('Real production public settings loaded')
    const isolated = await evaluate("({node:typeof require,process:typeof process,bridge:typeof ravenDesktop,origin:location.origin})")
    assert.equal(isolated.node, 'undefined')
    assert.equal(isolated.process, 'undefined')
    assert.equal(isolated.bridge, 'object')
    assert.equal(isolated.origin, 'https://ravenaiworld.org')
    result.checks.push('Renderer sandbox, isolation and production origin verified')
    await pause(12000)
    result.captcha = await evaluate("({api:typeof window.turnstile,frames:Array.from(document.querySelectorAll('iframe')).map(x=>{try{return new URL(x.src).origin}catch{return ''}}),errors:Array.from(document.querySelectorAll('[role=alert]')).map(x=>x.textContent?.trim().slice(0,160))})")
    const captchaFrame = win.webContents.mainFrame.framesInSubtree.some(frame => frame.url.startsWith('https://challenges.cloudflare.com/'))
    assert.equal(captchaFrame, true)
    assert.equal(result.captcha.api, 'object')
    result.checks.push('Real Cloudflare challenge frame and script rendered')
    const { forwardRequest } = require('../desktop/transport.cjs')
    const oauth = await forwardRequest(session, new Request('https://ravenaiworld.org/api/v1/auth/oauth/linuxdo/start?redirect=%2Fdashboard'))
    assert.equal(oauth.status, 302)
    assert.equal(new URL(oauth.headers.get('location')).hostname, 'connect.linux.do')
    const oauthCookies = await session.cookies.get({ domain: 'ravenaiworld.org' })
    assert(oauthCookies.some(cookie => /oauth|linuxdo|state/.test(cookie.name)))
    result.checks.push('Live LinuxDo authorization redirect and isolated OAuth cookies verified; no provider sign-in performed')
    await capture('login-desktop')
    await evaluate("document.querySelector('a[href=\"/register\"]')?.click()")
    await waitFor("location.pathname==='/register'")
    await capture('register-desktop')
    win.setSize(860, 700)
    await capture('register-compact')
    await win.loadURL('https://ravenaiworld.org/login')
    await waitFor("!!document.querySelector('#email')")
    await capture('login-compact')
    await evaluate("document.querySelector('.auth-icon-btn').click()")
    await waitFor("document.documentElement.classList.contains('dark')")
    await vault.flush()
    const stored = await vault.read()
    assert.equal(stored.theme, 'dark')
    assert.equal((await fs.readFile(path.join(app.getPath('userData'), 'account.vault'))).includes(Buffer.from('theme')), false)
    result.checks.push('Theme persisted through encrypted Windows vault without plaintext')
    await capture('login-dark')
    const protectedStatus = await evaluate("fetch('/api/v1/auth/me').then(r=>r.status)")
    assert.equal(protectedStatus, 401)
    result.checks.push('Protected production API denies anonymous requests')
    await win.loadURL('https://ravenaiworld.org/dashboard')
    await waitFor("location.pathname==='/login'")
    result.checks.push('Authenticated routes preserve native sign-in guard')
    const setupStatus = await evaluate("fetch('/setup/status').then(r=>r.json()).then(r=>r.data?.needs_setup)")
    assert.equal(setupStatus, false)
    result.checks.push('Setup API forwarded correctly rather than swallowed by SPA')
    await require('./qa-workspace.cjs').run({ app, win, session, vault, evaluate, waitFor, capture, result })
    for (const page of result.pages) assert.equal(page.overflow, false, page.name)
    result.checks.push('Desktop and compact layouts have no horizontal overflow')
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'
    result.errors.push(error.message)
    try { await capture('failure') } catch {}
    process.exitCode = 1
  } finally {
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result, null, 2))
    await vault.flush()
    app.quit()
  }
}
