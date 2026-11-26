import { describe, expect, it } from 'vitest'
import { csv, queryPath } from '../../client/native'
describe('user exports and filters', () => {
  it('escapes quotes, preserves newlines, and prevents spreadsheet formula execution', () => {
    expect(csv([['=HYPERLINK("x")', 'normal', 'a\nb'], ['+1', '-2', '@cmd']])).toBe('"\'=HYPERLINK(""x"")","normal","a\nb"\r\n"\'+1","\'-2","\'@cmd"')
  })
  it('encodes model filters as data rather than an API path', () => {
    const path = queryPath('/usage', { model: 'x&admin=1/#', page: 2, unused: undefined })
    const parsed = new URL(path, 'https://example.invalid')
    expect(parsed.pathname).toBe('/usage'); expect(parsed.searchParams.get('model')).toBe('x&admin=1/#'); expect(parsed.searchParams.has('admin')).toBe(false)
  })
})
