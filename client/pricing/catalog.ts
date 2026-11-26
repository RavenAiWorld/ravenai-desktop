/**
 * 模型广场的数据逻辑（纯函数，组件只负责渲染）：
 * - 按厂商整理展示条目；Sol/Astra Fast 独立展示，详情保留版本对比；
 * - 换算实付价（渠道单价 × 实付倍率）、上下文档位与官方参考价；
 * - 按使用场景估算单次请求费用，并提供排序与筛选。
 */
import type {
  ModelPlazaGroup,
  PlazaLongContextBasis,
  PlazaModel,
  PlazaModelInfo
} from './modelPlaza'
import type { UserPricingInterval } from './channels'
import {
  BILLING_MODE_IMAGE,
  BILLING_MODE_TOKEN,
  BILLING_MODE_VIDEO,
  REASONING_EFFORT_LEVELS,
  type BillingMode
} from './channel'
import { resolveIntervalPrices } from './pricing'

/** Also hide admin-labelled groups in stale responses from an older server. */
export function isPlazaGroupVisible(group: ModelPlazaGroup): boolean {
  return !/(^|[^a-z])admin(istrator)?($|[^a-z])|管理员|管理专用/i.test(group.name)
}

// ── 厂商 ────────────────────────────────────────────────────────────

export type VendorId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'zhipu'
  | 'xai'
  | 'moonshot'
  | 'qwen'
  | 'minimax'
  | 'other'

export interface VendorMeta {
  id: VendorId
  /** 品牌名不随语言变化；other 的名称由组件按语言显示。 */
  label: string
  /** 交给 ModelIcon 识别品牌图标的代表模型名。 */
  iconModel: string
}

/** 展示顺序即数组顺序。 */
export const VENDORS: readonly VendorMeta[] = [
  { id: 'openai', label: 'OpenAI', iconModel: 'gpt' },
  { id: 'anthropic', label: 'Claude', iconModel: 'claude' },
  { id: 'google', label: 'Gemini', iconModel: 'gemini' },
  { id: 'deepseek', label: 'DeepSeek', iconModel: 'deepseek' },
  { id: 'zhipu', label: 'GLM', iconModel: 'glm' },
  { id: 'xai', label: 'Grok', iconModel: 'grok' },
  { id: 'moonshot', label: 'Kimi', iconModel: 'kimi' },
  { id: 'qwen', label: 'Qwen', iconModel: 'qwen' },
  { id: 'minimax', label: 'MiniMax', iconModel: 'minimax' },
  { id: 'other', label: '', iconModel: '' }
]

const VENDOR_BY_ID = new Map(VENDORS.map((v, index) => [v.id, { ...v, index }]))

export function vendorMeta(id: VendorId): VendorMeta {
  return VENDOR_BY_ID.get(id) ?? VENDOR_BY_ID.get('other')!
}

const VENDOR_PATTERNS: ReadonlyArray<[VendorId, RegExp]> = [
  ['anthropic', /claude/],
  ['google', /gemini|gemma|imagen|veo-/],
  ['deepseek', /deepseek/],
  ['zhipu', /(^|[^a-z])glm|cogview|cogvideo/],
  ['xai', /grok/],
  ['moonshot', /kimi|moonshot|^k\d/],
  ['qwen', /qwen|qwq/],
  ['minimax', /minimax|abab/],
  ['openai', /^(gpt|o\d|codex|chatgpt|dall-e|sora|whisper|tts-|text-embedding)/]
]

const PLATFORM_VENDORS: Readonly<Record<string, VendorId>> = {
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'google',
  antigravity: 'google',
  grok: 'xai',
  kimi: 'moonshot',
  zhipu: 'zhipu',
  deepseek: 'deepseek',
  minimax: 'minimax'
}

/** 线路前缀（如 OpenCode 的 oc-）不改变模型归属，识别厂商时去掉再试一次。 */
const ROUTE_PREFIX = /^[a-z]{2}-/

/** 按模型名识别厂商，识别不了再看账号平台。 */
export function detectVendor(name: string, platform: string): VendorId {
  const lower = name.trim().toLowerCase()
  for (const candidate of [lower, lower.replace(ROUTE_PREFIX, '')]) {
    for (const [vendor, pattern] of VENDOR_PATTERNS) {
      if (pattern.test(candidate)) return vendor
    }
  }
  return PLATFORM_VENDORS[platform] ?? 'other'
}

const PROTOCOL_BRAND = '(?:openai|anthropic|claude|gemini|google)'
const PROTOCOL_LIST = `${PROTOCOL_BRAND}(?:\\s*[/,&+、]\\s*${PROTOCOL_BRAND})*`
const PROTOCOL_QUALIFIER = '(?:compat(?:ible)?|protocol|format|spec|兼容|协议|格式|接口)'

const GROUP_PROTOCOL_PATTERNS: readonly RegExp[] = [
  new RegExp(`(^|[^a-z])${PROTOCOL_LIST}(?:\\s*api)?[\\s_/-]*${PROTOCOL_QUALIFIER}(?=$|[^a-z])`, 'gi'),
  new RegExp(
    `(^|[^a-z])(?:compat(?:ible)?(?:\\s+with)?|兼容)[\\s_/-]*${PROTOCOL_LIST}(?:\\s*api)?(?:[\\s_/-]*${PROTOCOL_QUALIFIER})?(?=$|[^a-z])`,
    'gi'
  )
]

const GROUP_BRACKET_START = /[【（([]/
const GROUP_BRACKET_SEGMENT = /【[^】]*】|（[^）]*）|\([^)]*\)|\[[^\]]*\]/g
const GROUP_LEADING_BRACKET = /^(?:【([^】]*)】|（([^）]*)）|\(([^)]*)\)|\[([^\]]*)\])/

const GROUP_NEUTRAL_NAME_PATTERN =
  /(^|[^a-z])(all|mixed|composite|multi-?vendor|multi-?model|universal)(?=$|[^a-z])|混合|综合|聚合|全模型|多模型|全部|所有|通用/i

const GROUP_BRAND_PATTERNS: ReadonlyArray<[Exclude<VendorId, 'other'>, RegExp]> = [
  ['anthropic', /(^|[^a-z])(claude|anthropic)(?=$|[^a-z])/i],
  ['google', /(^|[^a-z])(gemini|gemma|imagen|veo|google)(?=$|[^a-z])/i],
  ['deepseek', /(^|[^a-z])deep[\s-]*seek(?=$|[^a-z])|深度求索/i],
  ['zhipu', /(^|[^a-z])(glm|chatglm|zhipu)(?=$|[^a-z])|智谱/i],
  ['xai', /(^|[^a-z])grok(?=$|[^a-z])|(^|[^a-z0-9])x\.?ai(?=$|[^a-z])/i],
  ['moonshot', /(^|[^a-z])(kimi|moonshot)(?=$|[^a-z])|月之暗面/i],
  ['qwen', /(^|[^a-z])(qwen|qwq)(?=$|[^a-z])|千问/i],
  ['minimax', /(^|[^a-z])minimax(?=$|[^a-z])/i],
  ['openai', /(^|[^a-z])(gpt|openai|chatgpt|codex|dall-e|sora)(?=$|[^a-z])/i]
]

const GROUP_PURE_BRAND_TITLE: ReadonlyArray<[Exclude<VendorId, 'other'>, RegExp]> = [
  ['anthropic', /^(?:claude|anthropic)$/i],
  ['google', /^(?:gemini|gemma|imagen|veo|google)$/i],
  ['deepseek', /^deep[\s-]*seek$|^深度求索$/i],
  ['zhipu', /^(?:glm|chatglm|zhipu|智谱)$/i],
  ['xai', /^(?:grok|x\.?ai)$/i],
  ['moonshot', /^(?:kimi|moonshot|月之暗面)$/i],
  ['qwen', /^(?:qwen|qwq|千问|通义千问)$/i],
  ['minimax', /^minimax$/i],
  ['openai', /^(?:gpt|openai|chatgpt|codex|dall-e|sora)$/i]
]

/** 仅用于分组归属判断的模型名识别（不回落到 platform，也不影响卡片/厂商筛选用的 detectVendor）。 */
function detectGroupModelVendor(name: string): VendorId {
  const lower = name.trim().toLowerCase()
  for (const candidate of [lower, lower.replace(ROUTE_PREFIX, '')]) {
    for (const [vendor, pattern] of VENDOR_PATTERNS) {
      if (pattern.test(candidate)) return vendor
    }
  }
  return 'other'
}

type GroupNameMatch =
  | { kind: 'brand'; vendor: Exclude<VendorId, 'other'> }
  | { kind: 'neutral' }
  | { kind: 'none' }

function matchGroupNameSegment(segment: string): GroupNameMatch {
  const trimmed = segment.trim()
  if (!trimmed) return { kind: 'none' }

  let cleaned = trimmed
  for (const pattern of GROUP_PROTOCOL_PATTERNS) {
    cleaned = cleaned.replace(pattern, '$1 ')
  }
  const hadProtocolPhrase = cleaned !== trimmed

  const matched = new Set<Exclude<VendorId, 'other'>>()
  for (const [vendor, pattern] of GROUP_BRAND_PATTERNS) {
    if (pattern.test(cleaned)) matched.add(vendor)
  }
  if (matched.size > 1) return { kind: 'neutral' }
  if (matched.size === 1) return { kind: 'brand', vendor: [...matched][0] }
  if (hadProtocolPhrase || GROUP_NEUTRAL_NAME_PATTERN.test(cleaned)) return { kind: 'neutral' }
  return { kind: 'none' }
}

/**
 * 识别分组对应的公开品牌/模型族，供模型广场分组筛选按钮展示品牌图标：
 * - 优先从分组公开品牌前缀（括号套餐说明之前 / 之外）识别，绝不把括号内促销或对标文案当品牌；
 * - 仅当括号外无标题且首个括号本身为纯品牌标题（如「【Claude】」）时采信该标题；
 * - 忽略 OpenAI/Anthropic 等协议兼容描述，也不使用分组/账号 platform 字段；
 * - 名称未指明品牌且非通用/混合命名时，仅当组内全部模型按模型名一致归属同一品牌才采信，
 *   绝不按首个模型推断，也不把 Kiro/自测等套餐后缀当品牌；未知或混合返回 'other'。
 */
export function detectGroupVendor(group: Pick<ModelPlazaGroup, 'name' | 'models'>): VendorId {
  const name = group.name.trim()
  const bracketIndex = name.search(GROUP_BRACKET_START)
  const leadPrefix = bracketIndex >= 0 ? name.slice(0, bracketIndex) : name
  const outerName = bracketIndex >= 0 ? name.replace(GROUP_BRACKET_SEGMENT, ' ') : name

  for (const segment of [leadPrefix, outerName]) {
    const result = matchGroupNameSegment(segment)
    if (result.kind === 'brand') return result.vendor
    if (result.kind === 'neutral') return 'other'
  }

  if (bracketIndex === 0 && !outerName.replace(/[\s\-_/|·•:,，。]+/g, '')) {
    const match = name.match(GROUP_LEADING_BRACKET)
    const inner = (match?.[1] ?? match?.[2] ?? match?.[3] ?? match?.[4] ?? '').trim()
    if (matchGroupNameSegment(inner).kind === 'neutral') return 'other'
    for (const [vendor, pattern] of GROUP_PURE_BRAND_TITLE) {
      if (pattern.test(inner)) return vendor
    }
  }

  if (group.models.length === 0) return 'other'
  let unanimous: Exclude<VendorId, 'other'> | null = null
  for (const model of group.models) {
    const vendor = detectGroupModelVendor(model.name)
    if (vendor === 'other') return 'other'
    if (unanimous === null) unanimous = vendor
    else if (unanimous !== vendor) return 'other'
  }
  return unanimous ?? 'other'
}

/** OpenCode 线路的 oc- 模型对应的上游模型名；其他模型返回空串。 */
export function upstreamModelName(model: PlazaModel): string {
  if (model.platform !== 'opencode_go' || !model.name.startsWith('oc-')) return ''
  return model.name.slice(3)
}

// ── 计费模式与倍率 ──────────────────────────────────────────────────

export function billingMode(model: PlazaModel): BillingMode {
  return (model.pricing?.billing_mode || BILLING_MODE_TOKEN) as BillingMode
}

export function isTokenBilled(model: PlazaModel): boolean {
  return billingMode(model) === BILLING_MODE_TOKEN
}

/** 实付倍率：默认取分组倍率；图片、视频在独立倍率开启时各取自己的倍率（与扣费一致）。 */
export function paidRate(model: PlazaModel, group: ModelPlazaGroup): number {
  const mode = billingMode(model)
  if (mode === BILLING_MODE_IMAGE && group.image_rate_independent) {
    return group.image_rate_multiplier ?? 1
  }
  if (mode === BILLING_MODE_VIDEO && group.video_rate_independent) {
    return Math.max(0, group.video_rate_multiplier ?? 1)
  }
  return group.rate_multiplier
}

/** 去掉浮点噪声的倍率乘积，用于展示叠加后的倍率。 */
export function combineRates(...rates: number[]): number {
  return Math.round(rates.reduce((acc, r) => acc * r, 1) * 1000) / 1000
}

// ── token 档位 ─────────────────────────────────────────────────────

/** 一个上下文档位的单价（USD / token）。单档模型只有一档，label 为空。 */
export interface TokenTier {
  /** 档位下限（不含）。 */
  minTokens: number
  /** 档位上限（含）；末档为 null。 */
  maxTokens: number | null
  label: string
  input: number | null
  output: number | null
  cacheRead: number | null
  cacheWrite: number | null
  cacheWrite1h: number | null
}

/** 详情价格表的一行：某个版本（标准 / Fast）在某个上下文档位的单价。 */
export interface PriceTierRow {
  key: string
  /** 版本名；条目只有一个版本且不是固定 Fast 时为空串。 */
  variant: string
  fast: boolean
  tierLabel: string
  tier: TokenTier
}

function scaled(value: number | null | undefined, rate: number): number | null {
  return value == null ? null : value * rate
}

/** 档位标签：优先后端给出的 tier_label，否则有上限为「≤上限」、末档为「>下限」。 */
export function tierLabel(iv: Pick<UserPricingInterval, 'tier_label' | 'min_tokens' | 'max_tokens'>): string {
  if (iv.tier_label) return iv.tier_label
  return iv.max_tokens == null ? `>${formatTokenCount(iv.min_tokens)}` : `≤${formatTokenCount(iv.max_tokens)}`
}

function tiersFromIntervals(intervals: UserPricingInterval[], rate: number): TokenTier[] {
  return [...intervals]
    .sort((a, b) => a.min_tokens - b.min_tokens)
    .map((iv) => ({
      minTokens: iv.min_tokens,
      maxTokens: iv.max_tokens,
      label: tierLabel(iv),
      input: scaled(iv.input_price, rate),
      output: scaled(iv.output_price, rate),
      cacheRead: scaled(iv.cache_read_price, rate),
      cacheWrite: scaled(iv.cache_write_price, rate),
      cacheWrite1h: scaled(iv.cache_write_1h_price, rate)
    }))
}

/** 实付档位：渠道单价 × rate。阶梯中只配了相对倍率的档位按基础价换算成绝对价。 */
export function paidTokenTiers(model: PlazaModel, rate: number): TokenTier[] {
  const p = model.pricing
  if (!p || !isTokenBilled(model)) return []
  const intervals = p.intervals ?? []
  if (intervals.length > 0) {
    return tiersFromIntervals(intervals.map((iv) => resolveIntervalPrices(iv, p)), rate)
  }
  return [
    {
      minTokens: 0,
      maxTokens: null,
      label: '',
      input: scaled(p.input_price, rate),
      output: scaled(p.output_price, rate),
      cacheRead: scaled(p.cache_read_price, rate),
      cacheWrite: scaled(p.cache_write_price, rate),
      cacheWrite1h: scaled(p.cache_write_1h_price, rate)
    }
  ]
}

/** 官方参考价档位（不乘倍率）。 */
export function officialTokenTiers(model: PlazaModel): TokenTier[] {
  const o = model.official_pricing
  if (!o) return []
  if (o.intervals && o.intervals.length > 0) return tiersFromIntervals(o.intervals, 1)
  if (o.input_price == null && o.output_price == null && o.cache_read_price == null && o.cache_write_price == null) {
    return []
  }
  return [
    {
      minTokens: 0,
      maxTokens: null,
      label: '',
      input: o.input_price,
      output: o.output_price,
      cacheRead: o.cache_read_price,
      cacheWrite: o.cache_write_price,
      cacheWrite1h: o.cache_write_1h_price ?? null
    }
  ]
}

function sameNumber(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return a === b
  return Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-9
}

function sameTiers(a: TokenTier[], b: TokenTier[]): boolean {
  return (
    a.length === b.length &&
    a.every((t, i) => {
      const u = b[i]
      return (
        t.minTokens === u.minTokens &&
        t.maxTokens === u.maxTokens &&
        sameNumber(t.input, u.input) &&
        sameNumber(t.output, u.output) &&
        sameNumber(t.cacheRead, u.cacheRead) &&
        sameNumber(t.cacheWrite, u.cacheWrite)
      )
    })
  )
}

/** 按次 / 按图片 / 按视频计费模型的实付单价（已乘倍率）。 */
export interface RequestPrice {
  label: string
  price: number
}

export function paidRequestPrices(model: PlazaModel, rate: number): RequestPrice[] {
  const p = model.pricing
  if (!p || isTokenBilled(model)) return []
  const tiers = (p.intervals ?? [])
    .filter((iv) => iv.per_request_price != null)
    .map((iv) => ({ label: iv.tier_label || '', price: (iv.per_request_price as number) * rate }))
  if (tiers.length > 0) return tiers
  return p.per_request_price != null ? [{ label: '', price: p.per_request_price * rate }] : []
}

/** 已配置且有效的思考等级倍率，按等级从低到高。 */
export function reasoningMultipliers(model: PlazaModel): Array<[string, number]> {
  const multipliers = model.pricing?.reasoning_effort_multipliers
  return REASONING_EFFORT_LEVELS.flatMap((effort) => {
    const value = multipliers?.[effort]
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? [[effort, value] as [string, number]] : []
  })
}

// ── 展示条目 ────────────────────────────────────────────────────────

const FAST_SUFFIX = '-fast'
const STANDALONE_FAST_MODELS = new Set(['gpt-6.1-sol-fast', 'gpt-6.1-terra-fast', 'gpt-6-astra-fast'])

export interface PlazaEntry {
  key: string
  group: ModelPlazaGroup
  vendor: VendorId
  /** 主模型：有标准版取标准版，否则为 Fast 别名本身。 */
  model: PlazaModel
  /** 与主模型配对、价格不同的 Fast 别名。 */
  fast: PlazaModel | null
  /** 主模型本身就按 Fast 计费（强制 Fast，或只开放了 -fast 别名）。 */
  alwaysFast: boolean
  /** 与主模型同价的别名，只在详情中列出。 */
  aliases: string[]
  info: PlazaModelInfo | null
}

/**
 * Sol/Terra/Astra Fast 保留独立入口；其他 openai 的 `<id>-fast` 与 `<id>` 合并展示。
 * 主模型已强制 Fast 且别名同价时，别名只作为同价别名列出。
 */
export function buildEntries(group: ModelPlazaGroup): PlazaEntry[] {
  const byKey = new Map(group.models.map((m) => [`${m.platform}:${m.name.toLowerCase()}`, m]))
  const entries: PlazaEntry[] = []
  for (const model of group.models) {
    const lower = model.name.toLowerCase()
    if (model.platform === 'openai' && lower.endsWith(FAST_SUFFIX) && !STANDALONE_FAST_MODELS.has(lower)) {
      if (byKey.has(`${model.platform}:${lower.slice(0, -FAST_SUFFIX.length)}`)) continue
    }
    const alias = model.platform === 'openai' ? byKey.get(`${model.platform}:${lower}${FAST_SUFFIX}`) ?? null : null
    const standaloneFast = model.platform === 'openai' && lower.endsWith(FAST_SUFFIX)
    const alwaysFast = model.service_tier === 'priority' || standaloneFast
    const duplicate =
      alias != null &&
      alwaysFast &&
      sameTiers(paidTokenTiers(model, 1), paidTokenTiers(alias, 1))
    entries.push({
      key: `${group.id}:${model.platform}:${model.name}`,
      group,
      vendor: detectVendor(model.name, model.platform),
      model,
      fast: alias && !duplicate ? alias : null,
      alwaysFast,
      aliases: alias && duplicate ? [alias.name] : [],
      info: model.info ?? alias?.info ?? (standaloneFast ? byKey.get(`${model.platform}:${lower.slice(0, -FAST_SUFFIX.length)}`)?.info : null) ?? null
    })
  }
  return entries
}

/** 条目下所有可调用的模型 ID。 */
export function entryModelIds(entry: PlazaEntry): string[] {
  return [entry.model.name, ...(entry.fast && !STANDALONE_FAST_MODELS.has(entry.fast.name.toLowerCase()) ? [entry.fast.name] : []), ...entry.aliases]
}

export function entryTitle(entry: PlazaEntry): string {
  if (STANDALONE_FAST_MODELS.has(entry.model.name.toLowerCase())) return entry.model.name
  return entry.info?.display_name || entry.model.name
}

/** The all-groups catalog keeps one priced route per model; details retain every group. */
export function catalogModels(entries: PlazaEntry[]): PlazaEntry[] {
  const models = new Map<string, PlazaEntry>()
  const price = (entry: PlazaEntry) => paidTokenTiers(entry.model, paidRate(entry.model, entry.group))[0]?.input
    ?? paidRequestPrices(entry.model, paidRate(entry.model, entry.group))[0]?.price ?? Infinity
  for (const entry of entries) {
    const key = `${entry.model.platform}:${entry.model.name.toLowerCase()}`
    const previous = models.get(key)
    const maintenance = entry.group.status === 'maintenance'
    const previousMaintenance = previous?.group.status === 'maintenance'
    if (!previous || (maintenance !== previousMaintenance ? !maintenance : price(entry) < price(previous))) {
      models.set(key, entry)
    }
  }
  return [...models.values()]
}

// ── 场景估价 ────────────────────────────────────────────────────────

/** 一次请求的用量：input 为总输入（含命中缓存的部分），cacheHit 为缓存命中比例 0–1。 */
export interface Workload {
  input: number
  cacheHit: number
  output: number
}

export type ScenarioId = 'chat' | 'agent' | 'longDoc' | 'custom'

export const SCENARIO_PRESETS: Readonly<Record<Exclude<ScenarioId, 'custom'>, Workload>> = {
  chat: { input: 3_000, cacheHit: 0, output: 800 },
  agent: { input: 80_000, cacheHit: 0.9, output: 2_000 },
  longDoc: { input: 300_000, cacheHit: 0, output: 4_000 }
}

export interface CostEstimate {
  /** 计价所在档位（边际计价时为最高覆盖档）。 */
  tier: TokenTier
  uncachedTokens: number
  cachedTokens: number
  outputTokens: number
  uncachedCost: number
  cachedCost: number
  outputCost: number
  total: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

/**
 * 估算单次请求费用（USD）：未命中缓存的输入按输入价、命中部分按缓存读价（未配置时按输入价）、
 * 输出按输出价；不含缓存写入。整单计价按总输入所在档位计价；边际计价时每段按所在档、输出按基础档。
 * 没有 token 单价时返回 null。
 */
export function estimateCost(
  tiers: TokenTier[],
  workload: Workload,
  basis?: PlazaLongContextBasis
): CostEstimate | null {
  if (tiers.length === 0 || (tiers[0].input == null && tiers[0].output == null)) return null
  const input = Math.max(0, workload.input || 0)
  const outputTokens = Math.max(0, workload.output || 0)
  const cachedTokens = input * clamp(workload.cacheHit, 0, 1)
  const uncachedTokens = input - cachedTokens

  if (basis === 'marginal' && tiers.length > 1 && input > 0) {
    let uncachedCost = 0
    let cachedCost = 0
    let top = tiers[0]
    for (const tier of tiers) {
      const portion = Math.min(input, tier.maxTokens ?? Infinity) - tier.minTokens
      if (portion <= 0) continue
      const share = portion / input
      uncachedCost += uncachedTokens * share * (tier.input ?? 0)
      cachedCost += cachedTokens * share * (tier.cacheRead ?? tier.input ?? 0)
      top = tier
    }
    const outputCost = outputTokens * (tiers[0].output ?? 0)
    return {
      tier: top,
      uncachedTokens,
      cachedTokens,
      outputTokens,
      uncachedCost,
      cachedCost,
      outputCost,
      total: uncachedCost + cachedCost + outputCost
    }
  }

  const tier =
    tiers.find((t) => input > t.minTokens && (t.maxTokens == null || input <= t.maxTokens)) ?? tiers[0]
  const uncachedCost = uncachedTokens * (tier.input ?? 0)
  const cachedCost = cachedTokens * (tier.cacheRead ?? tier.input ?? 0)
  const outputCost = outputTokens * (tier.output ?? 0)
  return {
    tier,
    uncachedTokens,
    cachedTokens,
    outputTokens,
    uncachedCost,
    cachedCost,
    outputCost,
    total: uncachedCost + cachedCost + outputCost
  }
}

/** 条目主模型在给定用量下的实付估价；非 token 计费返回 null。 */
export function entryEstimate(entry: PlazaEntry, workload: Workload, fast = false): CostEstimate | null {
  const model = fast ? entry.fast : entry.model
  if (!model || !isTokenBilled(model)) return null
  return estimateCost(paidTokenTiers(model, paidRate(model, entry.group)), workload, model.long_context_basis)
}

// ── 特性、排序与筛选 ────────────────────────────────────────────────

export type FeatureKey = 'fast' | 'vision' | 'reasoning' | 'flatContext'

export const FEATURE_KEYS: readonly FeatureKey[] = ['fast', 'vision', 'reasoning', 'flatContext']

/**
 * 条目具备的特性。flatContext 表示官方对长上下文加价、本站该模型不加价
 * （实付只有一档而官方参考价有多档）。
 */
export function entryFeatures(entry: PlazaEntry): Set<FeatureKey> {
  const out = new Set<FeatureKey>()
  if (entry.fast || entry.alwaysFast) out.add('fast')
  if (entry.info?.input_modalities?.includes('image')) out.add('vision')
  if (entry.info?.reasoning) out.add('reasoning')
  if (
    isTokenBilled(entry.model) &&
    paidTokenTiers(entry.model, 1).length <= 1 &&
    officialTokenTiers(entry.model).length > 1
  ) {
    out.add('flatContext')
  }
  return out
}

/** 只返回能把列表分开的特性：至少一条有、且不是所有条目都有。 */
export function availableFeatures(entries: PlazaEntry[]): FeatureKey[] {
  const counts = new Map<FeatureKey, number>()
  for (const entry of entries) {
    for (const feature of entryFeatures(entry)) counts.set(feature, (counts.get(feature) ?? 0) + 1)
  }
  return FEATURE_KEYS.filter((f) => {
    const n = counts.get(f) ?? 0
    return n > 0 && n < entries.length
  })
}

export interface EntryFilter {
  query: string
  vendor: VendorId | 'all'
  features: FeatureKey[]
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9一-鿿]/g, '')
}

export function matchesQuery(entry: PlazaEntry, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [...entryModelIds(entry), entry.info?.display_name ?? '', vendorMeta(entry.vendor).label]
    .join(' ')
    .toLowerCase()
  if (haystack.includes(q)) return true
  const nq = normalizeSearch(q)
  return nq !== '' && normalizeSearch(haystack).includes(nq)
}

export function filterEntries(entries: PlazaEntry[], filter: EntryFilter): PlazaEntry[] {
  return entries.filter((entry) => {
    if (filter.vendor !== 'all' && entry.vendor !== filter.vendor) return false
    if (filter.features.length > 0) {
      const features = entryFeatures(entry)
      if (!filter.features.every((f) => features.has(f))) return false
    }
    return matchesQuery(entry, filter.query)
  })
}

export type SortKey = 'recommended' | 'estimate' | 'input' | 'output' | 'name'

export const SORT_KEYS: readonly SortKey[] = ['recommended', 'estimate', 'input', 'output', 'name']

/** 模型名中的第一个版本号（gpt-6.1-sol → 6.1），没有时为 -1。 */
function modelVersion(name: string): number {
  const match = name.replace(ROUTE_PREFIX, '').match(/(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : -1
}

function basePrice(entry: PlazaEntry, field: 'input' | 'output'): number | null {
  const tiers = paidTokenTiers(entry.model, paidRate(entry.model, entry.group))
  if (tiers.length > 0) return tiers[0][field]
  const request = paidRequestPrices(entry.model, paidRate(entry.model, entry.group))
  return request.length > 0 ? request[0].price : null
}

function compareNullable(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a - b
}

/**
 * 排序：
 * - recommended：按厂商顺序，同厂商内版本号新的在前、同版本按实付输出价从高到低；
 * - estimate / input / output：按单次估价、基础档输入价、输出价从低到高，无价的排最后；
 * - name：按模型 ID。
 */
export function sortEntries(entries: PlazaEntry[], key: SortKey, workload: Workload): PlazaEntry[] {
  const list = [...entries]
  const byName = (a: PlazaEntry, b: PlazaEntry) => a.model.name.localeCompare(b.model.name)
  switch (key) {
    case 'estimate': {
      const totals = new Map(list.map((e) => [e.key, entryEstimate(e, workload)?.total ?? null]))
      return list.sort((a, b) => compareNullable(totals.get(a.key)!, totals.get(b.key)!) || byName(a, b))
    }
    case 'input':
    case 'output':
      return list.sort((a, b) => compareNullable(basePrice(a, key), basePrice(b, key)) || byName(a, b))
    case 'name':
      return list.sort(byName)
    default:
      return list.sort((a, b) => {
        const vendor = VENDOR_BY_ID.get(a.vendor)!.index - VENDOR_BY_ID.get(b.vendor)!.index
        if (vendor !== 0) return vendor
        const version = modelVersion(b.model.name) - modelVersion(a.model.name)
        if (version !== 0) return version
        return compareNullable(basePrice(b, 'output'), basePrice(a, 'output')) || byName(a, b)
      })
  }
}

export interface VendorSummary {
  vendor: VendorId
  count: number
  /** 该厂商模型的实付倍率，去重升序（通常只有分组倍率一个值）。 */
  rates: number[]
}

/** 各厂商的条目数与倍率（只含出现过的厂商，按展示顺序）。 */
export function vendorSummaries(entries: PlazaEntry[]): VendorSummary[] {
  const byVendor = new Map<VendorId, { count: number; rates: Set<number> }>()
  for (const entry of entries) {
    const summary = byVendor.get(entry.vendor) ?? { count: 0, rates: new Set<number>() }
    summary.count += 1
    summary.rates.add(paidRate(entry.model, entry.group))
    byVendor.set(entry.vendor, summary)
  }
  return VENDORS.filter((v) => byVendor.has(v.id)).map((v) => {
    const summary = byVendor.get(v.id)!
    return { vendor: v.id, count: summary.count, rates: [...summary.rates].sort((a, b) => a - b) }
  })
}

/** 倍率文本：单值「0.2×」，多值「0.2–0.5×」。 */
export function formatRates(rates: number[]): string {
  if (rates.length === 0) return ''
  const min = rates[0]
  const max = rates[rates.length - 1]
  return min === max ? `${min}×` : `${min}–${max}×`
}

// ── 格式化 ──────────────────────────────────────────────────────────

export type PriceUnit = 'M' | 'K'

export const PRICE_UNIT_SCALE: Readonly<Record<PriceUnit, number>> = { M: 1_000_000, K: 1_000 }

/**
 * 美元金额：至少 2 位小数，小于 1 时保留 4 位有效数字，去掉多余的 0。
 *   formatUsd(4) → "$4.00"；formatUsd(0.0015) → "$0.0015"；formatUsd(1.5e-7) → "$0.00000015"
 */
export function formatUsd(value: number | null | undefined, minDecimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value === 0) return '$0'
  const abs = Math.abs(value)
  const decimals = Math.min(12, abs < 1 ? Math.max(minDecimals, Math.ceil(-Math.log10(abs)) + 3) : minDecimals)
  let text = value.toFixed(decimals)
  if (text.includes('.')) {
    const [whole, fraction] = text.split('.')
    const trimmed = fraction.replace(/0+$/, '')
    text = `${whole}.${trimmed.padEnd(minDecimals, '0')}`
  }
  return `$${text}`
}

/** 每 token 单价按单位换算后的金额文本。 */
export function formatUnitPrice(perToken: number | null | undefined, unit: PriceUnit): string {
  return perToken == null ? '—' : formatUsd(perToken * PRICE_UNIT_SCALE[unit])
}

function trimNumber(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** 档位阈值等十进制 token 数：272000 → 272K，1000000 → 1M。 */
export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${trimNumber(n / 1_000_000)}M`
  if (n >= 1_000) return `${trimNumber(n / 1_000)}K`
  return String(n)
}

/**
 * 上下文窗口：整千的按十进制（128000 → 128K），否则整除 1024 的按二进制
 * （131072 → 128K，1048576 → 1M），其余按十进制取两位小数。
 */
export function formatContextSize(n: number): string {
  if (n % 1_000 !== 0) {
    if (n >= 1_048_576 && n % 1_048_576 === 0) return `${n / 1_048_576}M`
    if (n >= 1_024 && n < 1_048_576 && n % 1_024 === 0) return `${n / 1_024}K`
  }
  return formatTokenCount(n)
}
