import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlazaFilters from '../PlazaFilters.vue'
import type { ModelPlazaGroup, PlazaModel } from '@/api/modelPlaza'

vi.mock('vue-i18n', async () => ({
  ...(await vi.importActual<typeof import('vue-i18n')>('vue-i18n')),
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}${JSON.stringify(params)}` : key),
    locale: { value: 'zh-CN' }
  })
}))

const M = 1e-6

function model(name: string, platform: string): PlazaModel {
  return {
    name,
    platform,
    pricing: {
      billing_mode: 'token',
      input_price: 2 * M,
      output_price: 10 * M,
      cache_write_price: null,
      cache_read_price: 0.2 * M,
      image_input_price: null,
      image_output_price: null,
      per_request_price: null,
      intervals: []
    },
    official_pricing: null
  }
}

function group(id: number, name: string, rate: number, overrides: Partial<ModelPlazaGroup> = {}): ModelPlazaGroup {
  return {
    id,
    name,
    description: '',
    platform: 'composite',
    subscription_type: 'standard',
    rate_multiplier: rate,
    peak_rate_enabled: false,
    peak_start: '',
    peak_end: '',
    peak_rate_multiplier: 1,
    is_exclusive: false,
    image_rate_independent: false,
    image_rate_multiplier: 1,
    video_rate_independent: false,
    video_rate_multiplier: 1,
    long_context_pricing_enabled: true,
    models: [],
    ...overrides
  }
}

function mountFilters(options: {
  groups: ModelPlazaGroup[]
  groupId?: number | null
  compact?: boolean
  open?: boolean
  active?: boolean
}) {
  return mount(PlazaFilters, {
    props: {
      groups: options.groups,
      groupId: options.groupId ?? null,
      vendorOptions: [
        { vendor: 'openai', count: 3, rates: [0.126] },
        { vendor: 'anthropic', count: 2, rates: [0.35] }
      ],
      totalCount: 5,
      visibleCount: 5,
      features: [],
      entries: [],
      active: options.active ?? false,
      compact: options.compact ?? false,
      open: options.open ?? false,
      vendor: 'all',
      selectedFeatures: [],
      billing: 'all'
    },
    attachTo: document.body,
    global: { stubs: { teleport: true } }
  })
}

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('PlazaFilters group brand icons', () => {
  const sampleGroups: ModelPlazaGroup[] = [
    group(1, 'GPT-【Pro 90+缓存 不降智】', 0.126, { platform: 'openai', models: [model('gpt-5.4', 'openai')] }),
    group(2, 'Grok-【Heavy 高缓高速】', 0.25, { platform: 'grok', models: [model('grok-4', 'grok')] }),
    group(3, 'Deepseek-【官转 高缓高速】', 0.26, { platform: 'deepseek', models: [model('deepseek-v4', 'deepseek')] }),
    group(4, 'Claude-【Kiro 满智商】', 0.35, { platform: 'anthropic', models: [model('claude-sonnet-4-5', 'anthropic')] }),
    group(5, 'Claude-【满血Pro自测】', 1.54, { platform: 'anthropic', status: 'maintenance' }),
    group(6, 'Kimi-【官转】', 0.4, { platform: 'kimi', models: [model('k3', 'kimi')] }),
    group(7, 'Gemini-【2.5 Pro】', 0.45, { platform: 'gemini', models: [model('gemini-2.5-pro', 'gemini')] }),
    group(8, 'Qwen-【Max】', 0.5, { platform: 'openai', models: [model('qwen3-max', 'openai')] }),
    group(9, 'OpenAI 兼容分组', 0.6, { platform: 'openai', models: [model('custom-model', 'openai')] }),
    group(10, '混合全模型', 0.7, {
      platform: 'composite',
      models: [model('gpt-5.4', 'openai'), model('claude-opus-4', 'anthropic')]
    }),
    group(11, 'Kiro 自测', 0.8, { platform: 'anthropic' }),
    group(12, 'Claude-【对标 GPT 满智商】', 0.9, { platform: 'anthropic' })
  ]

  it('renders local brand icons for known families and intentional neutral icons for all/unknown/mixed groups', () => {
    const wrapper = mountFilters({ groups: sampleGroups, groupId: 2, active: true })

    // All groups uses neutral grid icon in fixed-width tile with clean xs size classes
    const allBtn = wrapper.get('[data-testid=plaza-group-all]')
    const allIcon = allBtn.get('[data-group-icon="all"]')
    expect(allIcon.attributes('aria-hidden')).toBe('true')
    expect(allIcon.classes()).toEqual(expect.arrayContaining(['h-5', 'w-5', 'shrink-0']))
    const allSvg = allIcon.get('svg')
    expect(allSvg.classes()).toEqual(expect.arrayContaining(['h-3', 'w-3']))
    expect(allSvg.classes()).not.toContain('h-5')
    expect(allBtn.text()).toBe('modelPlaza.filters.allGroups')

    // Brand groups resolve to their public brand SVG icons
    const expectedKinds: Array<[number, string, boolean]> = [
      [1, 'openai', true],
      [2, 'xai', true],
      [3, 'deepseek', true],
      [4, 'anthropic', true],
      [5, 'anthropic', true],
      [6, 'moonshot', true],
      [7, 'google', true],
      [8, 'qwen', true],
      [9, 'neutral', false],
      [10, 'neutral', false],
      [11, 'neutral', false],
      [12, 'anthropic', true]
    ]

    for (const [id, kind, isBrand] of expectedKinds) {
      const btn = wrapper.get(`[data-testid=plaza-group-${id}]`)
      const icon = btn.get(`[data-group-icon="${kind}"]`)
      expect(icon.attributes('aria-hidden')).toBe('true')
      expect(icon.classes()).toEqual(expect.arrayContaining(['h-5', 'w-5', 'shrink-0']))
      expect(icon.find('svg').exists()).toBe(true)
      expect(icon.find('svg.model-icon').exists()).toBe(isBrand)
      expect(icon.find('.model-icon-fallback').exists()).toBe(false)
      if (!isBrand) {
        const neutralSvg = icon.get('svg')
        expect(neutralSvg.classes()).toEqual(expect.arrayContaining(['h-3', 'w-3']))
        expect(neutralSvg.classes()).not.toContain('h-5')
      }
    }

    // No external icon URLs or upstream platform leaks in markup
    expect(wrapper.findAll('img, image, use')).toHaveLength(0)
    expect(wrapper.html()).not.toMatch(/src=|href=|url\(/i)
    expect(wrapper.html()).not.toMatch(/antigravity|opencode_go|aihub/i)
    wrapper.unmount()
  })

  it('preserves group ordering, names, maintenance badge, multipliers, selection, and reset', async () => {
    const wrapper = mountFilters({ groups: sampleGroups, groupId: 2, active: true })

    const groupButtons = wrapper.findAll('[role="group"][aria-label="modelPlaza.group"] button')
    expect(groupButtons.map(b => b.attributes('data-testid'))).toEqual([
      'plaza-group-all',
      ...sampleGroups.map(g => `plaza-group-${g.id}`)
    ])

    // Selected state & labels/rates/maintenance badge
    expect(wrapper.get('[data-testid=plaza-group-2]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid=plaza-group-1]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('[data-testid=plaza-group-1]').text()).toContain('GPT-【Pro 90+缓存 不降智】')
    expect(wrapper.get('[data-testid=plaza-group-1]').text()).toContain('0.126×')
    expect(wrapper.get('[data-testid=plaza-group-5]').text()).toContain('common.groupMaintenance')
    expect(wrapper.get('[data-testid=plaza-group-5]').text()).toContain('1.54×')

    // Selection and reset events unchanged
    await wrapper.get('[data-testid=plaza-group-4]').trigger('click')
    await wrapper.get('[data-testid=plaza-group-all]').trigger('click')
    await wrapper.get('[data-testid=plaza-reset]').trigger('click')
    expect(wrapper.emitted('group')).toEqual([[4], [null]])
    expect(wrapper.emitted('reset')).toHaveLength(1)
    wrapper.unmount()
  })

  it('shares the same group icons and keyboard dialog behavior in compact mobile mode', async () => {
    const wrapper = mountFilters({
      groups: sampleGroups.slice(0, 4),
      groupId: 1,
      compact: true,
      open: false,
      active: true
    })

    await wrapper.setProps({ open: true })
    const panel = wrapper.get('[data-testid=plaza-filters]')
    expect(panel.classes()).toContain('is-mobile')
    expect(panel.attributes('role')).toBe('dialog')
    expect(panel.attributes('aria-modal')).toBe('true')
    expect(panel.get('[data-testid=plaza-group-1] [data-group-icon="openai"] svg.model-icon').exists()).toBe(true)
    expect(panel.get('[data-testid=plaza-group-4] [data-group-icon="anthropic"] svg.model-icon').exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })
})
