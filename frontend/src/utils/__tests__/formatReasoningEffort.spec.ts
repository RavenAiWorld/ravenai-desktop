import { describe, expect, it } from 'vitest'
import {
  formatReasoningEffort,
  formatReasoningEffortMapping,
  reasoningEffortValuesEqual,
} from '@/utils/format'

describe('formatReasoningEffort', () => {
  it('title-cases known effort values', () => {
    expect(formatReasoningEffort('max')).toBe('Max')
    expect(formatReasoningEffort('x-high')).toBe('XHigh')
    expect(formatReasoningEffort('none')).toBe('None')
    expect(formatReasoningEffort(' Minimal ')).toBe('Minimal')
  })

  it('uses the empty label only for missing effort', () => {
    expect(formatReasoningEffort(null)).toBe('-')
    expect(formatReasoningEffort('  ', 'Not recorded')).toBe('Not recorded')
    expect(formatReasoningEffort('none', 'Not recorded')).toBe('None')
  })
})

describe('formatReasoningEffortMapping', () => {
  it('shows a single value when requested and forwarded match', () => {
    expect(formatReasoningEffortMapping('max', 'max')).toBe('Max')
    expect(formatReasoningEffortMapping(null, 'high')).toBe('High')
  })

  it('shows requested then forwarded when mapping changed the value', () => {
    expect(formatReasoningEffortMapping('max', 'xhigh')).toBe('Max → XHigh')
    expect(formatReasoningEffortMapping('high', 'medium')).toBe('High → Medium')
    expect(formatReasoningEffortMapping('none', 'minimal')).toBe('None → Minimal')
  })
})

describe('reasoningEffortValuesEqual', () => {
  it('treats x-high aliases as equal', () => {
    expect(reasoningEffortValuesEqual('x-high', 'xhigh')).toBe(true)
    expect(reasoningEffortValuesEqual('max', 'xhigh')).toBe(false)
  })
})
