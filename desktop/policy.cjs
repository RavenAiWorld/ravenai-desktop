'use strict'

const SITE_ORIGIN = 'https://ravenaiworld.org'
const API_ORIGIN = 'https://api.ravenaiworld.org'
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "worker-src 'self' blob:",
  "script-src 'self' https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com https://*.alicdn.com https://static.cloudflareinsights.com https://turing.captcha.qcloud.com https://turing.captcha.gtimg.com https://ca.turing.captcha.qcloud.com https://global.turing.captcha.gtimg.com https://www.tycaptcha.com https://cloudcache.tencentcs.com https://*.stripe.com https://static.airwallex.com https://checkout.airwallex.com https://static-demo.airwallex.com https://checkout-demo.airwallex.com",
  "style-src 'self' 'unsafe-inline' https://*.captcha.gtimg.com https://hcaptcha.com https://*.hcaptcha.com https://fonts.googleapis.com https://*.alicdn.com https://static.airwallex.com https://checkout.airwallex.com https://static-demo.airwallex.com https://checkout-demo.airwallex.com",
  "img-src 'self' data: blob: https:", "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https:",
  "frame-src 'self' https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com https://turing.captcha.qcloud.com https://ca.turing.captcha.qcloud.com https://www.tycaptcha.com https://*.stripe.com https://checkout.airwallex.com https://checkout-demo.airwallex.com https://wzyp.cn",
  "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
].join('; ')
const SPA_ROUTES = [
  '/login', '/register', '/email-verify', '/forgot-password', '/reset-password',
  '/home', '/dashboard', '/keys', '/usage', '/subscriptions', '/desktop-settings',
  '/redeem', '/purchase', '/payment', '/profile', '/announcements', '/support',
  '/model-plaza', '/model-trace', '/image-studio', '/batch-image', '/docs/batch-image',
  '/affiliate', '/key-usage', '/setup', '/buy-credits', '/available-channels',
  '/settings/mcp', '/oauth/mcp/authorize', '/orders', '/admin', '/monitor',
  '/auth/callback', '/auth/oauth/callback', '/auth/linuxdo/callback',
  '/auth/wechat/callback', '/auth/wechat/payment/callback',
  '/auth/dingtalk/callback', '/auth/dingtalk/email-completion', '/auth/oidc/callback',
  '/payment/qrcode', '/payment/result', '/payment/stripe', '/payment/airwallex', '/payment/stripe-popup',
]

function parseURL(value) {
  try {
    const url = new URL(value)
    return !url.username && !url.password ? url : null
  } catch { return null }
}

function siteURL(value) {
  const url = parseURL(value)
  return !!url && url.origin === SITE_ORIGIN
}

function isLocalPage(pathname) {
  return pathname === '/' || SPA_ROUTES.includes(pathname) ||
    /^\/admin(?:\/[a-z0-9-]+){1,3}$/.test(pathname) ||
    /^\/(?:legal|custom)\/[a-zA-Z0-9_-]+$/.test(pathname) ||
    /^\/support(?:\/\d+)?$/.test(pathname)
}

function cleanFilename(value) {
  return String(value).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180) || 'download'
}

function validateStore(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid application storage')
  const entries = Object.entries(data)
  if (entries.length > 500 || JSON.stringify(data).length > 6 * 1024 * 1024) throw Error('Application storage is too large')
  for (const [key, value] of entries) {
    if (typeof value !== 'string' || key.length > 256 || value.length > 3 * 1024 * 1024 || ['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('Invalid storage entry')
  }
  return Object.fromEntries(entries)
}

module.exports = { SITE_ORIGIN, API_ORIGIN, CONTENT_SECURITY_POLICY, parseURL, siteURL, isLocalPage, cleanFilename, validateStore }
