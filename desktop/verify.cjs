'use strict'
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')

// Read-only packaged-app smoke check, always in a fresh profile and hidden window.
exports.run = async ({ app, win }) => {
  const report = { version: app.getVersion(), packaged: app.isPackaged, executable: app.getPath('exe'), checks: [] }
  try {
    const evaluate = code => win.webContents.executeJavaScript(code, true)
    const deadline = Date.now() + 45000
    while (Date.now() < deadline) {
      if (await evaluate("!!document.querySelector('#email') && document.querySelector('.desktop-connection')?.textContent.includes('已连接')")) break
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    assert.equal(await evaluate("!!document.querySelector('#email')"), true)
    report.checks.push('Installed login form rendered')
    const remote = await evaluate("fetch('/api/v1/settings/public').then(r=>r.json()).then(r=>({code:r.code,name:r.data?.site_name,version:r.data?.version}))")
    assert.equal(remote.code, 0)
    assert.equal(remote.name, 'Ravenai')
    report.service = remote
    report.checks.push('Production Sub2API public API connected')
    assert.equal(await evaluate("typeof require==='undefined' && typeof process==='undefined' && typeof ravenDesktop==='object'"), true)
    assert.equal(await evaluate("!localStorage.getItem('auth_token')"), true)
    assert.equal(win.isVisible(), false)
    report.checks.push('Sandbox, fresh signed-out profile and hidden window verified')
    const source = path.join(process.resourcesPath, 'source/ravenai-desktop-source.zip')
    report.sourceBytes = (await fs.stat(source)).size
    assert(report.sourceBytes > 1000)
    report.checks.push('Corresponding application source included')
    win.webContents.invalidate()
    await new Promise(resolve => setTimeout(resolve, 600))
    await fs.writeFile(path.join(app.getPath('userData'), 'login.png'), (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG())
    report.status = 'passed'
  } catch (error) { report.status = 'failed'; report.error = error.message; process.exitCode = 1 }
  await fs.writeFile(path.join(app.getPath('userData'), 'verification.json'), JSON.stringify(report, null, 2))
  app.quit()
}
