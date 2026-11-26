import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const headerSource = readFileSync(resolve(dir, '../AppHeader.vue'), 'utf8')
// Public pages (home, key usage, plaza, legal) render doc links through the shared header and footer.
const publicHeaderSource = readFileSync(resolve(dir, '../PublicHeader.vue'), 'utf8')
const publicFooterSource = readFileSync(resolve(dir, '../PublicFooter.vue'), 'utf8')

describe('doc_url sanitization', () => {
  it('AppHeader imports sanitizeUrl', () => {
    expect(headerSource).toContain("import { sanitizeUrl } from '@/utils/url'")
  })

  it('AppHeader applies sanitizeUrl to docUrl', () => {
    expect(headerSource).toContain('sanitizeUrl(appStore.docUrl)')
  })

  it('PublicHeader imports sanitizeUrl', () => {
    expect(publicHeaderSource).toContain("import { sanitizeUrl } from '@/utils/url'")
  })

  it('PublicHeader applies sanitizeUrl to docUrl', () => {
    expect(publicHeaderSource).toContain('sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl')
  })

  it('PublicFooter imports sanitizeUrl', () => {
    expect(publicFooterSource).toContain("import { sanitizeUrl } from '@/utils/url'")
  })

  it('PublicFooter applies sanitizeUrl to docUrl', () => {
    expect(publicFooterSource).toContain('sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl')
  })
})
