import { describe, expect, it } from 'vitest'
import { decodeModelTrace } from '../../client/status/modelTrace'

const now = Date.parse('2026-11-26T09:00:00Z')
const id = '0123456789abcdef0123456789abcdef'
const iso = (delta: number) => new Date(now + delta).toISOString()
const report = { id, status: 'passed', completed_at: iso(-600000), expires_at: iso(600000), stages: [{ key: 'text', model: 'gpt-6-sol' }], image: { url: `/api/v1/model-trace/reports/${id}/stages/image` } }
const decode = (value: unknown) => decodeModelTrace({ server_time: iso(0), report: value, history: [] })
describe('native report parser preserves website boundaries', () => {
  it('accepts retained reports and only their own authenticated image paths', () => {
    expect(decode(report).report?.image?.url).toBe(report.image.url)
    expect(decode({ ...report, image: { url: 'https://evil.invalid/secret.png' } }).report?.image).toBeUndefined()
    expect(decode({ ...report, image: { url: '/api/v1/model-trace/reports/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/stages/image' } }).report?.image).toBeUndefined()
  })
  it('retains stale evidence but discards future, expired-retention and malformed reports', () => {
    expect(decode({ ...report, expires_at: iso(-60000) }).report).toBeDefined()
    expect(decode({ ...report, completed_at: iso(-86400000) }).report).toBeUndefined()
    expect(decode({ ...report, completed_at: iso(60000) }).report).toBeUndefined()
    expect(decode({ ...report, id: '../admin' }).report).toBeUndefined()
    expect(decode({ ...report, stages: [...report.stages, ...report.stages] }).report).toBeUndefined()
  })
  it('rejects executable or linked content and bounds report history', () => {
    expect(decode({ ...report, text: { question: '<script>alert(1)</script>', answer: 'https://evil.invalid', result_label: '正常' } }).report?.text).toEqual({ result_label: '正常' })
    const snapshot = decodeModelTrace({ server_time: iso(0), history: [report, report, { ...report, id: 'bad' }, { ...report, id: 'a'.repeat(32), completed_at: iso(-86400000) }] })
    expect(snapshot.history).toHaveLength(1)
    expect(() => decodeModelTrace({ server_time: 'yesterday' })).toThrow()
  })
})
