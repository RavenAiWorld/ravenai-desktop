import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  BUILTIN_PLATFORM_CATALOG,
  resetPlatformCatalog,
  setPlatformCatalog
} from '@/constants/platformCatalog'

const {
  copyToClipboard,
  showError,
  showSuccess,
  showInfo,
  showWarning,
  syncUpstreamModels,
  syncUpstreamModelsPreview
} = vi.hoisted(() => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showInfo: vi.fn(),
  showWarning: vi.fn(),
  syncUpstreamModels: vi.fn(),
  syncUpstreamModelsPreview: vi.fn()
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, string>) => key === 'common.copy' ? '复制' : key === 'admin.accounts.modelMappingConflict' ? `Model mapping conflict: ${params?.from} → ${params?.to}` : key === 'admin.accounts.syncUpstreamModelsError' ? `${key}: ${params?.message}` : key
    })
  }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError,
    showSuccess,
    showInfo,
    showWarning
  })
}))

vi.mock('@/api/admin/accounts', () => ({
  accountsAPI: {
    syncUpstreamModels,
    syncUpstreamModelsPreview
  }
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copyToClipboard
  })
}))

import ModelWhitelistSelector from '../ModelWhitelistSelector.vue'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function mountSelector(props: Record<string, unknown> = {}) {
  return mount(ModelWhitelistSelector, {
    props: {
      modelValue: [],
      platform: 'openai',
      ...props,
    },
    global: {
      stubs: {
        ModelIcon: true
      }
    }
  })
}

function syncButton(wrapper: ReturnType<typeof mountSelector>) {
  return wrapper.get('[data-testid="sync-upstream-models"]')
}

function findModelRow(wrapper: ReturnType<typeof mountSelector>, modelId: string) {
  const row = wrapper
    .findAll('[data-testid="model-option"]')
    .find(candidate => candidate.text().includes(modelId))

  if (!row) {
    throw new Error(`Model row not found: ${modelId}`)
  }

  return row
}

describe('ModelWhitelistSelector', () => {
  it('shows health overrides ahead of both manual and automatic catalogs without persisting them', async () => {
    const wrapper = mountSelector({
      automaticCatalog: true, upstreamModels: ['gpt-6-astra', 'gpt-6.1-sol'],
      modelValue: ['gpt-6.1-sol', 'gpt-6.1-terra'],
      healthControls: { 'gpt-6.1-sol': { enabled: false, model: 'gpt-6.1-sol', rule_id: 'sol' } }
    })
    expect(wrapper.find('[data-testid="health-model"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="automatic-model"]').map(row => row.text())).toEqual(['gpt-6-astraadmin.accounts.automaticModelBadge'])
    await wrapper.get('.cursor-pointer').trigger('click')
    const option = findModelRow(wrapper, 'gpt-6.1-sol').get('[data-testid="select-model"]')
    expect(option.attributes('disabled')).toBeDefined()
    expect(option.find('svg.h-3').exists()).toBe(false)
    await wrapper.setProps({ healthControls: { 'gpt-6.1-sol': { enabled: true, model: 'gpt-6.1-sol', rule_id: 'sol' } } })
    expect(wrapper.get('[data-testid="health-model"]').text()).toContain('gpt-6.1-sol')
    expect(wrapper.get('[data-testid="health-model"]').find('button').exists()).toBe(false)
    expect(option.find('svg.h-3').exists()).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.clearAllModels')!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[['gpt-6.1-sol']]])
    expect(wrapper.emitted('update:excludedModels')).toEqual([[['gpt-6-astra']]])
    wrapper.unmount()
  })

  it('restores the baseline after a health rule is removed', async () => {
    const wrapper = mountSelector({ modelValue: ['gpt-6-astra'], healthControls: { 'gpt-6.1-sol': { enabled: true, model: 'gpt-6.1-sol', rule_id: 'sol' } } })
    expect(wrapper.get('[data-testid="health-model"]').text()).toContain('gpt-6.1-sol')
    await wrapper.setProps({ healthControls: {} })
    expect(wrapper.find('[data-testid="health-model"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('gpt-6-astra')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows the applied automatic catalog when the manual whitelist is empty', async () => {
    const wrapper = mountSelector({
      accountId: 130,
      automaticCatalog: true,
      upstreamModels: ['gpt-6-astra', 'gpt-6.1-sol'],
      modelValue: []
    })
    expect(wrapper.findAll('[data-testid="automatic-model"]').map(row => row.text())).toEqual([
      'gpt-6-astraadmin.accounts.automaticModelBadge',
      'gpt-6.1-soladmin.accounts.automaticModelBadge'
    ])
    expect(wrapper.get('[data-testid="model-selection-count"]').text()).toBe('admin.accounts.automaticModelSelectionCount')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.fillManualModelsFromCatalog')!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[['gpt-6-astra', 'gpt-6.1-sol']]])
  })

  it('does not duplicate automatic IDs already selected manually and retains aliases', async () => {
    const wrapper = mountSelector({
      accountId: 130,
      automaticCatalog: true,
      upstreamModels: ['gpt-6-astra', 'gpt-6.1-sol'],
      modelValue: ['gpt-6-astra', 'my-alias']
    })
    expect(wrapper.findAll('[data-testid="automatic-model"]').map(row => row.text())).toEqual([
      'gpt-6.1-soladmin.accounts.automaticModelBadge'
    ])
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.clearAllModels')!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[[]]])
    expect(wrapper.emitted('update:excludedModels')).toEqual([[['gpt-6-astra', 'gpt-6.1-sol']]])
    await wrapper.setProps({ modelValue: [], excludedModels: ['gpt-6-astra', 'gpt-6.1-sol'] })
    expect(wrapper.findAll('[data-testid="automatic-model"]')).toHaveLength(0)
    expect(wrapper.emitted('catalog-updated')).toBeUndefined()
  })

  it('does not present discovery-only models as applied automatic models', () => {
    const wrapper = mountSelector({
      accountId: 130,
      automaticCatalog: false,
      upstreamModels: ['gpt-6-astra'],
      modelValue: []
    })
    expect(wrapper.findAll('[data-testid="automatic-model"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="model-selection-count"]').text()).toBe('admin.accounts.modelCount')
  })

  it.each([
    ['upstream_model_metadata_incomplete', 'admin.accounts.syncUpstreamModelsMetadataIncomplete'],
    ['upstream_model_metadata_partial', 'admin.accounts.syncUpstreamModelsMetadataPartial'],
    ['unrelated_warning', undefined]
  ])('reports the actual %s warning after an applied catalog sync', async (code, expected) => {
    syncUpstreamModels.mockResolvedValue({
      models: ['gpt-6-astra', 'gpt-6.1-sol'],
      live: true,
      synced_at: '2026-11-06T01:29:42Z',
      warnings: [{ code, message: 'metadata diagnostic' }]
    })
    const wrapper = mountSelector({ accountId: 130, automaticCatalog: true })
    await wrapper.get('[data-testid="sync-upstream-models"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="automatic-model"]')).toHaveLength(2)
    if (expected) expect(wrapper.get('[data-testid="model-capability-status"]').text()).toBe(expected)
    else expect(wrapper.find('[data-testid="model-capability-status"]').exists()).toBe(false)
    expect(showWarning).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it.each([false, true])('removes an automatic model without bringing back the manual duplicate (%s)', async manual => {
    const wrapper = mountSelector({
      accountId: 130, automaticCatalog: true,
      upstreamModels: ['gpt-6-astra', 'gpt-6.1-sol'],
      modelValue: manual ? ['gpt-6-astra'] : []
    })
    const chip = wrapper.findAll('[data-testid="remove-model"]').find(button => button.attributes('aria-label')?.endsWith(' gpt-6-astra'))!
    await chip.trigger('click')
    expect(wrapper.emitted('update:excludedModels')).toEqual([[['gpt-6-astra']]])
    await wrapper.setProps({ modelValue: [], excludedModels: ['gpt-6-astra'] })
    expect(wrapper.findAll('[data-testid="automatic-model"]').map(row => row.text())).toEqual([
      'gpt-6.1-soladmin.accounts.automaticModelBadge'
    ])
    await wrapper.get('div.cursor-pointer').trigger('click')
    const removed = findModelRow(wrapper, 'gpt-6-astra')
    expect(removed.find('svg.h-3').exists()).toBe(false)
    await removed.get('[data-testid="select-model"]').trigger('click')
    expect(wrapper.emitted('update:excludedModels')?.at(-1)).toEqual([[]])
    await wrapper.setProps({ excludedModels: [] })
    expect(wrapper.findAll('[data-testid="automatic-model"]')).toHaveLength(2)
  })

  it('keeps exclusions across sync and restores one through custom input', async () => {
    syncUpstreamModels.mockResolvedValue({
      models: ['gpt-6-astra', 'new-model'], live: true, synced_at: '2026-11-06T02:00:00Z'
    })
    const wrapper = mountSelector({
      accountId: 130, automaticCatalog: true,
      upstreamModels: ['gpt-6-astra'], excludedModels: ['gpt-6-astra']
    })
    await syncButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="automatic-model"]').map(row => row.text())).toEqual([
      'new-modeladmin.accounts.automaticModelBadge'
    ])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('update:excludedModels')).toBeUndefined()
    await wrapper.get('input[placeholder="admin.accounts.enterCustomModelName"]').setValue('gpt-6-astra')
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.addModel')!.trigger('click')
    expect(wrapper.emitted('update:excludedModels')).toEqual([[[]]])
  })

  it('restores the current catalog to the manual whitelist after all models were cleared', async () => {
    const models = ['gpt-6-astra', 'gpt-6.1-sol']
    const wrapper = mountSelector({
      accountId: 130, automaticCatalog: true, upstreamModels: models
    })
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.clearAllModels')!.trigger('click')
    await wrapper.setProps({ modelValue: [], excludedModels: models })
    expect(wrapper.findAll('[data-testid="remove-model"]')).toHaveLength(0)

    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.fillManualModelsFromCatalog')!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([models])
    expect(wrapper.emitted('update:excludedModels')?.at(-1)).toEqual([[]])
    await wrapper.setProps({ modelValue: models, excludedModels: [] })
    expect(wrapper.findAll('[data-testid="remove-model"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="automatic-model"]')).toHaveLength(0)
  })

  it('fills only current discovered models and preserves manual aliases and retired exclusions', async () => {
    syncUpstreamModels.mockResolvedValue({
      models: ['gpt-6-astra', 'new-model'], live: true, synced_at: '2026-11-06T02:00:00Z'
    })
    const wrapper = mountSelector({
      accountId: 130, automaticCatalog: true, upstreamModels: ['gpt-6-astra'],
      modelValue: ['my-alias'], excludedModels: ['gpt-6-astra', 'retired-model']
    })
    await syncButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:excludedModels')).toBeUndefined()
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.fillManualModelsFromCatalog')!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[['my-alias', 'gpt-6-astra', 'new-model']]])
    expect(wrapper.emitted('update:excludedModels')).toEqual([[['retired-model']]])
  })

  it('restores raw OpenCode exclusions when filling public model names manually', async () => {
    const wrapper = mountSelector({
      platform: 'opencode_go', automaticCatalog: true,
      upstreamModels: ['provider/model', 'oc-provider/model'],
      excludedModels: ['provider/model', 'retired-model']
    })
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.fillManualModelsFromCatalog')!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[['oc-provider/model']]])
    expect(wrapper.emitted('update:excludedModels')).toEqual([[['retired-model']]])
  })

  it('ignores saved exclusions after opting out of automatic catalogs', () => {
    const wrapper = mountSelector({
      automaticCatalog: false, upstreamModels: ['gpt-6-astra'],
      modelValue: ['gpt-6-astra'], excludedModels: ['gpt-6-astra']
    })
    expect(wrapper.get('[data-testid="remove-model"]').attributes('aria-label')).toBe('common.remove gpt-6-astra')
    expect(wrapper.findAll('[data-testid="automatic-model"]')).toHaveLength(0)
  })

  it('restores raw OpenCode exclusions using their public model names', async () => {
    const wrapper = mountSelector({
      platform: 'opencode_go', automaticCatalog: true,
      upstreamModels: ['provider/model'], excludedModels: ['provider/model']
    })
    expect(wrapper.findAll('[data-testid="automatic-model"]')).toHaveLength(0)
    await wrapper.get('div.cursor-pointer').trigger('click')
    expect(wrapper.findAll('[data-testid="model-option"]')).toHaveLength(1)
    await findModelRow(wrapper, 'oc-provider/model').get('[data-testid="select-model"]').trigger('click')
    expect(wrapper.emitted('update:excludedModels')).toEqual([[[]]])
  })

  it('does not copy auto-synced OpenCode IDs into the manual mapping form', async () => {
    syncUpstreamModels.mockResolvedValue({ models: ['provider-model'], live: true, synced_at: '2026-09-23T00:00:00Z' })
    const wrapper = mountSelector({ platform: 'opencode_go', accountId: 96, modelValue: ['oc-alias'] })
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.syncUpstreamModels')!.trigger('click')
    await flushPromises()
    await wrapper.get('div.cursor-pointer').trigger('click')
    expect(wrapper.findAll('[data-testid="model-option"]').map(row => row.text())).toEqual([
      'oc-provider-model',
      'oc-alias'
    ])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('catalog-updated')).toEqual([[{
      models: ['provider-model'],
      live: true,
      synced_at: '2026-09-23T00:00:00Z'
    }]])
    expect(showSuccess).toHaveBeenCalledWith('admin.accounts.upstreamCatalogSynced')
  })

  beforeEach(() => {
    copyToClipboard.mockClear()
    showError.mockReset()
    showSuccess.mockReset()
    showInfo.mockReset()
    showWarning.mockReset()
    syncUpstreamModels.mockReset()
    syncUpstreamModelsPreview.mockReset()
  })

  afterEach(() => {
    resetPlatformCatalog()
  })

  const kimiModels = ['k3', 'k3-256k', 'k3.1-pro', 'k3.1-pro-highspeed', 'kimi-for-coding', 'kimi-for-coding-highspeed']
  const manualKimiModels = ['k3', 'k3.1-pro', 'k3.1-pro-highspeed']

  it('shows all six saved upstream models without changing the three manual selections', async () => {
    const wrapper = mountSelector({
      platform: 'kimi',
      accountId: 97,
      upstreamModels: kimiModels,
      modelValue: manualKimiModels
    })
    await wrapper.get('div.cursor-pointer').trigger('click')
    expect(wrapper.findAll('[data-testid="model-option"]').map(row => row.text())).toEqual(kimiModels)
    expect(wrapper.findAll('[data-testid="select-model"]').every(button => !button.attributes('disabled'))).toBe(true)
    expect(wrapper.findAll('[data-testid="select-model"] .bg-primary-500')).toHaveLength(3)
    expect(wrapper.props('modelValue')).toEqual(manualKimiModels)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await findModelRow(wrapper, 'k3-256k').get('[data-testid="select-model"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[[
      ...manualKimiModels,
      'k3-256k'
    ]]])
  })

  it('fills related models from the actual catalog instead of outdated platform presets', async () => {
    const wrapper = mountSelector({
      platform: 'kimi',
      accountId: 65,
      upstreamModels: kimiModels,
      modelValue: manualKimiModels
    })
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.fillRelatedModels')!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[[
      ...manualKimiModels,
      ...kimiModels.filter(model => !manualKimiModels.includes(model))
    ]]])
  })

  it('preserves an existing manual model spelling rather than silently correcting it', async () => {
    const manual = ['k3', 'k3.1-pro', 'k3.1-pro- highspeed']
    const wrapper = mountSelector({ platform: 'kimi', accountId: 65, upstreamModels: kimiModels, modelValue: manual })
    await wrapper.get('div.cursor-pointer').trigger('click')
    expect(wrapper.findAll('[data-testid="model-option"]').map(row => row.text())).toEqual([
      ...kimiModels,
      'k3.1-pro- highspeed'
    ])
    expect(wrapper.props('modelValue')).toEqual(manual)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('refreshes available models immediately after an automatic sync without selecting them', async () => {
    syncUpstreamModels.mockResolvedValue({
      models: kimiModels,
      live: true,
      synced_at: '2026-10-26T08:00:00Z'
    })
    const wrapper = mountSelector({ platform: 'kimi', accountId: 97, modelValue: manualKimiModels })
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.syncUpstreamModels')!.trigger('click')
    await flushPromises()
    await wrapper.get('div.cursor-pointer').trigger('click')
    expect(wrapper.findAll('[data-testid="model-option"]').map(row => row.text())).toEqual(kimiModels)
    expect(wrapper.props('modelValue')).toEqual(manualKimiModels)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('catalog-updated')?.[0]?.[0]).toMatchObject({ models: kimiModels })
  })

  it('prefixes only unprefixed OpenCode catalog models and deduplicates their public IDs', async () => {
    const wrapper = mountSelector({
      platform: 'opencode_go',
      accountId: 96,
      upstreamModels: [' provider-model ', 'oc-provider-model', 'oc-native'],
      modelValue: ['oc-native', 'oc-alias']
    })
    await wrapper.get('div.cursor-pointer').trigger('click')
    expect(wrapper.findAll('[data-testid="model-option"]').map(row => row.text())).toEqual([
      'oc-provider-model',
      'oc-native',
      'oc-alias'
    ])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('clears an authoritative empty catalog while retaining manual selections', async () => {
    syncUpstreamModels.mockResolvedValue({ models: [], live: true, synced_at: '2026-10-26T08:00:00Z' })
    const wrapper = mountSelector({
      platform: 'kimi',
      accountId: 97,
      upstreamModels: kimiModels,
      modelValue: manualKimiModels
    })
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.syncUpstreamModels')!.trigger('click')
    await flushPromises()
    await wrapper.get('div.cursor-pointer').trigger('click')
    expect(wrapper.findAll('[data-testid="model-option"]').map(row => row.text())).toEqual(manualKimiModels)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('catalog-updated')?.[0]?.[0]).toMatchObject({ models: [] })
  })

  it.each(['unavailable', 'rejected'])('retains the last catalog when a sync is %s', async (failure) => {
    if (failure === 'unavailable') {
      syncUpstreamModels.mockResolvedValue({ models: ['configured-only'], live: false })
    } else {
      syncUpstreamModels.mockRejectedValue(new Error('upstream unavailable'))
    }
    const wrapper = mountSelector({
      platform: 'kimi',
      accountId: 97,
      upstreamModels: kimiModels,
      modelValue: manualKimiModels
    })
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.syncUpstreamModels')!.trigger('click')
    await flushPromises()
    await wrapper.get('div.cursor-pointer').trigger('click')
    expect(wrapper.findAll('[data-testid="model-option"]').map(row => row.text())).toEqual(kimiModels)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('catalog-updated')).toBeUndefined()
  })

  it('replaces the available catalog when the selected account changes', async () => {
    const wrapper = mountSelector({ platform: 'kimi', accountId: 97, upstreamModels: kimiModels })
    await wrapper.setProps({ accountId: 98, upstreamModels: ['other-provider-model'] })
    await wrapper.get('div.cursor-pointer').trigger('click')
    expect(wrapper.findAll('[data-testid="model-option"]').map(row => row.text())).toEqual(['other-provider-model'])
  })

  it('does not apply a delayed result to a different account', async () => {
    let resolveSync!: (result: unknown) => void
    syncUpstreamModels.mockReturnValue(new Promise(resolve => { resolveSync = resolve }))
    const wrapper = mountSelector({ platform: 'kimi', accountId: 97, upstreamModels: kimiModels })
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.syncUpstreamModels')!.trigger('click')
    await wrapper.setProps({ accountId: 98, upstreamModels: ['other-provider-model'] })
    resolveSync({ models: ['previous-account-model'], live: true, synced_at: '2026-10-26T08:00:00Z' })
    await flushPromises()
    await wrapper.get('div.cursor-pointer').trigger('click')
    expect(wrapper.findAll('[data-testid="model-option"]').map(row => row.text())).toEqual(['other-provider-model'])
    expect(wrapper.emitted('catalog-updated')).toBeUndefined()
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('does not show a delayed rejection for a different account', async () => {
    let rejectSync!: (error: Error) => void
    syncUpstreamModels.mockReturnValue(new Promise((_, reject) => { rejectSync = reject }))
    const wrapper = mountSelector({ platform: 'kimi', accountId: 97, upstreamModels: kimiModels })
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.syncUpstreamModels')!.trigger('click')
    await wrapper.setProps({ accountId: 98, upstreamModels: ['other-provider-model'] })
    rejectSync(new Error('previous account failed'))
    await flushPromises()
    expect(showError).not.toHaveBeenCalled()
    expect(wrapper.emitted('catalog-updated')).toBeUndefined()
  })

  it.each(['anthropic', 'openai', 'gemini', 'antigravity', 'grok', 'kimi', 'zhipu', 'deepseek', 'minimax', 'opencode_go', 'command_code', 'cline'])(
    'supports upstream sync for %s saved accounts and creation previews',
    (platform) => {
      const wrappers = [
        mountSelector({ platform, accountId: 46 }),
        mountSelector({ platform, syncCredentials: { platform, type: 'apikey', api_key: 'test-key' } })
      ]
      for (const wrapper of wrappers) {
        expect(wrapper.findAll('button').some(button => button.text() === 'admin.accounts.syncUpstreamModels')).toBe(true)
        wrapper.unmount()
      }
    }
  )

  it.each(['typesafe', 'unregistered'])(
    'hides upstream sync for unsupported %s saved accounts and creation previews',
    (platform) => {
      const wrappers = [
        mountSelector({ platform, accountId: 46 }),
        mountSelector({ platform, syncCredentials: { platform, type: 'apikey', api_key: 'test-key' } })
      ]
      for (const wrapper of wrappers) {
        expect(wrapper.findAll('button').some(button => button.text() === 'admin.accounts.syncUpstreamModels')).toBe(false)
        wrapper.unmount()
      }
      expect(syncUpstreamModels).not.toHaveBeenCalled()
      expect(syncUpstreamModelsPreview).not.toHaveBeenCalled()
    }
  )

  it('requires a supported request builder for newly registered platforms', async () => {
    const wrapper = mountSelector({ platform: 'acme_router', accountId: 46 })
    const platforms = [
      ...BUILTIN_PLATFORM_CATALOG.platforms,
      { id: 'acme_router', display_name: 'Acme Router', gateway: 'openai' as const, cn_provider: false }
    ]
    setPlatformCatalog({ ...BUILTIN_PLATFORM_CATALOG, platforms })
    await flushPromises()
    expect(wrapper.findAll('button').some(button => button.text() === 'admin.accounts.syncUpstreamModels')).toBe(false)

    setPlatformCatalog({
      ...BUILTIN_PLATFORM_CATALOG,
      platforms: platforms.map(spec => spec.id === 'acme_router'
        ? { ...spec, multi_protocol: { default_mode: 'default', routing: 'by_inbound', modes: [] } }
        : spec)
    })
    await flushPromises()
    expect(wrapper.findAll('button').some(button => button.text() === 'admin.accounts.syncUpstreamModels')).toBe(true)
    wrapper.unmount()
  })

  it.each(['claude-*', '*', 'gpt-*-mini'])(
    'rejects wildcard whitelist entry %s without clearing the input', async (model) => {
      const wrapper = mountSelector({ modelValue: ['gpt-5'] })
      const input = wrapper.get('input[placeholder="admin.accounts.enterCustomModelName"]')
      await input.setValue(model)
      await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.addModel')!.trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(showInfo).toHaveBeenCalledWith('admin.accounts.modelWildcardNotSupported')
      expect((input.element as HTMLInputElement).value).toBe(model)
    }
  )

  it('rejects wildcard entries submitted with Enter and accepts a corrected exact model', async () => {
    const wrapper = mountSelector()
    const input = wrapper.get('input[placeholder="admin.accounts.enterCustomModelName"]')
    await input.setValue(' claude-* ')
    await input.trigger('keydown.enter')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(showInfo).toHaveBeenCalledWith('admin.accounts.modelWildcardNotSupported')

    await input.setValue(' claude-sonnet-4-5 ')
    await input.trigger('keydown.enter')
    expect(wrapper.emitted('update:modelValue')).toEqual([[['claude-sonnet-4-5']]])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('rejects a custom whitelist model that is already mapped to a different target', async () => {
    const wrapper = mountSelector({ modelMappings: [{ from: 'gpt-latest', to: 'deepseek-chat' }] })
    await wrapper.get('input[placeholder="admin.accounts.enterCustomModelName"]').setValue(' gpt-latest ')
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.addModel')!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('gpt-latest → deepseek-chat'))
  })

  it('keeps the existing duplicate identity warning before checking mappings', async () => {
    const wrapper = mountSelector({ modelValue: ['gpt-latest'], modelMappings: [{ from: 'gpt-latest', to: 'deepseek-chat' }] })
    await wrapper.get('input[placeholder="admin.accounts.enterCustomModelName"]').setValue('gpt-latest')
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.addModel')!.trigger('click')
    expect(showInfo).toHaveBeenCalledWith('admin.accounts.modelExists')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('allows matching identity mapping as a whitelist model', async () => {
    const wrapper = mountSelector({ modelMappings: [{ from: 'gpt-latest', to: 'gpt-latest' }] })
    await wrapper.get('input[placeholder="admin.accounts.enterCustomModelName"]').setValue('gpt-latest')
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.addModel')!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[['gpt-latest']]])
  })

  it('still allows custom models without a mapping prop', async () => {
    const wrapper = mountSelector()
    await wrapper.get('input[placeholder="admin.accounts.enterCustomModelName"]').setValue('custom-model')
    await wrapper.findAll('button').find(button => button.text() === 'admin.accounts.addModel')!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[['custom-model']]])
  })

  it('copies a model ID without selecting the model', async () => {
    const wrapper = mountSelector()
    await wrapper.get('div.cursor-pointer').trigger('click')

    const row = findModelRow(wrapper, 'gpt-5.6-sol')

    const copyButton = row.get('[data-testid="copy-model-id"]')
    expect(copyButton.attributes('aria-label')).toBe('复制 gpt-5.6-sol')

    await copyButton.trigger('click')
    await flushPromises()

    expect(copyToClipboard).toHaveBeenCalledWith('gpt-5.6-sol')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('keeps the existing model selection behavior', async () => {
    const wrapper = mountSelector()
    await wrapper.get('div.cursor-pointer').trigger('click')

    const row = findModelRow(wrapper, 'gpt-5.6-sol')
    await row.get('[data-testid="select-model"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[['gpt-5.6-sol']]])
    expect(copyToClipboard).not.toHaveBeenCalled()
  })

  it('warns when model IDs sync but capability metadata is incomplete', async () => {
    syncUpstreamModels.mockResolvedValue({
      models: ['x-preview-f-free'],
      warnings: [
        {
          code: 'upstream_model_metadata_incomplete',
          message: 'Model IDs were synced, but capability metadata could not be updated.'
        }
      ]
    })
    const wrapper = mount(ModelWhitelistSelector, {
      props: {
        modelValue: [],
        platform: 'openai',
        accountId: 46
      },
      global: {
        stubs: {
          ModelIcon: true
        }
      }
    })

    const syncButton = wrapper
      .findAll('button')
      .find(button => button.text() === 'admin.accounts.syncUpstreamModels')
    expect(syncButton).toBeDefined()
    await syncButton!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toEqual([[['x-preview-f-free']]])
    expect(showWarning).toHaveBeenCalledWith('admin.accounts.syncUpstreamModelsMetadataIncomplete')
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('shows the backend message when upstream sync is rejected', async () => {
    syncUpstreamModels.mockRejectedValue({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Vertex API key accounts do not support upstream model listing'
    })
    const wrapper = mountSelector({ platform: 'gemini', accountId: 174 })

    const syncButton = wrapper
      .findAll('button')
      .find(button => button.text() === 'admin.accounts.syncUpstreamModels')
    expect(syncButton).toBeDefined()
    await syncButton!.trigger('click')
    await flushPromises()

    expect(showError).toHaveBeenCalledWith(
      'admin.accounts.syncUpstreamModelsError: Vertex API key accounts do not support upstream model listing'
    )
  })

  it('shows success and a partial warning when some capabilities were saved', async () => {
    syncUpstreamModels.mockResolvedValue({
      models: ['gpt-6-astra', 'gpt-image-2'],
      warnings: [
        {
          code: 'upstream_model_metadata_partial',
          message: 'Some model capabilities were saved; remaining models are still incomplete.'
        }
      ]
    })
    const wrapper = mount(ModelWhitelistSelector, {
      props: {
        modelValue: [],
        platform: 'openai',
        accountId: 46
      },
      global: {
        stubs: {
          ModelIcon: true
        }
      }
    })

    const syncButton = wrapper
      .findAll('button')
      .find(button => button.text() === 'admin.accounts.syncUpstreamModels')
    expect(syncButton).toBeDefined()
    await syncButton!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toEqual([[['gpt-6-astra', 'gpt-image-2']]])
    expect(showSuccess).toHaveBeenCalledWith('admin.accounts.syncUpstreamModelsSuccess')
    expect(showWarning).toHaveBeenCalledWith('admin.accounts.syncUpstreamModelsMetadataPartial')
  })

  it('reports a successful preview so account creation can persist metadata', async () => {
    syncUpstreamModelsPreview.mockResolvedValue({
      models: ['x-preview-f-free'],
      metadata: {
        'x-preview-f-free': {
          id: 'x-preview-f-free',
          reasoning: true,
          supported_reasoning_levels: ['low', 'high', 'max'],
        },
      },
    })
    const wrapper = mountSelector({
      syncCredentials: {
        platform: 'openai',
        type: 'apikey',
        base_url: 'https://opencode.ai/zen/v1',
        api_key: 'test-key',
      },
    })
    const syncButton = wrapper
      .findAll('button')
      .find(button => button.text() === 'admin.accounts.syncUpstreamModels')

    expect(syncButton).toBeDefined()
    await syncButton?.trigger('click')
    await flushPromises()

    expect(syncUpstreamModelsPreview).toHaveBeenCalledOnce()
    expect(wrapper.emitted('upstream-synced')).toEqual([[]])
    expect(wrapper.emitted('update:modelValue')).toEqual([[['x-preview-f-free']]])
  })

  it('does not append configured fallback IDs', async () => {
    syncUpstreamModels.mockResolvedValue({
      models: ['composer-2.5'],
      discovery_source: 'configured_fallback',
      warnings: [{ code: 'grok_model_catalog_configured_fallback', message: 'fallback' }]
    })
    const wrapper = mountSelector({ platform: 'grok', accountId: 46, modelValue: ['grok-4.7'] })
    const button = wrapper.findAll('button').find(b => b.text() === 'admin.accounts.syncUpstreamModels')!
    await button.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(showWarning).toHaveBeenCalledWith('admin.accounts.grokModelDiagnostics.configuredFallback')
    expect(showSuccess).not.toHaveBeenCalled()
    expect(wrapper.emitted('upstream-sync-finished')).toHaveLength(1)
  })

  it('still appends a real catalog when capability metadata is incomplete', async () => {
    syncUpstreamModels.mockResolvedValue({
      models: ['grok-4.7'],
      discovery_source: 'upstream',
      warnings: [{ code: 'upstream_model_metadata_incomplete', message: 'incomplete' }]
    })
    const wrapper = mountSelector({ platform: 'grok', accountId: 46, modelValue: ['grok-4'] })
    const button = wrapper.findAll('button').find(b => b.text() === 'admin.accounts.syncUpstreamModels')!
    await button.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([[['grok-4', 'grok-4.7']]])
    expect(showWarning).toHaveBeenCalledWith('admin.accounts.syncUpstreamModelsMetadataIncomplete')
    expect(showSuccess).not.toHaveBeenCalled()
    expect(wrapper.emitted('upstream-sync-finished')).toHaveLength(1)
    expect(wrapper.emitted('upstream-synced')).toBeUndefined()
  })

  it('keeps appending models when a non-grok sync omits discovery fields', async () => {
    syncUpstreamModels.mockResolvedValue({ models: ['gpt-6'] })
    const wrapper = mountSelector({ platform: 'openai', accountId: 46, modelValue: [] })
    const button = wrapper.findAll('button').find(b => b.text() === 'admin.accounts.syncUpstreamModels')!
    await button.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([[['gpt-6']]])
    expect(showSuccess).toHaveBeenCalledWith('admin.accounts.syncUpstreamModelsSuccess')
    expect(wrapper.emitted('upstream-sync-finished')).toHaveLength(1)
    expect(wrapper.emitted('upstream-synced')).toBeUndefined()
  })

  it('keeps creation preview on the original upstream-synced event only', async () => {
    syncUpstreamModelsPreview.mockResolvedValue({
      models: ['grok-4.7'],
      discovery_source: 'upstream'
    })
    const wrapper = mountSelector({
      syncCredentials: {
        platform: 'grok',
        type: 'apikey',
        base_url: 'https://api.x.ai/v1',
        api_key: 'xai-test'
      }
    })
    const button = wrapper.findAll('button').find(b => b.text() === 'admin.accounts.syncUpstreamModels')!
    await button.trigger('click')
    await flushPromises()
    expect(syncUpstreamModels).not.toHaveBeenCalled()
    expect(wrapper.emitted('upstream-synced')).toEqual([[]])
    expect(wrapper.emitted('upstream-sync-finished')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toEqual([[['grok-4.7']]])
  })

  it('does not mark a creation preview synced when the catalog is only a configured fallback', async () => {
    syncUpstreamModelsPreview.mockResolvedValue({
      models: ['composer-2.5'],
      discovery_source: 'configured_fallback',
      warnings: [{ code: 'grok_model_catalog_configured_fallback', message: 'fallback' }]
    })
    const wrapper = mountSelector({
      syncCredentials: {
        platform: 'grok',
        type: 'apikey',
        api_key: 'xai-test'
      }
    })
    const button = wrapper.findAll('button').find(b => b.text() === 'admin.accounts.syncUpstreamModels')!
    await button.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('upstream-synced')).toBeUndefined()
    expect(wrapper.emitted('upstream-sync-finished')).toBeUndefined()
    expect(showWarning).toHaveBeenCalledWith('admin.accounts.grokModelDiagnostics.configuredFallback')
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('emits completion when a saved account sync fails so the last attempt can refresh', async () => {
    syncUpstreamModels.mockRejectedValue({
      status: 502,
      message: 'upstream unavailable'
    })
    const wrapper = mountSelector({ platform: 'grok', accountId: 46, modelValue: ['grok-4.7'] })
    const button = wrapper.findAll('button').find(b => b.text() === 'admin.accounts.syncUpstreamModels')!
    await button.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(showError).toHaveBeenCalled()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(wrapper.emitted('upstream-sync-finished')).toHaveLength(1)
  })

  it('shows the upstream sync button for OpenCode Go create-account credentials', () => {
    const wrapper = mountSelector({
      platform: 'opencode_go',
      syncCredentials: {
        platform: 'opencode_go',
        type: 'apikey',
        base_url: 'https://opencode.ai/zen/go/v1',
        api_key: 'sk-test',
      },
    })
    const syncButton = wrapper
      .findAll('button')
      .find(button => button.text() === 'admin.accounts.syncUpstreamModels')

    expect(syncButton).toBeDefined()
    expect(syncButton?.exists()).toBe(true)
  })

  it('can hide only the built-in trigger while retaining its public sync action', async () => {
    syncUpstreamModels.mockResolvedValue({ models: ['grok-4.7'], discovery_source: 'upstream' })
    const wrapper = mountSelector({ platform: 'grok', accountId: 46, showSyncButton: false })
    expect(wrapper.find('[data-testid="sync-upstream-models"]').exists()).toBe(false)
    await wrapper.vm.syncUpstreamModels()
    await flushPromises()
    expect(syncUpstreamModels).toHaveBeenCalledTimes(1)
    expect(syncUpstreamModels).toHaveBeenCalledWith(46)
    expect(wrapper.emitted('update:modelValue')).toEqual([[['grok-4.7']]])
    expect(wrapper.emitted('upstream-sync-finished')).toEqual([[]])
    wrapper.unmount()
  })

  it('keeps the public busy flag on the newer sync when an older account sync settles', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    syncUpstreamModels.mockImplementation((id: number) => (id === 1 ? first.promise : second.promise))
    const wrapper = mountSelector({ platform: 'grok', accountId: 1, modelValue: ['a-local'], showSyncButton: false })

    const firstSync = wrapper.vm.syncUpstreamModels()
    expect(wrapper.vm.isSyncingUpstream).toBe(true)

    await wrapper.setProps({ accountId: 2, modelValue: ['b-local'] })
    expect(wrapper.vm.isSyncingUpstream).toBe(false)
    const secondSync = wrapper.vm.syncUpstreamModels()
    expect(wrapper.vm.isSyncingUpstream).toBe(true)

    first.resolve({ models: ['a-private-catalog'], discovery_source: 'upstream' })
    await firstSync
    await flushPromises()
    expect(wrapper.vm.isSyncingUpstream).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('upstream-sync-finished')).toBeUndefined()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(showWarning).not.toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()

    second.resolve({ models: ['b-catalog'], discovery_source: 'upstream' })
    await secondSync
    await flushPromises()
    expect(wrapper.vm.isSyncingUpstream).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toEqual([[['b-local', 'b-catalog']]])
    expect(wrapper.emitted('upstream-sync-finished')).toEqual([[]])
    expect(showSuccess).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('still withholds configured fallback ids when the built-in trigger is hidden', async () => {
    syncUpstreamModels.mockResolvedValue({
      models: ['composer-2.5'],
      discovery_source: 'configured_fallback',
      warnings: [{ code: 'grok_model_catalog_configured_fallback', message: 'fallback' }]
    })
    const wrapper = mountSelector({ platform: 'grok', accountId: 46, modelValue: ['grok-4.7'], showSyncButton: false })
    await wrapper.vm.syncUpstreamModels()
    await flushPromises()
    expect(wrapper.find('[data-testid="sync-upstream-models"]').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(showWarning).toHaveBeenCalledWith('admin.accounts.grokModelDiagnostics.configuredFallback')
    expect(showSuccess).not.toHaveBeenCalled()
    expect(wrapper.emitted('upstream-sync-finished')).toEqual([[]])
    wrapper.unmount()
  })

  it('does not apply an older account sync to the current draft or clear its loading', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    syncUpstreamModels.mockImplementation((id: number) => (id === 1 ? first.promise : second.promise))
    const wrapper = mountSelector({ platform: 'grok', accountId: 1, modelValue: ['a-local'] })
    await syncButton(wrapper).trigger('click')
    expect((syncButton(wrapper).element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.setProps({ accountId: 2, modelValue: ['b-local'] })
    expect((syncButton(wrapper).element as HTMLButtonElement).disabled).toBe(false)
    await syncButton(wrapper).trigger('click')
    expect(syncUpstreamModels).toHaveBeenNthCalledWith(1, 1)
    expect(syncUpstreamModels).toHaveBeenNthCalledWith(2, 2)
    expect((syncButton(wrapper).element as HTMLButtonElement).disabled).toBe(true)

    first.resolve({ models: ['a-private-catalog'], discovery_source: 'upstream' })
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(showWarning).not.toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()
    expect(wrapper.emitted('upstream-sync-finished')).toBeUndefined()
    expect((syncButton(wrapper).element as HTMLButtonElement).disabled).toBe(true)

    second.resolve({ models: ['b-catalog'], discovery_source: 'upstream' })
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([[['b-local', 'b-catalog']]])
    expect(showSuccess).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('upstream-sync-finished')).toHaveLength(1)
    expect((syncButton(wrapper).element as HTMLButtonElement).disabled).toBe(false)
  })

  it('does not toast or finish an older account sync that fails during a newer sync', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    syncUpstreamModels.mockImplementation((id: number) => (id === 1 ? first.promise : second.promise))
    const wrapper = mountSelector({ platform: 'grok', accountId: 1, modelValue: ['a-local'] })
    await syncButton(wrapper).trigger('click')
    await wrapper.setProps({ accountId: 2, modelValue: ['b-local'] })
    await syncButton(wrapper).trigger('click')

    first.reject({ message: 'old account failure' })
    await flushPromises()
    expect(showError).not.toHaveBeenCalled()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('upstream-sync-finished')).toBeUndefined()
    expect((syncButton(wrapper).element as HTMLButtonElement).disabled).toBe(true)

    second.reject({ message: 'current failure' })
    await flushPromises()
    expect(showError).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('upstream-sync-finished')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect((syncButton(wrapper).element as HTMLButtonElement).disabled).toBe(false)
  })

  it('does not toast when a saved sync fails after the selector is destroyed', async () => {
    const pending = deferred<any>()
    syncUpstreamModels.mockReturnValue(pending.promise)
    const wrapper = mountSelector({ platform: 'grok', accountId: 46, modelValue: ['grok-4.7'] })
    await syncButton(wrapper).trigger('click')
    wrapper.unmount()
    pending.reject({ message: 'old account failure' })
    await flushPromises()
    expect(showError).not.toHaveBeenCalled()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(showWarning).not.toHaveBeenCalled()
  })
})
