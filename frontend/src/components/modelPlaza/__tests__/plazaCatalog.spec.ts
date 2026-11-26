import { describe, expect, it } from 'vitest'
import type { ModelPlazaGroup, PlazaModel } from '@/api/modelPlaza'
import type { UserPricingInterval } from '@/api/channels'
import {
  availableFeatures,
  buildEntries,
  catalogModels,
  detectGroupVendor,
  detectVendor,
  entryEstimate,
  entryFeatures,
  estimateCost,
  filterEntries,
  formatContextSize,
  formatRates,
  formatTokenCount,
  formatUnitPrice,
  formatUsd,
  officialTokenTiers,
  paidRate,
  paidRequestPrices,
  paidTokenTiers,
  reasoningMultipliers,
  sortEntries,
  upstreamModelName,
  vendorSummaries,
  type TokenTier
} from '../plazaCatalog'

const M = 1e-6

function interval(min: number, max: number | null, input: number, output: number, cacheRead: number): UserPricingInterval {
  return {
    min_tokens: min,
    max_tokens: max,
    input_price: input * M,
    output_price: output * M,
    cache_write_price: null,
    cache_read_price: cacheRead * M,
    per_request_price: null
  }
}

function tokenModel(name: string, platform: string, input: number, output: number, extra: Partial<PlazaModel> = {}): PlazaModel {
  return {
    name,
    platform,
    pricing: {
      billing_mode: 'token',
      input_price: input * M,
      output_price: output * M,
      cache_write_price: null,
      cache_read_price: (input / 10) * M,
      image_input_price: null,
      image_output_price: null,
      per_request_price: null,
      intervals: []
    },
    official_pricing: null,
    ...extra
  }
}

function group(models: PlazaModel[], overrides: Partial<ModelPlazaGroup> = {}): ModelPlazaGroup {
  return {
    id: 8,
    name: 'All',
    description: '',
    platform: 'composite',
    subscription_type: 'standard',
    rate_multiplier: 0.2,
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
    models,
    ...overrides
  }
}

describe('detectVendor', () => {
  it('recognises vendors from model names, route prefixes and platforms', () => {
    expect(detectVendor('gpt-6-astra', 'openai')).toBe('openai')
    expect(detectVendor('codex-auto-review', 'openai')).toBe('openai')
    expect(detectVendor('oc-claude-haiku-5-5', 'opencode_go')).toBe('anthropic')
    expect(detectVendor('oc-deepseek-v4-pro', 'opencode_go')).toBe('deepseek')
    expect(detectVendor('oc-glm-5.3-flash', 'opencode_go')).toBe('zhipu')
    expect(detectVendor('oc-grok-4.7', 'opencode_go')).toBe('xai')
    expect(detectVendor('k3', 'kimi')).toBe('moonshot')
    expect(detectVendor('oc-gpt-6-luna', 'opencode_go')).toBe('openai')
    expect(detectVendor('mystery-model', 'gemini')).toBe('google')
    expect(detectVendor('mystery-model', 'opencode_go')).toBe('other')
  })

  it('names the upstream model only for OpenCode route IDs', () => {
    expect(upstreamModelName(tokenModel('oc-glm-5.3', 'opencode_go', 1, 1))).toBe('glm-5.3')
    expect(upstreamModelName(tokenModel('gpt-6-astra', 'openai', 1, 1))).toBe('')
  })

  it('keeps existing platform fallback semantics for slash-prefixed models in detectVendor, cards, and vendor filter', () => {
    expect(detectVendor('relay/gpt-synthetic', 'anthropic')).toBe('anthropic')
    expect(detectVendor('relay/gpt-synthetic', 'opencode_go')).toBe('other')

    const syntheticGroup = group([tokenModel('relay/gpt-synthetic', 'anthropic', 1, 2)], {
      name: 'Kiro 自测',
      platform: 'anthropic'
    })
    const syntheticEntries = buildEntries(syntheticGroup)
    expect(syntheticEntries[0].vendor).toBe('anthropic')
    expect(vendorSummaries(syntheticEntries)).toEqual([{ vendor: 'anthropic', count: 1, rates: [0.2] }])
    expect(detectGroupVendor(syntheticGroup)).toBe('other')
  })
})

describe('detectGroupVendor', () => {
  it('recognises public brand and model-family names while ignoring plan suffixes', () => {
    expect(detectGroupVendor(group([], { name: 'GPT-【Pro 90+缓存 不降智】', platform: 'openai' }))).toBe('openai')
    expect(detectGroupVendor(group([], { name: 'OpenAI-【官转直连】', platform: 'composite' }))).toBe('openai')
    expect(detectGroupVendor(group([], { name: 'GPT-【Fast 90+缓存 不降智】', platform: 'openai' }))).toBe('openai')
    expect(detectGroupVendor(group([], { name: 'GPT-【UltraFast 90+缓存 不降智】', platform: 'openai' }))).toBe('openai')
    expect(detectGroupVendor(group([], { name: 'Grok-【Heavy 高缓高速】', platform: 'grok' }))).toBe('xai')
    expect(detectGroupVendor(group([], { name: 'xAI-【高速专线】', platform: 'openai' }))).toBe('xai')
    expect(detectGroupVendor(group([], { name: 'Deepseek-【官转 高缓高速】', platform: 'deepseek' }))).toBe('deepseek')
    expect(detectGroupVendor(group([], { name: 'Claude-【Kiro 满智商】', platform: 'anthropic' }))).toBe('anthropic')
    expect(detectGroupVendor(group([], { name: 'Claude-【满血Pro自测】', platform: 'anthropic' }))).toBe('anthropic')
    expect(detectGroupVendor(group([], { name: 'Claude-【纯血Max 满血智商 超高缓存】', platform: 'anthropic' }))).toBe('anthropic')
    expect(detectGroupVendor(group([], { name: 'Anthropic-【企业直连】', platform: 'anthropic' }))).toBe('anthropic')
    expect(detectGroupVendor(group([], { name: 'Kimi-【Coding 官转】', platform: 'kimi' }))).toBe('moonshot')
    expect(detectGroupVendor(group([], { name: 'Gemini-【2.5 Pro】', platform: 'gemini' }))).toBe('google')
    expect(detectGroupVendor(group([], { name: 'Qwen-【Max 高缓】', platform: 'openai' }))).toBe('qwen')
    expect(detectGroupVendor(group([], { name: 'GLM-【官转】', platform: 'zhipu' }))).toBe('zhipu')
    expect(detectGroupVendor(group([], { name: 'MiniMax-【高速】', platform: 'minimax' }))).toBe('minimax')
  })

  it('prioritises the public brand prefix so brand words inside tier brackets do not create a second brand', () => {
    expect(detectGroupVendor(group([], { name: 'Claude-【对标 GPT 满智商】', platform: 'anthropic' }))).toBe('anthropic')
    expect(detectGroupVendor(group([], { name: 'DeepSeek-【媲美 Claude / GPT 官转】', platform: 'deepseek' }))).toBe('deepseek')
    expect(detectGroupVendor(group([], { name: 'GPT-【支持 Claude 客户端迁移】', platform: 'openai' }))).toBe('openai')
    expect(detectGroupVendor(group([], { name: 'Grok-【超越 Gemini / OpenAI】', platform: 'grok' }))).toBe('xai')
    expect(detectGroupVendor(group([], { name: '【官转】Claude-【含 GPT 风格提示】', platform: 'anthropic' }))).toBe('anthropic')
    expect(detectGroupVendor(group([], { name: 'GPT / Claude-【混合高缓】', platform: 'composite' }))).toBe('other')
  })

  it('ignores promotional or comparison brand mentions inside brackets and only accepts pure brand bracket titles', () => {
    expect(
      detectGroupVendor(group([tokenModel('grok-heavy', 'grok', 3, 15)], { name: '优选套餐-【对标 Claude】', platform: 'composite' }))
    ).toBe('xai')
    expect(
      detectGroupVendor(group([tokenModel('custom-v1', 'openai', 1, 2)], { name: '优选套餐-【对标 Claude】', platform: 'openai' }))
    ).toBe('other')
    expect(
      detectGroupVendor(group([tokenModel('grok-heavy', 'grok', 3, 15)], { name: '【对标 Claude】', platform: 'composite' }))
    ).toBe('xai')
    expect(
      detectGroupVendor(group([tokenModel('custom-v1', 'openai', 1, 2)], { name: '【对标 Claude】', platform: 'openai' }))
    ).toBe('other')
    expect(detectGroupVendor(group([], { name: '【Claude】', platform: 'anthropic' }))).toBe('anthropic')
    expect(detectGroupVendor(group([], { name: '【GPT】-【Pro 90+缓存】', platform: 'openai' }))).toBe('openai')
    expect(detectGroupVendor(group([tokenModel('gpt-5.4', 'openai', 2, 10)], { name: '【OpenAI 兼容】', platform: 'openai' }))).toBe('other')
  })

  it('does not misidentify OpenAI-compatible protocols as OpenAI brand', () => {
    expect(detectGroupVendor(group([], { name: 'OpenAI 兼容分组', platform: 'openai' }))).toBe('other')
    expect(detectGroupVendor(group([tokenModel('gpt-5.4', 'openai', 2, 10)], { name: 'OpenAI-compatible', platform: 'openai' }))).toBe('other')
    expect(detectGroupVendor(group([], { name: 'OpenAI 兼容-【GPT 可用】', platform: 'openai' }))).toBe('other')
    expect(detectGroupVendor(group([tokenModel('custom-model', 'openai', 1, 2)], { name: '兼容OpenAI协议', platform: 'openai' }))).toBe('other')
    expect(detectGroupVendor(group([tokenModel('custom-model', 'openai', 1, 2)], { name: '高速通道', platform: 'openai' }))).toBe('other')
    expect(detectGroupVendor(group([], { name: 'DeepSeek-【OpenAI 兼容】', platform: 'openai' }))).toBe('deepseek')
    expect(detectGroupVendor(group([], { name: 'Claude (OpenAI 兼容协议)', platform: 'openai' }))).toBe('anthropic')
    expect(detectGroupVendor(group([], { name: 'OpenAI/Anthropic 兼容', platform: 'composite' }))).toBe('other')
  })

  it('does not treat plan suffixes, upstream platforms, or first model in mixed groups as brands', () => {
    expect(detectGroupVendor(group([], { name: 'Kiro 满智商', platform: 'anthropic' }))).toBe('other')
    expect(detectGroupVendor(group([], { name: '满血Pro自测', platform: 'openai' }))).toBe('other')
    expect(detectGroupVendor(group([], { name: 'Antigravity 渠道', platform: 'antigravity' }))).toBe('other')
    expect(detectGroupVendor(group([], { name: 'OpenCode 专线', platform: 'opencode_go' }))).toBe('other')
    expect(detectGroupVendor(group([], { name: 'MaxAI 极速', platform: 'openai' }))).toBe('other')
    expect(
      detectGroupVendor(group([tokenModel('relay/gpt-synthetic', 'anthropic', 1, 2)], { name: '自测通道', platform: 'anthropic' }))
    ).toBe('other')

    const mixedModels = [
      tokenModel('gpt-6.1-sol', 'openai', 4, 20),
      tokenModel('claude-opus-5', 'anthropic', 5, 25)
    ]
    expect(detectGroupVendor(group(mixedModels, { name: 'Pro', platform: 'composite' }))).toBe('other')
    expect(detectGroupVendor(group(mixedModels, { name: 'Kiro 自测', platform: 'anthropic' }))).toBe('other')
    expect(
      detectGroupVendor(
        group([tokenModel('gpt-6.1-sol', 'openai', 4, 20), tokenModel('custom-model', 'openai', 1, 2)], {
          name: '高速池',
          platform: 'openai'
        })
      )
    ).toBe('other')
    expect(detectGroupVendor(group([tokenModel('gpt-6.1-sol', 'openai', 4, 20)], { name: 'All', platform: 'composite' }))).toBe('other')
    expect(detectGroupVendor(group([tokenModel('gpt-6.1-sol', 'openai', 4, 20)], { name: 'All (GPT-5)', platform: 'composite' }))).toBe('other')
    expect(detectGroupVendor(group([tokenModel('gpt-6.1-sol', 'openai', 4, 20)], { name: '综合分组', platform: 'composite' }))).toBe('other')
    expect(detectGroupVendor(group([], { name: 'GPT / Claude 混合', platform: 'composite' }))).toBe('other')
  })

  it('falls back to unanimous model-name brand only when every model matches the same brand', () => {
    expect(
      detectGroupVendor(
        group([tokenModel('gpt-6.1-sol', 'openai', 4, 20), tokenModel('gpt-6-astra', 'openai', 10, 50)], {
          name: 'Pro',
          platform: 'composite'
        })
      )
    ).toBe('openai')
    expect(
      detectGroupVendor(
        group([tokenModel('deepseek-v4-pro', 'openai', 1, 3), tokenModel('oc-deepseek-v4.1-flash', 'opencode_go', 1, 3)], {
          name: '官转低价池',
          platform: 'composite'
        })
      )
    ).toBe('deepseek')
  })
})

describe('buildEntries', () => {
  it('deduplicates routes using real group prices and keeps an unpriced model visible', () => {
    const standard = buildEntries(group([tokenModel('gpt-6-astra', 'openai', 10, 50), tokenModel('unpriced', 'openai', 0, 0, { pricing: null })]))
    const discounted = buildEntries(group([tokenModel('gpt-6-astra', 'openai', 10, 50)], { id: 9, rate_multiplier: 0.1 }))
    const catalog = catalogModels([...standard, ...discounted])
    expect(catalog).toHaveLength(2)
    expect(catalog[0].group.id).toBe(9)
    expect(catalog[1].model.name).toBe('unpriced')
    expect(standard[0].group.rate_multiplier).toBe(0.2)
  })
  it('exposes Astra Fast independently while preserving detail comparison', () => {
    const entries = buildEntries(
      group([
        tokenModel('gpt-6-astra', 'openai', 10, 50),
        tokenModel('gpt-6-astra-fast', 'openai', 20, 100, { service_tier: 'priority' }),
        tokenModel('oc-glm-5.3', 'opencode_go', 1.4, 4.4)
      ])
    )
    expect(entries.map((e) => [e.model.name, e.fast?.name ?? null, e.alwaysFast, e.vendor])).toEqual([
      ['gpt-6-astra', 'gpt-6-astra-fast', false, 'openai'],
      ['gpt-6-astra-fast', null, true, 'openai'],
      ['oc-glm-5.3', null, false, 'zhipu']
    ])
  })

  it('lists a same-price alias of an always-Fast model as an alias, not a Fast row', () => {
    const [entry] = buildEntries(
      group([
        tokenModel('gpt-5.6-sol', 'openai', 10, 60, { service_tier: 'priority' }),
        tokenModel('gpt-5.6-sol-fast', 'openai', 10, 60, { service_tier: 'priority' })
      ])
    )
    expect(entry.alwaysFast).toBe(true)
    expect(entry.fast).toBeNull()
    expect(entry.aliases).toEqual(['gpt-5.6-sol-fast'])
  })

  it('keeps a lone -fast alias as an always-Fast entry and borrows info from the alias', () => {
    const entries = buildEntries(
      group([tokenModel('gpt-6-sol-fast', 'openai', 4, 20, { info: { display_name: 'GPT-6-Sol' } })])
    )
    expect(entries).toHaveLength(1)
    expect(entries[0].alwaysFast).toBe(true)
    expect(entries[0].info?.display_name).toBe('GPT-6-Sol')
  })
})

describe('prices', () => {
  it('applies the group rate to every tier and sorts tiers by context size', () => {
    const model = tokenModel('gpt-6-astra', 'openai', 10, 50)
    model.pricing!.intervals = [interval(272_000, null, 20, 75, 2), interval(0, 272_000, 10, 50, 1)]
    const tiers = paidTokenTiers(model, 0.2)
    expect(tiers.map((t) => [t.label, formatUnitPrice(t.input, 'M'), formatUnitPrice(t.output, 'M'), formatUnitPrice(t.cacheRead, 'M')])).toEqual([
      ['≤272K', '$2.00', '$10.00', '$0.20'],
      ['>272K', '$4.00', '$15.00', '$0.40']
    ])
  })

  it('resolves tiers configured as multipliers of the base price', () => {
    const model = tokenModel('m', 'openai', 3, 15)
    model.pricing!.intervals = [
      { min_tokens: 0, max_tokens: 200_000, input_price: null, output_price: null, cache_write_price: null, cache_read_price: null, per_request_price: null },
      {
        min_tokens: 200_000,
        max_tokens: null,
        input_price: null,
        output_price: null,
        cache_write_price: null,
        cache_read_price: null,
        input_multiplier: 2,
        output_multiplier: 1.5,
        per_request_price: null
      }
    ]
    const [, high] = paidTokenTiers(model, 1)
    expect(formatUnitPrice(high.input, 'M')).toBe('$6.00')
    expect(formatUnitPrice(high.output, 'M')).toBe('$22.50')
  })

  it('uses independent image and video rates only when enabled', () => {
    const image: PlazaModel = {
      name: 'gpt-image-2',
      platform: 'openai',
      pricing: {
        billing_mode: 'image',
        input_price: null,
        output_price: null,
        cache_write_price: null,
        cache_read_price: null,
        image_input_price: null,
        image_output_price: 0.00004,
        per_request_price: 0.2,
        intervals: [
          { min_tokens: 0, max_tokens: null, tier_label: '1K', input_price: null, output_price: null, cache_write_price: null, cache_read_price: null, per_request_price: 0.2 }
        ]
      },
      official_pricing: null
    }
    expect(paidRate(image, group([]))).toBe(0.2)
    const independent = group([], { image_rate_independent: true, image_rate_multiplier: 0.5 })
    expect(paidRate(image, independent)).toBe(0.5)
    expect(paidRequestPrices(image, paidRate(image, independent))).toEqual([{ label: '1K', price: 0.1 }])
    expect(paidTokenTiers(image, 1)).toEqual([])

    const video = { ...image, pricing: { ...image.pricing!, billing_mode: 'video' as const } }
    expect(paidRate(video, group([], { video_rate_independent: true, video_rate_multiplier: -1 }))).toBe(0)
  })

  it('returns official tiers without the rate and nothing when the provider has no price', () => {
    const model = tokenModel('m', 'openai', 1, 1, {
      official_pricing: { input_price: 5 * M, output_price: 25 * M, cache_write_price: null, cache_read_price: 0.5 * M }
    })
    expect(officialTokenTiers(model).map((t) => formatUnitPrice(t.input, 'M'))).toEqual(['$5.00'])
    expect(officialTokenTiers(tokenModel('x', 'openai', 1, 1))).toEqual([])
  })

  it('lists configured reasoning multipliers in level order and drops invalid ones', () => {
    const model = tokenModel('m', 'openai', 1, 1)
    model.pricing!.reasoning_effort_multipliers = { max: 3, high: 1.5, low: 0, bogus: 9, xhigh: Number.NaN }
    expect(reasoningMultipliers(model)).toEqual([
      ['high', 1.5],
      ['max', 3]
    ])
  })
})

describe('estimateCost', () => {
  const tiers: TokenTier[] = [
    { minTokens: 0, maxTokens: 272_000, label: '≤272K', input: 2 * M, output: 10 * M, cacheRead: 0.2 * M, cacheWrite: null, cacheWrite1h: null },
    { minTokens: 272_000, maxTokens: null, label: '>272K', input: 4 * M, output: 15 * M, cacheRead: 0.4 * M, cacheWrite: null, cacheWrite1h: null }
  ]

  it('splits cached and uncached input and prices the whole request at its tier', () => {
    const low = estimateCost(tiers, { input: 80_000, cacheHit: 0.9, output: 2_000 })!
    expect(low.tier.label).toBe('≤272K')
    expect(low.uncachedCost).toBeCloseTo(8_000 * 2 * M)
    expect(low.cachedCost).toBeCloseTo(72_000 * 0.2 * M)
    expect(low.total).toBeCloseTo(0.016 + 0.0144 + 0.02)

    const high = estimateCost(tiers, { input: 300_000, cacheHit: 0, output: 1_000 })!
    expect(high.tier.label).toBe('>272K')
    expect(high.total).toBeCloseTo(300_000 * 4 * M + 1_000 * 15 * M)
  })

  it('keeps a request exactly at the threshold in the lower tier', () => {
    expect(estimateCost(tiers, { input: 272_000, cacheHit: 0, output: 0 })!.tier.label).toBe('≤272K')
  })

  it('prices only the tokens above the threshold at the higher tier for marginal billing', () => {
    const result = estimateCost(tiers, { input: 300_000, cacheHit: 0, output: 1_000 }, 'marginal')!
    expect(result.total).toBeCloseTo(272_000 * 2 * M + 28_000 * 4 * M + 1_000 * 10 * M)
  })

  it('falls back to the input price when no cache read price exists and returns null without prices', () => {
    const noCache = [{ ...tiers[0], cacheRead: null, maxTokens: null }]
    expect(estimateCost(noCache, { input: 1_000, cacheHit: 1, output: 0 })!.total).toBeCloseTo(1_000 * 2 * M)
    expect(estimateCost([], { input: 1, cacheHit: 0, output: 1 })).toBeNull()
  })

  it('estimates the Fast variant of an entry separately', () => {
    const [entry] = buildEntries(
      group([tokenModel('gpt-6-sol', 'openai', 2, 10), tokenModel('gpt-6-sol-fast', 'openai', 4, 20, { service_tier: 'priority' })])
    )
    const workload = { input: 10_000, cacheHit: 0, output: 1_000 }
    expect(entryEstimate(entry, workload)!.total).toBeCloseTo(0.2 * (10_000 * 2 * M + 1_000 * 10 * M))
    expect(entryEstimate(entry, workload, true)!.total).toBeCloseTo(0.2 * (10_000 * 4 * M + 1_000 * 20 * M))
  })
})

describe('features, filtering and sorting', () => {
  const flat = tokenModel('gpt-6.1-sol', 'openai', 4, 20, {
    long_context_note: 'subscription_flat',
    official_pricing: {
      input_price: 2 * M,
      output_price: 10 * M,
      cache_write_price: null,
      cache_read_price: 0.2 * M,
      intervals: [interval(0, 272_000, 2, 10, 0.2), interval(272_000, null, 4, 15, 0.4)]
    },
    info: { display_name: 'GPT-6.1-Sol', input_modalities: ['text', 'image'], reasoning: true }
  })
  const models = [
    flat,
    tokenModel('gpt-6.1-sol-fast', 'openai', 8, 40, { service_tier: 'priority' }),
    tokenModel('gpt-6-astra', 'openai', 10, 50, { info: { reasoning: true } }),
    tokenModel('oc-glm-5.3', 'opencode_go', 1.4, 4.4, { info: { display_name: 'GLM-5.3', reasoning: true } }),
    tokenModel('k3', 'kimi', 3, 15, { info: { input_modalities: ['text', 'image'], reasoning: true } })
  ]
  const entries = buildEntries(group(models))

  it('derives features and offers only the ones that split the list', () => {
    expect([...entryFeatures(entries[0])].sort()).toEqual(['fast', 'flatContext', 'reasoning', 'vision'])
    expect(availableFeatures(entries)).toEqual(['fast', 'vision', 'flatContext'])
  })

  it('filters by vendor, features and fuzzy query', () => {
    const ids = (list: typeof entries) => list.map((e) => e.model.name)
    expect(ids(filterEntries(entries, { query: '', vendor: 'zhipu', features: [] }))).toEqual(['oc-glm-5.3'])
    expect(ids(filterEntries(entries, { query: '', vendor: 'all', features: ['vision'] }))).toEqual(['gpt-6.1-sol', 'gpt-6.1-sol-fast', 'k3'])
    expect(ids(filterEntries(entries, { query: 'gpt61sol', vendor: 'all', features: [] }))).toEqual(['gpt-6.1-sol', 'gpt-6.1-sol-fast'])
    expect(ids(filterEntries(entries, { query: 'sol-fast', vendor: 'all', features: [] }))).toEqual(['gpt-6.1-sol-fast'])
    expect(ids(filterEntries(entries, { query: 'GLM-5.3', vendor: 'all', features: [] }))).toEqual(['oc-glm-5.3'])
    expect(ids(filterEntries(entries, { query: 'kimi', vendor: 'all', features: [] }))).toEqual(['k3'])
  })

  it('sorts by vendor then newest version, or by price and estimate', () => {
    const workload = { input: 10_000, cacheHit: 0, output: 1_000 }
    const ids = (key: Parameters<typeof sortEntries>[1]) => sortEntries(entries, key, workload).map((e) => e.model.name)
    expect(ids('recommended')).toEqual(['gpt-6.1-sol-fast', 'gpt-6.1-sol', 'gpt-6-astra', 'oc-glm-5.3', 'k3'])
    expect(ids('input')).toEqual(['oc-glm-5.3', 'k3', 'gpt-6.1-sol', 'gpt-6.1-sol-fast', 'gpt-6-astra'])
    expect(ids('output')).toEqual(['oc-glm-5.3', 'k3', 'gpt-6.1-sol', 'gpt-6.1-sol-fast', 'gpt-6-astra'])
    expect(ids('estimate')).toEqual(['oc-glm-5.3', 'k3', 'gpt-6.1-sol', 'gpt-6.1-sol-fast', 'gpt-6-astra'])
    expect(ids('name').slice(3)).toEqual(['k3', 'oc-glm-5.3'])
  })

  it('summarises each vendor with its model count and billing rate', () => {
    expect(vendorSummaries(entries)).toEqual([
      { vendor: 'openai', count: 3, rates: [0.2] },
      { vendor: 'zhipu', count: 1, rates: [0.2] },
      { vendor: 'moonshot', count: 1, rates: [0.2] }
    ])
    const image = tokenModel('gpt-image-2', 'openai', 1, 1)
    image.pricing!.billing_mode = 'image'
    const mixed = buildEntries(group([tokenModel('gpt-6-sol', 'openai', 2, 10), image], { image_rate_independent: true, image_rate_multiplier: 0.5 }))
    const [openai] = vendorSummaries(mixed)
    expect(openai.rates).toEqual([0.2, 0.5])
    expect(formatRates(openai.rates)).toBe('0.2–0.5×')
    expect(formatRates([0.2])).toBe('0.2×')
    expect(formatRates([])).toBe('')
  })
})

describe('formatting', () => {
  it('formats dollars with at least two decimals and four significant digits below one dollar', () => {
    expect(formatUsd(4)).toBe('$4.00')
    expect(formatUsd(12.5)).toBe('$12.50')
    expect(formatUsd(0.8000000000000002)).toBe('$0.80')
    expect(formatUsd(0.0015)).toBe('$0.0015')
    expect(formatUsd(0.0012345678)).toBe('$0.001235')
    expect(formatUsd(1.5e-7)).toBe('$0.00000015')
    expect(formatUsd(0)).toBe('$0')
    expect(formatUsd(null)).toBe('—')
    expect(formatUnitPrice(2e-6, 'K')).toBe('$0.002')
  })

  it('formats token counts and context windows', () => {
    expect(formatTokenCount(272_000)).toBe('272K')
    expect(formatTokenCount(1_050_000)).toBe('1.05M')
    expect(formatContextSize(128_000)).toBe('128K')
    expect(formatContextSize(131_072)).toBe('128K')
    expect(formatContextSize(393_216)).toBe('384K')
    expect(formatContextSize(1_048_576)).toBe('1M')
    expect(formatContextSize(872_000)).toBe('872K')
  })
})
