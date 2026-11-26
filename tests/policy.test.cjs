'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { SITE_ORIGIN, parseURL, siteURL, isLocalPage, validateStore, cleanFilename } = require('../desktop/policy.cjs')

test('only the precise production origin can access the desktop bridge', () => {
  assert.equal(siteURL(SITE_ORIGIN + '/login'), true)
  for (const url of ['https://ravenaiworld.org.evil.test', 'http://ravenaiworld.org', 'https://user:pass@ravenaiworld.org', 'file:///C:/x', 'javascript:alert(1)', 'https://api.ravenaiworld.org']) assert.equal(siteURL(url), false)
  assert.equal(parseURL('not a URL'), null)
})
test('SPA routes do not swallow backend, captcha, OAuth or Studio resources', () => {
  for (const route of ['/login', '/register', '/admin/dashboard', '/dashboard', '/auth/linuxdo/callback', '/payment/stripe', '/orders', '/buy-credits', '/settings/mcp', '/oauth/mcp/authorize']) assert.equal(isLocalPage(route), true, route)
  for (const route of ['/api/v1/auth/login', '/setup/status', '/setup/test-db', '/auth/linuxdo', '/assets/studio/', '/assets/studio/app.js', '/.env', '/admin/../secret', '/login.evil']) assert.equal(isLocalPage(route), false, route)
})
test('encrypted store rejects prototypes, oversized values and non-string data', () => {
  assert.deepEqual(validateStore({ theme: 'dark', auth_token: 'test' }), { theme: 'dark', auth_token: 'test' })
  for (const data of [null, [], { x: 42 }, JSON.parse('{"__proto__":"x"}'), { x: 'x'.repeat(3 * 1024 * 1024 + 1) }]) assert.throws(() => validateStore(data))
  assert.equal(cleanFilename('../secret:key?.txt'), '.._secret_key_.txt')
})
