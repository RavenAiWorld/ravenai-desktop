import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ModelTraceView from '@/views/ModelTraceView.vue'
import { decodeModelTrace, getModelTraceImage } from '@/api/modelTrace'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: { get } }))
vi.mock('@/components/layout/AppLayout.vue', () => ({
  default: { template: '<main><slot /></main>' }
}))
vi.mock('@/components/common/BaseDialog.vue', () => ({
  default: {
    props: ['show', 'title'],
    emits: ['close'],
    template: '<div v-if="show" data-testid="lightbox" role="dialog"><h3>{{ title }}</h3><slot /></div>'
  }
}))
vi.mock('vue-i18n', async () => {
  const { ref } = await import('vue')
  return {
    useI18n: () => ({
      t: (key: string, params?: Record<string, string>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
      locale: ref('zh-CN')
    })
  }
})

const reportId = '0123456789abcdef0123456789abcdef'
const imagePath = `/api/v1/model-trace/reports/${reportId}/stages/image`
const stamp = '2026-11-25T13:20:00Z'
const baseReport = {
  id: reportId,
  status: 'passed',
  completed_at: '2026-11-25T13:19:58Z',
  expires_at: '2026-11-25T13:22:00Z',
  stages: [
    { key: 'detection', model: 'gpt-6.1-sol' },
    { key: 'text', model: 'gpt-6.1-sol', reasoning_effort: 'max' },
    { key: 'image', model: 'gpt-6-astra', reasoning_effort: 'medium' }
  ],
  text: {
    question: '在一个袋子里有三种口味的糖果。\n最少取出多少个？',
    answer: '21',
    passed: true
  },
  image: {
    url: imagePath,
    title: '可可铃铛骑在被囊动物上',
    generated_at: '2026-11-25T13:16:49Z'
  }
}

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  get.mockReset()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ModelTraceView', () => {
  it('renders just the Q&A and image, each labeled with its own stage model', async () => {
    const createURL = vi.fn(() => 'blob:https://ravenaiworld.org/img-1')
    const revokeURL = vi.fn()
    const prevCreate = URL.createObjectURL
    const prevRevoke = URL.revokeObjectURL
    URL.createObjectURL = createURL
    URL.revokeObjectURL = revokeURL
    try {
      get.mockImplementation(async (url: string) => {
        if (url === '/model-trace') return { data: { server_time: stamp, report: baseReport } }
        if (url === `/model-trace/reports/${reportId}/stages/image`) {
          return { data: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }) }
        }
        throw new Error(`unexpected request ${url}`)
      })

      wrapper = mount(ModelTraceView)
      await flushPromises()

      expect(wrapper.findAll('select')).toHaveLength(0)
      expect(wrapper.find('.trace-refresh').exists()).toBe(false)
      expect(wrapper.find('.trace-footnote').exists()).toBe(false)
      expect(wrapper.get('h1').text()).toBe('modelTrace.title')
      expect(wrapper.findAll('section h2').map(h => h.text())).toEqual(['modelTrace.textTest', 'modelTrace.imageTest'])
      expect(wrapper.find('.trace-verdict').exists()).toBe(false)
      expect(wrapper.get('.trace-result').text()).toBe('modelTrace.status.passed')
      expect(wrapper.text()).not.toContain('reasoningEffort')
      expect(wrapper.get('.trace-answer-block .trace-model-line code').text()).toBe('gpt-6.1-sol')
      expect(wrapper.get('.trace-image-body .trace-model-line code').text()).toBe('gpt-6-astra')
      expect(wrapper.get('.trace-question').text()).toContain('最少取出多少个？')
      expect(wrapper.get('.trace-answer').text()).toBe('21')
      expect(wrapper.get('.trace-answer').classes()).not.toContain('is-long')
      expect(wrapper.find('[data-testid="text-result-badge"]').exists()).toBe(false)
      expect(wrapper.get('.trace-image').attributes('src')).toBe('blob:https://ravenaiworld.org/img-1')
      expect(wrapper.get('.trace-image').attributes('loading')).toBe('lazy')
      expect(wrapper.get('.trace-image-caption').text()).toBe('可可铃铛骑在被囊动物上')

      // Clicking image opens in-site lightbox modal.
      await wrapper.get('.trace-image-trigger').trigger('click')
      expect(wrapper.get('[data-testid="lightbox"]').text()).toContain('可可铃铛骑在被囊动物上')
      expect(createURL).toHaveBeenCalledTimes(1)
      wrapper.unmount()
      wrapper = undefined
      expect(revokeURL).toHaveBeenCalledWith('blob:https://ravenaiworld.org/img-1')
    } finally {
      URL.createObjectURL = prevCreate
      URL.revokeObjectURL = prevRevoke
    }
  })

  it('shows only Q&A when no image exists and supports long questions and answers', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(320)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(160)
    const longQuestion = Array.from({ length: 16 }, (_, i) => `第 ${i + 1} 行题目内容`).join('\n')
    const longAnswer = 'A'.repeat(240)
    get.mockResolvedValue({
      data: {
        server_time: stamp,
        report: {
          ...baseReport,
          stages: [
            { key: 'detection', model: 'gpt-6.1-sol' },
            { key: 'text', model: 'gpt-6.1-sol', reasoning_effort: 'max' }
          ],
          text: { question: longQuestion, answer: longAnswer, result_label: '鹈鹕' },
          image: undefined
        }
      }
    })

    wrapper = mount(ModelTraceView)
    await flushPromises()

    expect(wrapper.findAll('section h2').map(h => h.text())).toEqual(['modelTrace.textTest'])
    expect(wrapper.find('[data-stage="image"]').exists()).toBe(false)
    expect(wrapper.find('.trace-image-body').exists()).toBe(false)
    expect(wrapper.find('[data-testid="text-result-badge"]').exists()).toBe(false)
    expect(wrapper.get('.trace-question').classes()).toContain('is-clamped')
    await wrapper.get('.trace-expand-btn').trigger('click')
    expect(wrapper.get('.trace-question').classes()).not.toContain('is-clamped')
    expect(wrapper.get('.trace-expand-btn').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.trace-answer').classes()).toContain('is-long')
  })

  it('never substitutes the detection model or a sibling model for a missing stage label', async () => {
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: {
      ...baseReport, stages: [
        { key: 'detection', model: 'other-model' },
        { key: 'image', model: 'an-image-model' }
      ]
    } } }).mockRejectedValueOnce(new Error('image unavailable'))
    wrapper = mount(ModelTraceView)
    await flushPromises()
    expect(wrapper.get('.trace-answer-block .trace-model-line').text()).toContain('modelTrace.modelUnspecified')
    expect(wrapper.get('.trace-image-body .trace-model-line code').text()).toBe('an-image-model')
    expect(wrapper.text()).not.toContain('other-model')
    wrapper.unmount()
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: { ...baseReport, stages: [] } } })
      .mockRejectedValueOnce(new Error('image unavailable'))
    wrapper = mount(ModelTraceView)
    await flushPromises()
    expect(wrapper.findAll('.trace-model-line code').map(n => n.text())).toEqual([
      'modelTrace.modelUnspecified', 'modelTrace.modelUnspecified'
    ])
  })

  it('rejects a report and history exactly at 24h and older, but keeps the last eligible millisecond', () => {
    const at = (offset: number) => new Date(Date.parse(stamp) - 86_400_000 + offset).toISOString()
    const record = (offset: number) => ({
      ...baseReport, id: (offset + 2).toString().repeat(32), completed_at: at(offset), expires_at: at(1000)
    })
    const history = [-1, 0, 1].map(record)
    for (const report of history) {
      const decoded = decodeModelTrace({ server_time: stamp, report, history })
      expect(decoded.history.map(h => h.id)).toEqual([history[2].id])
      expect(decoded.report?.id).toBe(report === history[2] ? report.id : undefined)
    }
  })

  it('drops the open report, its lightbox and its blob at 24h without polling', async () => {
    vi.useFakeTimers()
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const revoke = vi.fn()
    const priorCreate = URL.createObjectURL
    const priorRevoke = URL.revokeObjectURL
    URL.createObjectURL = () => 'blob:retained'
    URL.revokeObjectURL = revoke
    try {
      const report = { ...baseReport, completed_at: '2026-11-24T13:20:00.500Z', expires_at: '2026-11-24T14:20:00Z' }
      get.mockResolvedValueOnce({ data: { server_time: stamp, report, history: [report] } })
        .mockResolvedValueOnce({ data: new Blob(['png'], { type: 'image/png' }) })
      wrapper = mount(ModelTraceView)
      await flushPromises()
      await wrapper.get('.trace-image-trigger').trigger('click')
      clock.mockReturnValue(499)
      await vi.advanceTimersByTimeAsync(499)
      expect(wrapper.get('[role=dialog]').exists()).toBe(true)
      clock.mockReturnValue(500)
      await vi.advanceTimersByTimeAsync(1)
      expect(wrapper.find('[role=dialog]').exists()).toBe(false)
      expect(wrapper.findAll('section')).toHaveLength(0)
      expect(wrapper.text()).toContain('modelTrace.empty')
      expect(revoke).toHaveBeenCalledWith('blob:retained')
      expect(get).toHaveBeenCalledTimes(2)
    } finally {
      URL.createObjectURL = priorCreate
      URL.revokeObjectURL = priorRevoke
    }
  })

  it('prunes an expiring history row even when a newer report is selected', async () => {
    vi.useFakeTimers()
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const current = { ...baseReport, image: undefined }
    const older = { ...current, id: 'c'.repeat(32), completed_at: '2026-11-24T13:20:00.250Z' }
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: current, history: [current, older] } })
    wrapper = mount(ModelTraceView)
    await flushPromises()
    expect(wrapper.findAll('.trace-history-row')).toHaveLength(2)
    clock.mockReturnValue(250)
    await vi.advanceTimersByTimeAsync(250)
    expect(wrapper.findAll('.trace-history-row')).toHaveLength(1)
    expect(wrapper.get('.trace-answer').text()).toBe('21')
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('opens the newest retained work once when the selected report ages out', async () => {
    vi.useFakeTimers()
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const current = { ...baseReport, image: undefined }
    const older = { ...current, id: 'b'.repeat(32), completed_at: '2026-11-24T13:20:01Z',
      expires_at: '2026-11-24T14:20:00Z', text: { question: 'Old question', answer: 'Old answer' } }
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: older, history: [older, current] } })
      .mockResolvedValueOnce({ data: { server_time: '2026-11-25T13:20:01Z', report: current, history: [current] } })
    wrapper = mount(ModelTraceView)
    await flushPromises()
    expect(wrapper.get('.trace-answer').text()).toBe('Old answer')
    clock.mockReturnValue(1000)
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(wrapper.get('.trace-answer').text()).toBe('21')
    expect(wrapper.findAll('.trace-history-row')).toHaveLength(1)
    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenLastCalledWith('/model-trace/reports/' + current.id, expect.anything())
  })

  it('opens only an eligible history row if the initial detail is outside the window', async () => {
    const current = { ...baseReport, image: undefined }
    const older = { ...current, id: 'c'.repeat(32), completed_at: '2026-11-24T13:20:00Z', expires_at: '2026-11-24T14:00:00Z' }
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: older, history: [older, current] } })
      .mockResolvedValueOnce({ data: { server_time: stamp, report: current, history: [current] } })
    wrapper = mount(ModelTraceView)
    await flushPromises()
    expect(wrapper.get('.trace-answer').text()).toBe('21')
    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenLastCalledWith('/model-trace/reports/' + current.id, expect.anything())
  })

  it('does not resurrect a record when a slow history request crosses its retention deadline', async () => {
    vi.useFakeTimers()
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const current = { ...baseReport, image: undefined }
    const older = { ...current, id: 'c'.repeat(32), completed_at: '2026-11-24T13:20:00.010Z',
      expires_at: '2026-11-24T14:00:00Z', text: { question: 'Old question', answer: 'Old answer' } }
    const history = [older, current]
    const staleResponse = { data: { server_time: stamp, report: older, history } }
    let finish!: (value: typeof staleResponse) => void
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: current, history } })
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    wrapper = mount(ModelTraceView)
    await flushPromises()
    await wrapper.findAll('.trace-history-row')[1].trigger('click')
    clock.mockReturnValue(11)
    await vi.advanceTimersByTimeAsync(11)
    finish(staleResponse)
    await flushPromises()
    expect(wrapper.findAll('.trace-history-row')).toHaveLength(1)
    expect(wrapper.get('.trace-answer').text()).toBe('21')
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('shows unavailable fallback without broken img when image proxy fails', async () => {
    get.mockImplementation(async (url: string) => {
      if (url === '/model-trace') return { data: { server_time: stamp, report: baseReport } }
      throw new Error('503')
    })

    wrapper = mount(ModelTraceView)
    await flushPromises()

    expect(wrapper.find('.trace-image').exists()).toBe(false)
    expect(wrapper.get('.trace-image-fallback').text()).toBe('modelTrace.imageUnavailable')
  })

  it('adds later rounds on refresh without moving a reader off an older selection', async () => {
    vi.useFakeTimers()
    const mockReport = (key: string, minute: number) => ({
      ...baseReport, id: key.repeat(32), image: undefined, completed_at: new Date(Date.parse(stamp) - minute * 60_000).toISOString(),
      text: { question: key, answer: key }
    })
    const [a,b,c] = [mockReport('a',3),mockReport('b',2),mockReport('c',1)]
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: b, history: [a,b] } })
    wrapper = mount(ModelTraceView)
    await flushPromises()
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: a, history: [a,b] } })
    await wrapper.findAll('.trace-history-row')[1].trigger('click')
    await flushPromises()
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: c, history: [a,b,c] } })
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(wrapper.findAll('.trace-history-row')).toHaveLength(3)
    expect(wrapper.get('.trace-answer').text()).toBe('a')
    expect(wrapper.findAll('.trace-history-row')[2].attributes('aria-current')).toBe('true')
  })

  it('keeps the original result when evidence freshness ends, without an expiry message', async () => {
    vi.useFakeTimers()
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    get.mockResolvedValue({
      data: {
        server_time: stamp,
        report: { ...baseReport, expires_at: '2026-11-25T13:20:01Z', image: undefined }
      }
    })

    wrapper = mount(ModelTraceView)
    await flushPromises()
    expect(wrapper.text()).not.toContain('modelTrace.status.stale')

    clock.mockReturnValue(1100)
    await vi.advanceTimersByTimeAsync(1100)
    expect(wrapper.text()).not.toContain('modelTrace.status.stale')
    expect(wrapper.get('.trace-result').text()).toBe('modelTrace.status.passed')
  })

  it('renders times in Beijing time regardless of the browser zone', async () => {
    get.mockResolvedValue({ data: { server_time: stamp, report: { ...baseReport, image: undefined } } })
    wrapper = mount(ModelTraceView)
    await flushPromises()
    const expected = new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai'
    }).format(new Date(baseReport.completed_at))
    expect(wrapper.get('.trace-completed-at').text()).toContain(expected)
    expect(wrapper.get('.trace-completed-at').text()).toContain('modelTrace.timezone')
  })

  it('shows history on entry and updates the verdict when a previous round is selected', async () => {
    const older = { ...baseReport, id: 'b'.repeat(32), status: 'failed', completed_at: '2026-11-25T06:00:00Z', expires_at: '2026-11-25T12:00:00Z', image: undefined }
    get.mockResolvedValueOnce({
      data: {
        server_time: stamp,
        report: { ...baseReport, image: undefined },
        history: [
          { id: baseReport.id, status: 'passed', completed_at: baseReport.completed_at },
          { id: older.id, status: older.status, completed_at: older.completed_at }
        ]
      }
    })
    wrapper = mount(ModelTraceView, { attachTo: document.body })
    await flushPromises()
    const rows = wrapper.findAll('.trace-history-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('modelTrace.status.passed')
    expect(rows[1].text()).toContain('modelTrace.status.failed')
    expect(wrapper.get('.trace-history').isVisible()).toBe(true)
    expect(rows[0].classes()).toContain('is-current')
    expect(wrapper.find('select').exists()).toBe(false)

    get.mockResolvedValueOnce({
      data: {
        server_time: stamp,
        report: older,
        history: [
          { id: baseReport.id, status: 'passed', completed_at: baseReport.completed_at },
          { id: older.id, status: older.status, completed_at: older.completed_at }
        ]
      }
    })
    await rows[1].trigger('click')
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith('/model-trace/reports/' + older.id, expect.anything())
    expect(wrapper.findAll('.trace-history-row')[1].classes()).toContain('is-current')
    expect(wrapper.get('.trace-history').isVisible()).toBe(true)
    expect(wrapper.get('.trace-answer').text()).toBe(older.text.answer)
    expect(wrapper.get('.trace-result').text()).toBe('modelTrace.status.failed')
  })

  it('keeps the current work readable when a history switch fails and retry succeeds', async () => {
    const current = { ...baseReport, image: undefined }
    const older = { ...current, id: 'b'.repeat(32) }
    const history = [current, older]
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: current, history } })
    wrapper = mount(ModelTraceView)
    await flushPromises()
    get.mockRejectedValueOnce(new Error('503'))
    await wrapper.findAll('.trace-history-row')[1].trigger('click')
    await flushPromises()
    expect(wrapper.get('.trace-answer').text()).toBe('21')
    expect(wrapper.get('.trace-history [role=alert]').text()).toBe('modelTrace.error')
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: older, history } })
    await wrapper.findAll('.trace-history-row')[1].trigger('click')
    await flushPromises()
    expect(wrapper.find('[role=alert]').exists()).toBe(false)
    expect(wrapper.get('.trace-history').isVisible()).toBe(true)
  })

  it('shows the history block even with only one record', async () => {
    get.mockResolvedValue({
      data: { server_time: stamp, report: { ...baseReport, image: undefined },
        history: [{ id: baseReport.id, status: 'passed', completed_at: baseReport.completed_at }] }
    })
    wrapper = mount(ModelTraceView)
    await flushPromises()
    expect(wrapper.findAll('.trace-history-row')).toHaveLength(1)
    expect(wrapper.get('.trace-history-row').attributes('aria-current')).toBe('true')

  })

  it.each(['suspected', 'failed', 'stale'])('never relabels %s as passed', async status => {
    const report = { ...baseReport, status, image: undefined }
    get.mockResolvedValue({ data: { server_time: stamp, report, history: [report] } })
    wrapper = mount(ModelTraceView)
    await flushPromises()
    expect(wrapper.text()).not.toMatch(/modelTrace\.status\.(passed|stale)/)
    if (status !== 'stale') expect(wrapper.get('.trace-result').text()).toBe('modelTrace.status.' + status)
  })

  it('shows only the image when the text has no answer', async () => {
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: {
      ...baseReport, text: { question: 'Unanswered question', passed: true }
    } } }).mockRejectedValueOnce(new Error('image unavailable'))
    wrapper = mount(ModelTraceView)
    await flushPromises()
    expect(wrapper.findAll('section h2').map(h => h.text())).toEqual(['modelTrace.imageTest'])
    expect(wrapper.text()).not.toContain('Unanswered question')
  })

  it('shows an empty state for detection metadata without an answer or image payload', async () => {
    get.mockResolvedValueOnce({ data: { server_time: stamp, report: {
      ...baseReport, text: { passed: true }, image: { title: 'Caption only' }
    } } })
    wrapper = mount(ModelTraceView)
    await flushPromises()
    expect(wrapper.findAll('section')).toHaveLength(0)
    expect(wrapper.text()).toContain('modelTrace.empty')
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('shows empty state when report is absent and generic error when request fails', async () => {
    get.mockResolvedValueOnce({ data: { server_time: stamp } })
    wrapper = mount(ModelTraceView)
    await flushPromises()
    expect(wrapper.text()).toContain('modelTrace.empty')
    expect(wrapper.findAll('select')).toHaveLength(0)

    wrapper.unmount()
    get.mockRejectedValueOnce(new Error('CANARY_RAW_UPSTREAM_ERR_502_INTERNAL'))
    wrapper = mount(ModelTraceView)
    await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toBe('modelTrace.error')
    expect(wrapper.text()).not.toContain('CANARY')
  })

  it('rejects external image URLs, unsafe markup, and unknown upstream fields during decoding', async () => {
    const decoded = decodeModelTrace({
      server_time: stamp,
      groups: [{ id: 15, name: 'LEAK_GROUP' }],
      report: {
        ...baseReport,
        route_state: 'primary',
        snapshot_at: stamp,
        user_reason: 'Model verification passed.',
        stages: [
          { key: 'detection', model: 'gpt-6.1-sol', reasoning_effort: 'CANARY_EFFORT' }
        ],
        text: {
          question: '<script>alert(1)</script>',
          answer: 'https://aihub.top/leak',
          result_label: '<img src=x>',
          passed: true
        },
        image: {
          url: 'https://aihub.top/api/v1/public/model-detection-artifacts/abc',
          title: '可可铃铛骑在被囊动物上'
        }
      }
    })

    expect(decoded.report?.stages[0].reasoning_effort).toBeUndefined()
    expect(decoded.report?.text).toEqual({ passed: true })
    expect(decoded.report?.image).toEqual({ title: '可可铃铛骑在被囊动物上' })
    expect(JSON.stringify(decoded)).not.toMatch(/LEAK_GROUP|route_state|snapshot_at|user_reason|CANARY_EFFORT|aihub|script/)

    await expect(getModelTraceImage('https://evil.example/a.png')).rejects.toThrow()
    await expect(getModelTraceImage('/api/v1/model-trace/reports/not-hex/stages/image')).rejects.toThrow()
  })
})
