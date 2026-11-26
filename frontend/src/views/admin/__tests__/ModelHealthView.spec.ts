import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ModelHealthView from '../ModelHealthView.vue'
import type { ModelHealthMetricsRange, ModelHealthState } from '@/api/admin/modelHealth'

const { getState, saveState, probeState, showSuccess, getGroups, updateGroup, route, replace } = vi.hoisted(() => ({
  getState: vi.fn(), saveState: vi.fn(), probeState: vi.fn(), showSuccess: vi.fn(), getGroups: vi.fn(), updateGroup: vi.fn(), route: { query: {} as Record<string, string> }, replace: vi.fn()
}))
vi.mock('@/api/admin/modelHealth', () => ({ getModelHealth: getState, saveModelHealth: saveState, probeModelHealth: probeState }))
vi.mock('@/api/admin/groups', async original => ({
  ...await original<typeof import('@/api/admin/groups')>(),
  getAllIncludingInactive: getGroups, update: updateGroup
}))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showSuccess }) }))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace }) }))
vi.mock('vue-chartjs', () => ({ Line: { props: ['data', 'options'], template: '<canvas />' } }))
vi.mock('vue-i18n', async original => ({
  ...await original<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key, te: (key: string) => !key.startsWith('admin.modelHealth.providerErrors.') || ['provider_data_unavailable', 'provider_account_changed', 'provider_model_unknown', 'provider_slow_headers', 'provider_overloaded', 'provider_high_error', 'provider_interrupted', 'provider_connection_failure'].some(error => key.endsWith('.' + error)) })
}))
const fixture = (): ModelHealthState => ({
  passive_only: true,
  settings: { revision: 'r1', enabled: true, rules: [{
    id: 'sol', name: 'Sol fallback', model: 'gpt-6.1-sol', upstream_model: '',
    primary_id: 140, backup_ids: [139], enabled: true, mode: 'auto',
    interval_seconds: 180, timeout_seconds: 25, failure_threshold: 2, recovery_threshold: 2, hold_seconds: 90
  }] },
  runtime: { sol: { route: 'backup', reason: 'primary_failed', switched_at: new Date().toISOString(),
    next_probe_at: new Date().toISOString(), probing: false, requested: false, fresh: true, error: '', observations: {
      '140': { account_id: 140, status: 'failed', successes: 0, failures: 2, latency_ms: 200, checked_at: new Date().toISOString(), error: 'model unavailable', ready: true },
      '139': { account_id: 139, status: 'healthy', successes: 2, failures: 0, latency_ms: 150, checked_at: new Date().toISOString(), error: '', ready: true }
    } } },
  accounts: [
    { id: 140, name: 'Pro', status: 'active', ready: true, schedulable: true, group_ids: [15], provider_supported: true, models: { 'gpt-6-astra': 'gpt-6-astra' } },
    { id: 139, name: 'Team', status: 'active', ready: true, schedulable: true, group_ids: [15], provider_supported: true, models: { 'gpt-6.1-sol': 'gpt-6.1-sol', 'gpt-6.1-terra': 'gpt-6.1-terra' } }
  ],
  events: [{ at: new Date().toISOString(), rule_id: 'sol', group_id: 15, type: 'switch', status: 'backup', message: 'primary_failed' }],
  error: ''
})
function createWrapper() {
  return mount(ModelHealthView, { global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true, Teleport: true } } })
}
describe('Model health administration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    route.query = { group: '15' }
    getState.mockResolvedValue(fixture())
    getGroups.mockResolvedValue([])
  })
  afterEach(() => { vi.useRealTimers() })

  it('distinguishes an upstream-only warning from a failed model on the primary', async () => {
    const value = fixture()
    value.settings.rules[0]!.group_id = 15
    const primary = value.runtime.sol!.observations['140']!
    Object.assign(primary, { status: 'healthy', error: '', high_error_advisory: true,
      local_outcomes: { as_of: new Date().toISOString(), successes: 18, failures: 0 } })
    getState.mockResolvedValue(value)
    getGroups.mockResolvedValue([{ id: 15, name: 'Pro', platform: 'openai' }])
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findAll('[role="tab"]').find(tab => tab.text() === 'admin.modelHealth.overview')!.trigger('click')
    const row = wrapper.get('tbody tr')
    expect(row.text()).toContain('admin.modelHealth.highErrorAdvisory')
    expect(row.text()).toContain('admin.modelHealth.localOutcomes')
    expect(row.find('.text-amber-600').exists()).toBe(true)
    wrapper.unmount()
  })

  it('deduplicates one group-wide 7d upstream advisory across 5 rules and separates local evidence, model card and advisory', async () => {
    const value = fixture()
    const now = new Date().toISOString()
    const baseRule = value.settings.rules[0]!
    value.settings.rules = ['gpt-6.2-sol', 'gpt-6-astra', 'gpt-6.1-terra', 'gpt-6.3-mini', 'gpt-6.4-pro'].map((model, idx) => ({
      ...baseRule, id: `rule-${idx}`, name: `Rule ${idx}`, model, group_id: 15
    }))
    value.runtime = {}
    for (const [idx, rule] of value.settings.rules.entries()) {
      value.runtime[rule.id] = {
        route: 'primary', active_account_id: 140, reason: 'primary_available',
        switched_at: null, next_probe_at: null, probing: false, requested: false, fresh: true, error: '',
        observations: {
          '140': {
            account_id: 140, status: 'healthy', successes: 2, failures: 0, latency_ms: 100,
            checked_at: now, error: '', ready: true, source: 'aihub', source_group_id: 314,
            provider_model_status: 'healthy', provider_model_at: now,
            local_outcomes: idx === 0 ? { as_of: now, successes: 5, failures: 0 } : idx === 1 ? undefined : { as_of: now, successes: 0, failures: 0 },
            local_error: idx === 1 ? 'local_outcomes_unavailable' : undefined,
            upstream_advisories: [{
              id: 'overloaded', source_group_id: 314, source_group: 'S009-Team', window: '7d',
              scope: 'all recorded models', classification: 'supplier_capacity',
              numerator: 29017, denominator: 1415390, percent: 2.05, threshold: 2, operator: '>=', long_window: true
            }]
          },
          '139': { account_id: 139, status: 'healthy', successes: 2, failures: 0, latency_ms: 100, checked_at: now, error: '', ready: true }
        }
      }
    }
    getState.mockResolvedValue(value)
    getGroups.mockResolvedValue([{ id: 15, name: 'GPT-Pro', platform: 'openai' }])
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findAll('[role="tab"]').find(tab => tab.text() === 'admin.modelHealth.overview')!.trigger('click')
    expect(wrapper.get('[data-testid="summary-rules"]').text()).toContain('5')
    expect(wrapper.get('[data-testid="summary-failed"]').text()).toContain('0')
    expect(wrapper.get('[data-testid="summary-upstream-advisories"]').text()).toContain('1')
    expect(wrapper.get('[data-testid="summary-affected-rules"]').text()).toContain('5')
    const rows = wrapper.findAll('table')[0]!.findAll('tbody tr')
    expect(rows).toHaveLength(5)
    expect(rows[0]!.get('[data-testid="primary-local-evidence"]').text()).toContain('admin.modelHealth.localOutcomes')
    expect(rows[1]!.get('[data-testid="primary-local-evidence"]').text()).toContain('admin.modelHealth.localReadFailed')
    expect(rows[2]!.get('[data-testid="primary-local-evidence"]').text()).toContain('admin.modelHealth.localNoSamples')
    expect(rows[0]!.get('[data-testid="primary-upstream-advisory"]').text()).toContain('admin.modelHealth.upstreamAdvisoryDetail')
    wrapper.unmount()
  })

  it('surfaces apply_pending on save without showing plain success and preserves new revision', async () => {
    const state = fixture()
    state.settings.rules[0]!.group_id = 15
    getState.mockResolvedValue(state)
    const pendingState = structuredClone(state)
    pendingState.settings.revision = 'r2'
    pendingState.settings.enabled = false
    pendingState.apply_pending = true
    pendingState.error = 'Could not update model routes for account 140'
    pendingState.runtime.sol!.apply_status = 'partial'
    saveState.mockResolvedValue(pendingState)
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.get('button[aria-label="admin.modelHealth.backToGroups"]').trigger('click')
    await wrapper.get('input[type="checkbox"]').setValue(false)
    await flushPromises()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('admin.modelHealth.savedApplyPending')
    expect((wrapper.vm as any).state.settings.revision).toBe('r2')
    await wrapper.get('[data-testid="health-group-15"]').trigger('click')
    await wrapper.findAll('[role="tab"]').find(tab => tab.text() === 'admin.modelHealth.overview')!.trigger('click')
    expect(wrapper.get('[data-testid="rule-apply-status"]').text()).toContain('admin.modelHealth.applyPartial')
    wrapper.unmount()
  })

  it('keeps orphan rules visible for disable/cleanup and allows clearing stale provider_groups bindings', async () => {
    const state = fixture()
    state.settings.rules[0]!.group_id = 15
    state.accounts = [state.accounts[0]!]
    state.missing_account_ids = [139]
    state.settings.provider_groups = { '140': 314, '139': 189 }
    getState.mockResolvedValue(state)
    saveState.mockImplementation(async settings => ({ ...state, settings }))
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findAll('[role="tab"]').find(tab => tab.text() === 'admin.modelHealth.overview')!.trigger('click')
    expect(wrapper.get('[data-testid="missing-channel-badge"]').text()).toContain('admin.modelHealth.missingChannelWarning')
    expect(wrapper.get('[data-testid="stale-provider-bindings"]').text()).toContain('admin.modelHealth.staleProviderBindings')
    await wrapper.get('[data-testid="disable-orphan-rule"]').trigger('click')
    await flushPromises()
    expect(saveState).toHaveBeenCalledWith(expect.objectContaining({
      rules: [expect.objectContaining({ id: 'sol', enabled: false })]
    }), '1h')
    await wrapper.get('[data-testid="clear-stale-bindings"]').trigger('click')
    await flushPromises()
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({
      provider_groups: { '140': 314 }
    }), '1h')
    wrapper.unmount()
  })

  it('starts all three tabs at the group directory, including empty groups, and keeps the tab on return', async () => {
    route.query = {}
    getGroups.mockResolvedValue([{ id: 15, name: 'West' }, { id: 16, name: 'Empty', description: 'Reserve' }])
    const wrapper = createWrapper()
    await flushPromises()
    for (const [index, tab] of wrapper.findAll('[role="tab"]').entries()) {
      await tab.trigger('click')
      expect(wrapper.get('[data-testid="health-group-16"]').text()).toContain('Reserve')
      expect(wrapper.find('[data-testid="health-channel"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Sol fallback')
      expect(wrapper.find('button.btn-primary').exists()).toBe(false)
      await wrapper.get('[data-testid="health-group-15"]').trigger('click')
      expect(replace).toHaveBeenCalledWith({ query: { group: '15' } })
      if (index === 0) expect(wrapper.findAll('[data-testid="health-channel"]')).toHaveLength(2)
      else expect(wrapper.text()).toContain('Sol fallback')
      await wrapper.get('button[aria-label="admin.modelHealth.backToGroups"]').trigger('click')
      expect(tab.attributes('aria-selected')).toBe('true')
    }
    wrapper.unmount()
  })

  it('does not adopt a legacy rule on a shared channel or mix unknown and historical owners', async () => {
    const state = fixture(), legacy = state.settings.rules[0]!, record = state.events[0]!
    state.accounts[0]!.group_ids = [15, 16]
    const west = { ...legacy, id: 'west', name: 'West only', group_id: 15 }
    const east = { ...west, id: 'east', name: 'East only', group_id: 16, backup_ids: [] }
    state.settings.rules = [legacy, west, east]
    state.events = [
      { ...record, group_id: undefined, rule_id: 'west', message: 'west-old' },
      { ...record, group_id: 15, rule_id: 'gone', rule_name: 'Retired west', message: 'west-deleted' },
      { ...record, group_id: 16, rule_id: 'west', message: 'east-at-time' },
      { ...record, group_id: undefined, message: 'unknown-shared' },
      { ...record, group_id: 0, rule_id: 'west', message: 'shared-at-time' },
      { ...record, group_id: undefined, rule_id: '', type: 'config', message: 'global-change' },
    ]
    getState.mockResolvedValue(state)
    saveState.mockImplementation(async settings => ({ ...state, settings }))
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    expect(wrapper.text()).toContain('admin.modelHealth.sharedLegacyCount')
    expect(wrapper.text()).not.toContain(legacy.name)
    expect(wrapper.text()).not.toContain(east.name)
    await wrapper.get('button[aria-label="admin.modelHealth.remove"]').trigger('click')
    await wrapper.get('[role="dialog"] .btn-danger').trigger('click')
    await flushPromises()
    expect(saveState).toHaveBeenCalledWith(expect.objectContaining({ rules: [legacy, east] }), '1h')
    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')
    expect(wrapper.text()).toContain('west-deleted')
    expect(wrapper.text()).not.toMatch(/east-at-time|shared-at-time|unknown-shared|global-change/)
    await wrapper.get('select[aria-label="admin.modelHealth.rules"]').setValue('gone')
    expect(wrapper.get('tbody').text()).toContain('Retired west')
    await wrapper.get('[data-testid="health-routing-group"]').setValue('16')
    expect(wrapper.get('tbody').text()).toContain('east-at-time')
    expect(wrapper.text()).not.toMatch(/west-deleted|unknown-shared|shared-at-time|global-change/)
    wrapper.unmount()
  })

  it('updates and clears only the selected group description and keeps an empty group after retirement', async () => {
    const west = { id: 15, name: 'West', description: 'Before' }, east = { id: 16, name: 'East', description: 'Other' }
    getGroups.mockImplementation(async () => [west, east])
    updateGroup.mockImplementation(async (_id, input) => Object.assign(west, input))
    const wrapper = createWrapper()
    await flushPromises()
    for (const text of ['Edited', '']) {
      await wrapper.get('button[aria-label="admin.modelHealth.editDescription"]').trigger('click')
      await wrapper.get('[data-testid="health-group-description"]').setValue(text)
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(updateGroup).toHaveBeenLastCalledWith(15, { description: text })
    }
    getState.mockResolvedValue({ ...fixture(), accounts: [], settings: { ...fixture().settings, rules: [] } })
    wrapper.getComponent({ name: 'SupplierRetireDialog' }).vm.$emit('retired', {})
    await flushPromises()
    expect(wrapper.get('[data-testid="health-routing-group"]').element).toHaveProperty('value', '15')
    expect(wrapper.find('[data-testid="health-channel"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="admin.modelHealth.backToGroups"]').trigger('click')
    expect(wrapper.get('[data-testid="health-group-15"]').text()).toContain('West')
    expect(wrapper.get('[data-testid="health-group-16"]').text()).toContain('Other')
    wrapper.unmount()
  })

  it('edits the same model separately in each routing group with only local account choices', async () => {
    const state = fixture()
    const west = { ...state.settings.rules[0]!, id: 'west-sol', name: 'West Sol', group_id: 15 }
    const east = { ...west, id: 'east-sol', name: 'East Sol', group_id: 16, primary_id: 141, backup_ids: [142] }
    state.settings.rules = [west, east]
    state.accounts.push(
      { ...state.accounts[0]!, id: 141, name: 'East primary', group_ids: [16] },
      { ...state.accounts[1]!, id: 142, name: 'East backup', group_ids: [16] }
    )
    getGroups.mockResolvedValue([{ id: 15, name: 'West', platform: 'openai' }, { id: 16, name: 'East', platform: 'openai' }])
    getState.mockResolvedValue(state)
    saveState.mockImplementation(async settings => ({ ...state, settings }))

    const wrapper = createWrapper()
    await flushPromises()
    const scope = wrapper.get('[data-testid="health-routing-group"]')
    await scope.setValue('16')
    expect(wrapper.find('[data-account-id="141"]').exists()).toBe(true)
    expect(wrapper.find('[data-account-id="140"]').exists()).toBe(false)
    await wrapper.findAll('[role="tab"]').find(button => button.text() === 'admin.modelHealth.overview')!.trigger('click')
    expect(wrapper.text()).toContain('East Sol')
    expect(wrapper.text()).not.toContain('West Sol')

    await wrapper.get('button[aria-label="admin.modelHealth.edit"]').trigger('click')
    const dialog = wrapper.get('[role="dialog"]')
    const primary = dialog.get<HTMLSelectElement>('[data-testid="health-draft-primary"]')
    expect(dialog.get<HTMLInputElement>('[data-testid="health-rule-group"]').element).toHaveProperty('value', 'East')
    expect(dialog.get('[data-testid="health-rule-group"]').attributes('readonly')).toBeDefined()
    expect(primary.findAll('option').map(option => option.attributes('value'))).toEqual(['0', '141', '142'])
    expect(dialog.get('[data-testid="backup-chain"] li').attributes('data-account-id')).toBe('142')
    await dialog.findAll('select').find(select => select.find('option[value="backup"]').exists())!.setValue('backup')
    await dialog.trigger('submit')
    await flushPromises()
    expect(saveState).toHaveBeenCalledWith(expect.objectContaining({
      rules: [west, expect.objectContaining({ group_id: 16, model: east.model, mode: 'backup', primary_id: 141, backup_ids: [142] })]
    }), '1h')
    await scope.setValue('15')
    expect(wrapper.text()).toContain('West Sol')
    expect(wrapper.text()).not.toContain('East Sol')
    wrapper.unmount()
  })

  it('uses only verified AIHub channels across a mixed group and preserves hidden rules on save', async () => {
    route.query = {}
    const state = fixture(), base = state.settings.rules[0]!
    const hidden = { ...base, id: 'mixed', group_id: 15, model: 'other-only', name: 'Legacy mixed', backup_ids: [151] }
    state.settings.rules.push(hidden)
    state.accounts.push({ ...state.accounts[0]!, id: 151, name: 'AIHUB lookalike', provider_supported: false, models: { 'other-only': 'other-only', shared: 'other-upstream' } })
    state.accounts[1]!.models.shared = 'real-upstream'
    state.settings.provider_groups = { '151': 314 }
    state.provider_bindings = { '151': 314 }
    state.events.push({ ...state.events[0]!, rule_id: hidden.id, rule_name: hidden.name, account_id: 151 })
    getGroups.mockResolvedValue([{ id: 15, name: 'Mixed group' }])
    getState.mockResolvedValue(state)
    saveState.mockImplementation(async settings => ({ ...state, settings }))
    const wrapper = createWrapper()
    await flushPromises()
    const group = wrapper.get('[data-testid="health-group-15"]')
    expect(group.text()).toMatch(/2\s*\/\s*2/)
    await group.trigger('click')
    expect(wrapper.findAll('[data-testid="health-channel"]').map(row => row.attributes('data-account-id')).sort()).toEqual(['139', '140'])
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    expect(wrapper.get('details').text()).toContain('shared')
    expect(wrapper.text()).not.toMatch(/AIHUB lookalike|other-only|Legacy mixed/)
    await wrapper.get('button.btn-primary').trigger('click')
    const dialog = wrapper.get('[role="dialog"]')
    const primary = dialog.get('[data-testid="health-draft-primary"]')
    expect(primary.findAll('option').map(o => o.attributes('value'))).toEqual(['0', '140', '139'])
    await primary.setValue('140')
    expect(wrapper.get<HTMLSelectElement>('[data-testid="health-draft-primary"]').element.value).toBe('140')
    expect(wrapper.get('[data-testid="add-backup"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="add-backup"]').findAll('option').map(o => o.attributes('value'))).toEqual(['', '139'])
    expect(wrapper.findAll('datalist option').map(o => o.attributes('value'))).not.toContain('other-only')
    await wrapper.get('button[aria-label="common.close"]').trigger('click')
    await wrapper.get('button[aria-label="admin.modelHealth.edit"]').trigger('click')
    await wrapper.get('[role="dialog"]').trigger('submit')
    await flushPromises()
    expect(saveState).toHaveBeenCalledWith(expect.objectContaining({ rules: [expect.objectContaining({ id: base.id }), hidden], provider_groups: { '151': 314 } }), '1h')
    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')
    expect(wrapper.text()).not.toMatch(/Legacy mixed|AIHUB lookalike/)
    wrapper.unmount()
  })

  it('requires a fresh selection if a draft channel changes upstream while the editor is open', async () => {
    const state = fixture()
    state.settings.rules[0]!.group_id = 15
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await wrapper.get('button[aria-label="admin.modelHealth.edit"]').trigger('click')
    await wrapper.get('input[list="health-upstream-models"]').setValue('edited-target')
    const changed = structuredClone(state)
    changed.accounts[1]!.provider_supported = false
    getState.mockResolvedValue(changed)
    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.get('input[list="health-upstream-models"]').element).toHaveProperty('value', 'edited-target')
    expect(dialog.get('[role="alert"]').text()).toBe('admin.modelHealth.supplierChannelRequired')
    expect(dialog.get('select[data-testid="health-draft-primary"]').element).toHaveProperty('value', '0')
    expect(dialog.find('option[value="139"]').exists()).toBe(false)
    expect(dialog.find('[data-testid="backup-chain"] li').exists()).toBe(false)
    expect(dialog.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await dialog.trigger('submit')
    expect(saveState).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows Claude in its own category with only Claude upstream choices and no GPT rule candidates', async () => {
    const state = fixture()
    state.accounts.push({
      id: 152, name: 'Claude channel', platform: 'anthropic', status: 'active', ready: true, schedulable: true,
      group_ids: [28], provider_supported: true, models: { 'claude-opus': 'claude-opus' }
    })
    state.providers = {
      source: 'aihub', generated_at: '', fetched_at: '', stale: false, error: '', accounts: {},
      catalog: [{ id: 314, code: 'Pro', platform: 'openai' }, { id: 711, code: 'Cursor', platform: 'anthropic' }]
    }
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('[data-account-id="152"]').exists()).toBe(false)
    await wrapper.get('[data-testid="health-routing-group"]').setValue('28')
    expect(wrapper.find('[data-account-id="140"]').exists()).toBe(false)
    expect(wrapper.get('[data-account-id="152"]').text()).toContain('claude-opus')
    expect(wrapper.get('[data-testid="provider-binding-152"]').findAll('option').map(option => option.attributes('value'))).toEqual(['0', '711'])
    expect(wrapper.findAll('#health-models option').map(option => option.attributes('value'))).not.toContain('claude-opus')
    wrapper.unmount()
  })

  it('uses the routed Claude catalog in both the channel summary and its expanded metrics', async () => {
    const state = fixture()
    const at = new Date().toISOString()
    const metrics = { duration_ms: 337, sample_count: 1, success_rate: 1, tps: 9, cache_hit_rate: null, effective_multiplier: null, input_price_per_million: null }
    state.accounts.push({
      id: 153, name: 'Claude channel', platform: 'anthropic', status: 'active', ready: true, schedulable: true,
      group_ids: [31], provider_supported: true, models: { 'claude-sonnet': 'claude-sonnet-upstream', 'claude-opus': 'claude-opus', '*': '*' }
    })
    state.settings.provider_groups = { '153': 729 }
    state.providers = { source: 'aihub', generated_at: at, fetched_at: at, stale: false, error: '', catalog: [], accounts: {
      '153': { group_id: 729, code: 'Kiro', platform: 'anthropic', rate_multiplier: .15, metrics, warnings: [],
        warnings_at: '', warnings_expires_at: '', model_metrics: { 'claude-sonnet-upstream': metrics },
        models: [{ model: 'claude-placeholder', probe_state: 'not_listed', health: 'insufficient', sample_count: 0 },
          { model: 'claude-sonnet-upstream', probe_state: 'enabled', health: 'healthy', sample_count: 1,
            health_evaluated_at: at, health_expires_at: new Date(Date.now() + 60000).toISOString() }] }
    } }
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.get('[data-testid="health-routing-group"]').setValue('31')
    const channel = wrapper.get('[data-account-id="153"]')
    expect(channel.findAll('.model-aliases > span').map(item => item.text())).toEqual(['claude-opus', 'claude-sonnet'])
    await channel.get('button.group-settings').trigger('click')
    const rows = channel.findAll('[data-testid="provider-signal"] tbody tr')
    expect(rows.map(row => row.get('td').text())).toEqual(['claude-opus', 'claude-sonnet'])
    expect(rows[0]!.text()).toContain('admin.modelHealth.unknown')
    expect(rows[1]!.text()).toContain('admin.modelHealth.healthy')
    expect(rows[1]!.text()).toContain('337 ms')
    wrapper.unmount()
  })

  it('offers newly listed upstream IDs without treating probe placeholders or local aliases as upstream IDs', async () => {
    const state = fixture()
    state.accounts[0]!.models = { 'public-astra': 'gpt-6-astra', 'public-*': 'private-*' }
    const pricing = (model: string) => ({ model, price: {} })
    const group = {
      group_id: 314, code: 'Pro', platform: 'openai', rate_multiplier: 1, warnings: [],
      warnings_at: '', warnings_expires_at: '', model_metrics: {},
      metrics: { duration_ms: null, sample_count: 0, success_rate: null, tps: null, cache_hit_rate: null, effective_multiplier: null, input_price_per_million: null },
      models: [{ model: 'probe-only', health: 'insufficient', sample_count: 0 }],
      supported_models: ['gpt-6.2-astra', 'gpt-6.2-sol'].map(pricing)
    }
    state.providers = { source: 'aihub', generated_at: '', fetched_at: '', stale: false, error: '', catalog: [], accounts: { '140': group } }
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    const ids = (list: string) => wrapper.findAll(`#${list} option`).map(o => o.attributes('value'))
    expect(ids('health-models')).toEqual(expect.arrayContaining(['public-astra', 'gpt-6.2-astra', 'gpt-6.2-sol']))
    expect(ids('health-models')).not.toContain('probe-only')
    expect(ids('health-models')).not.toContain('public-*')
    await wrapper.findAll('button').find(b => b.text() === 'admin.modelHealth.add')!.trigger('click')
    await wrapper.get('select[required]').setValue('140')
    expect(ids('health-upstream-models')).toEqual(['gpt-6-astra', 'gpt-6.2-astra', 'gpt-6.2-sol'])
    expect(saveState).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('refreshes health every second without flashing channel actions or overlapping a pending poll', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    const initial = getState.mock.calls.filter(args => args[0] === '1h').length
    const retire = () => wrapper.get<HTMLButtonElement>('[data-account-id="140"] .channel-retire').element
    const button = retire()
    expect(button.disabled).toBe(false)
    let finish!: (value: ModelHealthState) => void
    getState.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await vi.advanceTimersByTimeAsync(700)
    expect(getState.mock.calls.filter(args => args[0] === '1h')).toHaveLength(initial + 1)
    expect(retire().disabled).toBe(false)
    expect(wrapper.get('[data-testid="health-range-1h"]').attributes('aria-busy')).toBe('false')
    expect(wrapper.get<HTMLButtonElement>('button[aria-label="common.refresh"]').element.disabled).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(getState.mock.calls.filter(args => args[0] === '1h')).toHaveLength(initial + 1)
    const updated = fixture()
    updated.accounts[0]!.name = 'Fresh status'
    finish(updated)
    await flushPromises()
    expect(retire()).toBe(button)
    expect(wrapper.get('[data-account-id="140"] h3').text()).toBe('Fresh status')
    await vi.advanceTimersByTimeAsync(1000)
    expect(getState.mock.calls.filter(args => args[0] === '1h')).toHaveLength(initial + 2)
    wrapper.unmount()
  })

  it('locks channel actions for a write and ignores a poll that returns after the write', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(300)
    let finishPoll!: (value: ModelHealthState) => void, finishWrite!: (value: ModelHealthState) => void
    getState.mockImplementationOnce(() => new Promise(resolve => { finishPoll = resolve }))
    probeState.mockImplementationOnce(() => new Promise(resolve => { finishWrite = resolve }))
    await vi.advanceTimersByTimeAsync(700)
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await wrapper.get('button[aria-label="admin.modelHealth.probe"]').trigger('click')
    expect(probeState).toHaveBeenCalledWith('sol', '1h')
    await wrapper.findAll('[role="tab"]')[0]!.trigger('click')
    const retire = wrapper.get<HTMLButtonElement>('[data-account-id="140"] .channel-retire')
    expect(retire.element.disabled).toBe(true)
    const written = fixture()
    written.accounts[0]!.name = 'After probe'
    finishWrite(written)
    await flushPromises()
    expect(retire.element.disabled).toBe(false)
    finishPoll(fixture())
    await flushPromises()
    expect(wrapper.get('[data-account-id="140"] h3').text()).toBe('After probe')
    wrapper.unmount()
  })

  it('keeps the selected metrics range during polling, saving, probing and manual refresh', async () => {
    getState.mockImplementation(async (range: ModelHealthMetricsRange = '1h') => ({
      ...fixture(), metrics: { range, from: new Date(Date.now() - (range === '7d' ? 168 : range === '24h' ? 24 : 1) * 3600000).toISOString(), to: new Date().toISOString(), error: '', accounts: {} }
    }))
    const wrapper = createWrapper()
    await flushPromises()
    expect(getState).toHaveBeenLastCalledWith('1h')
    for (const range of ['24h', '7d'] as const) {
      await wrapper.get(`[data-testid="health-range-${range}"]`).trigger('click')
      await flushPromises()
      expect(getState).toHaveBeenLastCalledWith(range)
      expect(wrapper.get(`[data-testid="health-range-${range}"]`).attributes('aria-pressed')).toBe('true')
    }
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(getState).toHaveBeenLastCalledWith('7d')
    await wrapper.get('button[aria-label="common.refresh"]').trigger('click')
    await flushPromises()
    expect(getState).toHaveBeenLastCalledWith('7d')
    saveState.mockResolvedValue(fixture())
    await wrapper.get('button[aria-label="admin.modelHealth.backToGroups"]').trigger('click')
    await wrapper.get('input[type="checkbox"]').setValue(false)
    await flushPromises()
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }), '7d')
    probeState.mockResolvedValue(fixture())
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await wrapper.get('[data-testid="health-group-15"]').trigger('click')
    await wrapper.get('button[aria-label="admin.modelHealth.probe"]').trigger('click')
    await flushPromises()
    expect(probeState).toHaveBeenLastCalledWith('sol', '7d')
    wrapper.unmount()
  })

  it('keeps the previous range when loading fails without disabling other ranges', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    let rejectLoad!: (error: unknown) => void
    getState.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectLoad = reject }))
    await wrapper.get('[data-testid="health-range-7d"]').trigger('click')
    expect(wrapper.get('[data-testid="health-range-24h"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="health-range-7d"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('[data-testid="health-range-1h"]').attributes('aria-pressed')).toBe('true')
    await vi.advanceTimersByTimeAsync(5000)
    expect(getState.mock.calls.filter(args => args[0] === '7d')).toHaveLength(1)
    rejectLoad(new Error('network error'))
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('admin.modelHealth.requestFailed')
    expect(wrapper.get('[data-testid="health-range-1h"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="health-range-7d"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('prefetches ranges and switches cached metrics without replacing newer settings', async () => {
    let revision = 'r1'
    getState.mockImplementation(async (range: ModelHealthMetricsRange = '1h') => ({
      ...fixture(), settings: { ...fixture().settings, revision },
      metrics: { range, from: '', to: '', accounts: {}, error: '' }
    }))
    const wrapper = createWrapper()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(getState.mock.calls.map(args => args[0])).toEqual(['1h', '24h', '7d'])
    revision = 'r2'
    await wrapper.get('button[aria-label="common.refresh"]').trigger('click')
    await flushPromises()
    const calls = getState.mock.calls.length
    await wrapper.get('[data-testid="health-range-7d"]').trigger('click')
    expect(wrapper.get('[data-testid="health-range-7d"]').attributes('aria-pressed')).toBe('true')
    expect(getState).toHaveBeenCalledTimes(calls)
    expect((wrapper.vm as any).state.settings.revision).toBe('r2')
    expect((wrapper.vm as any).state.metrics.range).toBe('7d')
    wrapper.unmount()
  })

  it('uses the latest range selection when overlapping requests finish out of order', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    let resolveWeek!: (value: ModelHealthState) => void
    getState.mockImplementationOnce(() => new Promise(resolve => { resolveWeek = resolve }))
    await wrapper.get('[data-testid="health-range-7d"]').trigger('click')
    await wrapper.get('[data-testid="health-range-24h"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="health-range-24h"]').attributes('aria-pressed')).toBe('true')
    resolveWeek(fixture())
    await flushPromises()
    expect(wrapper.get('[data-testid="health-range-24h"]').attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })

  it('switches statistics freshness metadata with cached ranges', async () => {
    getState.mockImplementation(async (range: ModelHealthMetricsRange = '1h') => ({
      ...fixture(), providers: { source: 'aihub', generated_at: '', fetched_at: '', stale: false, error: '', catalog: [], accounts: {},
        metrics_range: range, metrics_stale: range === '7d' }
    }))
    const wrapper = createWrapper()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    await wrapper.get('[data-testid="health-range-7d"]').trigger('click')
    expect(wrapper.get('[role="status"]').text()).toContain('admin.modelHealth.providerMetricsStale')
    await wrapper.get('[data-testid="health-range-1h"]').trigger('click')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders published popularity through a transient feed failure and hides it at expiry', async () => {
    const state = fixture()
    state.settings.provider_groups = { '140': 314 }
    state.providers = { source: 'aihub', generated_at: '', fetched_at: '', stale: true, error: 'provider_query_failed', catalog: [], accounts: {
      '140': { group_id: 314, code: 'Pro', platform: 'openai', rate_multiplier: 1, models: [], warnings: [], model_metrics: {},
        metrics: { duration_ms: null, sample_count: 0, success_rate: null, tps: null, cache_hit_rate: null, input_price_per_million: null, effective_multiplier: null },
        popularity: { status: 'measured', fires: 4, rank: 1, groups: 10, window: '24h', expires_at: new Date(Date.now() + 2000).toISOString() } }
    } }
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.get('[data-testid="provider-popularity"]').text()).toBe('🔥'.repeat(4))
    await vi.advanceTimersByTimeAsync(2500)
    expect(wrapper.find('[data-testid="provider-popularity"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each(['not-ready', 'unschedulable', 'observation-closed', 'model-closed'])('does not mark a selected but %s channel as serving', async condition => {
    const state = fixture()
    state.runtime.sol!.active_account_id = 139
    if (condition === 'not-ready') state.accounts[1]!.ready = false
    if (condition === 'unschedulable') state.accounts[1]!.schedulable = false
    if (condition === 'observation-closed') state.runtime.sol!.observations['139']!.ready = false
    if (condition === 'model-closed') state.accounts[1]!.model_controls = { 'gpt-6.1-sol': { enabled: false, model: 'gpt-6.1-sol', rule_id: 'sol' } }
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    const roles = wrapper.get('[data-account-id="139"] [data-testid="channel-roles"]')
    expect(roles.text()).toContain('admin.modelHealth.selectedPaused')
    expect(roles.text()).not.toContain('admin.modelHealth.currentlyServing')
    state.accounts[1]!.ready = true
    state.accounts[1]!.schedulable = true
    state.runtime.sol!.observations['139']!.ready = true
    state.accounts[1]!.model_controls = { 'gpt-6.1-sol': { enabled: true, model: 'gpt-6.1-sol', rule_id: 'sol' } }
    getState.mockResolvedValue(structuredClone(state))
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(roles.text()).toContain('admin.modelHealth.currentlyServing')
    expect(roles.text()).not.toContain('admin.modelHealth.selectedPaused')
    wrapper.unmount()
  })

  it.each([
    ['provider_auth_required', 'providerAuthRequired'], ['provider_http_401', 'providerAuthRequired'],
    ['provider_auth_failed', 'providerAuthFailed'], ['provider_access_denied', 'providerAccessDenied'],
    ['provider_credentials_unavailable', 'providerCredentialsUnavailable']
  ])('explains %s in the dashboard and channel details', async (error, label) => {
    const state = fixture()
    state.settings.provider_groups = { '140': 314 }
    state.providers = { source: 'aihub', generated_at: '', fetched_at: '', stale: true, error, catalog: [], accounts: {} }
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('admin.modelHealth.' + label)
    expect(wrapper.get('[data-testid="provider-signal"]').text()).toContain('admin.modelHealth.' + label)
    wrapper.unmount()
  })

  it('keeps fresh model health visible while reporting statistics cache refresh separately', async () => {
    const state = fixture()
    const now = Date.now()
    state.settings.provider_groups = { '140': 314 }
    state.providers = { source: 'aihub', generated_at: new Date(now - 600000).toISOString(), fetched_at: new Date(now).toISOString(), stale: false, metrics_stale: true, error: '', catalog: [], accounts: {
      '140': { group_id: 314, code: 'Pro', platform: 'openai', rate_multiplier: 1, available: true, probe_expires_at: new Date(now + 60000).toISOString(),
        models: [{ model: 'gpt-6.1-sol', health: 'healthy', sample_count: 5, health_evaluated_at: new Date(now).toISOString(), health_expires_at: new Date(now + 60000).toISOString() }],
        warnings: [], warnings_at: '', warnings_expires_at: '', model_metrics: {},
        metrics: { duration_ms: null, sample_count: 0, success_rate: null, tps: null, cache_hit_rate: null, input_price_per_million: null, effective_multiplier: null } }
    } }
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('admin.modelHealth.providerMetricsStale')
    expect(wrapper.get('[role="status"]').text()).not.toContain('admin.modelHealth.providerStale')
    const channel = wrapper.get('[data-account-id="140"]')
    expect(channel.get('.model-aliases .model-healthy').exists()).toBe(true)
    expect(channel.get('[data-testid="provider-signal"]').text()).toContain('admin.modelHealth.healthy')
    await vi.advanceTimersByTimeAsync(61000)
    expect(channel.find('.model-aliases .model-healthy').exists()).toBe(false)
    expect(channel.get('[data-testid="provider-signal"]').text()).toContain('admin.modelHealth.stale')
    wrapper.unmount()
  })

  it('separates healthy upstream status from a locally closed CPR channel', async () => {
    const state = fixture()
    state.settings.provider_groups = { '139': 189 }
    state.accounts[1]!.ready = false
    state.accounts[1]!.schedulable = false
    state.runtime.sol!.active_account_id = 139
    state.providers = { source: 'aihub', generated_at: new Date().toISOString(), fetched_at: new Date().toISOString(), stale: false, error: '', catalog: [], accounts: {
      '139': { group_id: 189, code: 'Team', platform: 'openai', rate_multiplier: .1, available: true, probe_expires_at: new Date(Date.now() + 60000).toISOString(),
        models: [{ model: 'gpt-6.1-sol', health: 'healthy', sample_count: 5, health_expires_at: new Date(Date.now() + 60000).toISOString() }],
        warnings: [], warnings_at: '', warnings_expires_at: '', model_metrics: {},
        metrics: { duration_ms: null, sample_count: 0, success_rate: null, tps: null, cache_hit_rate: null, input_price_per_million: null, effective_multiplier: null } }
    } }
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    const channel = wrapper.get('[data-account-id="139"]')
    expect(channel.get('[data-testid="group-probe-status"]').text()).toBe('admin.modelHealth.groupProbeOk')
    expect(channel.get('.status-cell').text()).not.toContain('admin.modelHealth.hallAvailable')
    expect(channel.get('[data-testid="local-unavailable"]').text()).toContain('admin.modelHealth.localUnavailable')
    expect(channel.get('.model-aliases').text()).toContain('admin.modelHealth.blocked')
    expect(channel.get('[data-testid="channel-roles"]').text()).not.toContain('admin.modelHealth.currentlyServing')
    wrapper.unmount()
  })

  it('opens on the channel dashboard with real metrics and effective model switches', async () => {
    const state = fixture()
    state.accounts[0]!.model_controls = { 'gpt-6.1-sol': { enabled: false, model: 'gpt-6.1-sol', rule_id: 'sol' } }
    state.metrics = { from: new Date(Date.now() - 3600000).toISOString(), to: new Date().toISOString(), error: '', accounts: {
      '140': { successes: 9, errors: 1, cache_hit_rate: .8, success_rate: .9, tps: 31.6, tps_samples: 9,
        duration_ms: 11204, duration_samples: 9, cost_per_million: .07, effective_multiplier: .03,
        points: [{ at: new Date().toISOString(), duration_ms: 11204, successes: 9, errors: 1 }] }
    } }
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.findAll('[role="tab"]')[0]!.attributes('aria-selected')).toBe('true')
    const channels = wrapper.findAll('[data-testid="health-channel"]')
    expect(channels).toHaveLength(2)
    expect(channels[0]!.text()).toContain('80%')
    expect(channels[0]!.text()).toContain('90%')
    expect(channels[0]!.text()).toContain('31.6')
    expect(channels[0]!.text()).toContain('gpt-6.1-sol · admin.modelHealth.blocked')
    expect(channels[1]!.text()).toContain('admin.modelHealth.noSamples')
    expect(channels[1]!.text()).not.toContain('100%')
    await wrapper.get('input[type="search"]').setValue('Team')
    expect(wrapper.findAll('[data-testid="health-channel"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows per-model routes and refreshes passive metrics without pending a probe', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    expect(wrapper.text()).toContain('gpt-6.1-sol')
    expect(wrapper.text()).toContain('admin.modelHealth.routes.backup')
    expect(wrapper.text()).toContain('model unavailable')
    probeState.mockResolvedValue(fixture())
    await wrapper.get('button[aria-label="admin.modelHealth.probe"]').trigger('click')
    await flushPromises()
    expect(probeState).toHaveBeenCalledWith('sol', '1h')
    expect(wrapper.get('button[aria-label="admin.modelHealth.probe"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('admin.modelHealth.passive')
    expect(wrapper.text()).not.toContain('admin.modelHealth.nextProbe')
    expect(wrapper.text()).not.toContain('admin.modelHealth.streak')
    wrapper.unmount()
  })
  it.each(['overloaded', 'high_error', 'interrupted', 'connection_failure'])('shows the %s handoff reason and recovery status without changing channel settings', async (warning) => {
    const state = fixture()
    state.runtime.sol!.reason = 'primary_upstream_' + warning
    state.runtime.sol!.observations['140']!.error = 'provider_' + warning
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    expect(wrapper.text()).toContain('admin.modelHealth.reasons.primary_upstream_' + warning)
    expect(wrapper.text()).toContain('admin.modelHealth.providerErrors.provider_' + warning)
    expect(saveState).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('opens the rule editor when a monitored channel has no groups', async () => {
    const state = fixture()
    state.accounts.push({ id: 151, name: 'Unassigned', status: 'active', ready: false, schedulable: false, group_ids: null, provider_supported: true, models: {} })
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await wrapper.get('button[aria-label="admin.modelHealth.edit"]').trigger('click')
    const addBackup = wrapper.get('[role="dialog"]').get('[data-testid="add-backup"]')
    expect(addBackup.find('option[value="151"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('preserves the backup hold draft and hides retired probe settings', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await wrapper.get('button[aria-label="admin.modelHealth.edit"]').trigger('click')
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).not.toContain('admin.modelHealth.interval')
    expect(dialog.text()).not.toContain('admin.modelHealth.timeout')
    expect(dialog.text()).not.toContain('admin.modelHealth.failureThreshold')
    await dialog.findAll('input[type="number"]')[0]!.setValue(120)
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(dialog.findAll('input[type="number"]')[0]!.element).toHaveProperty('value', '120')
    saveState.mockResolvedValue(fixture())
    await dialog.trigger('submit')
    await flushPromises()
    expect(saveState).toHaveBeenCalledWith(expect.objectContaining({ revision: 'r1', rules: [expect.objectContaining({ hold_seconds: 120, interval_seconds: 180, primary_id: 140, backup_ids: [139] })] }), '1h')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('keeps the editor open on revision conflicts', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await wrapper.get('button[aria-label="admin.modelHealth.edit"]').trigger('click')
    saveState.mockRejectedValue({ response: { data: { message: 'Configuration changed' } } })
    await wrapper.get('[role="dialog"]').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="dialog"] [role="alert"]').text()).toBe('Configuration changed')
    wrapper.unmount()
  })
  it('saves per-account provider bindings without changing routing rules or other bindings', async () => {
    const state = fixture()
    state.accounts[0]!.provider_supported = true
    state.settings.provider_groups = { '139': 189 }
    state.providers = { source: 'aihub', generated_at: new Date().toISOString(), fetched_at: new Date().toISOString(),
      stale: false, error: '', catalog: [{ id: 314, code: 'S045-Pro', platform: 'openai' }], accounts: {} }
    getState.mockResolvedValue(state)
    saveState.mockImplementation(async settings => ({ ...state, settings }))
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.get('[data-testid="provider-binding-140"]').setValue('314')
    await flushPromises()
    expect(saveState).toHaveBeenCalledWith(expect.objectContaining({
      revision: 'r1', enabled: true, rules: state.settings.rules, provider_groups: { '139': 189, '140': 314 }
    }), '1h')
    expect(wrapper.text()).toContain('AIHub')
    await wrapper.get('[data-testid="provider-binding-140"]').setValue('0')
    await flushPromises()
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ provider_groups: { '139': 189 } }), '1h')
    wrapper.unmount()
  })
  it('uses upstream metrics for a bound channel and marks expired health as stale', async () => {
    const state = fixture()
    state.settings.provider_groups = { '140': 314 }
    state.providers = { source: 'aihub', generated_at: new Date().toISOString(), fetched_at: new Date().toISOString(),
      stale: false, error: '', catalog: [], accounts: { '140': {
        group_id: 314, code: 'S045-Pro', platform: 'openai', rate_multiplier: .1,
        models: [{ model: 'gpt-6.1-sol', health: 'healthy', sample_count: 5, health_expires_at: new Date(Date.now() - 1000).toISOString() }],
        warnings: [{ id: 'slow_response', status: 'partial', partial: true, triggers: [] }],
        warnings_at: new Date().toISOString(), warnings_expires_at: new Date(Date.now() + 60000).toISOString(),
        metrics: { duration_ms: 12345, sample_count: 500, success_rate: .97, tps: 42.1, cache_hit_rate: .94,
          input_price_per_million: .08, effective_multiplier: .04 }, model_metrics: {}
      } } }
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    const channel = wrapper.findAll('[data-testid="health-channel"]')[0]!
    expect(channel.text()).toContain('94%')
    expect(channel.text()).toContain('97%')
    expect(channel.text()).toContain('42.1')
    expect(channel.get('[data-testid="provider-signal"]').text()).toContain('admin.modelHealth.stale')
    expect(channel.get('[data-testid="provider-signal"]').text()).toContain('S045-Pro')
    wrapper.unmount()
  })
  it('deletes a rule and filters switch history', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await wrapper.get('button[aria-label="admin.modelHealth.remove"]').trigger('click')
    saveState.mockResolvedValue({ ...fixture(), settings: { revision: 'r2', enabled: true, rules: [] }, runtime: {} })
    await wrapper.get('[role="dialog"] .btn-danger').trigger('click')
    await flushPromises()
    expect(saveState).toHaveBeenCalledWith(expect.objectContaining({ rules: [] }), '1h')
    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')
    expect(wrapper.get('tbody').text()).toContain('admin.modelHealth.reasons.primary_failed')
    wrapper.unmount()
  })
  it('automatically lists a newly added channel without requiring a routing rule', async () => {
    const state = fixture()
    state.accounts.push({ id: 121, name: 'IMAGE', status: 'active', ready: true, schedulable: true, group_ids: [16], models: {} })
    state.accounts.push({ id: 129, name: 'cpr-local-1', status: 'active', ready: true, schedulable: true, group_ids: [16], models: {} })
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="health-channel"]')).toHaveLength(2)
    state.accounts.push({ id: 142, name: 'New Pro2', status: 'active', ready: true, schedulable: true, group_ids: [15], models: {}, provider_supported: true })
    getState.mockResolvedValue(structuredClone(state))
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    const channel = wrapper.get('[data-testid="health-channel"][data-account-id="142"]')
    expect(wrapper.findAll('[data-testid="health-channel"]')).toHaveLength(3)
    expect(channel.text()).toContain('New Pro2')
    expect(channel.get('[data-testid="provider-unbound"]').text()).toContain('admin.modelHealth.providerUnbound')
    expect(channel.get('[data-testid="channel-roles"]').text()).toContain('admin.modelHealth.monitorOnly')
    expect(channel.find('[data-testid="provider-binding-142"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('cpr-local-1')
    expect(wrapper.text()).not.toContain('IMAGE')
    await wrapper.get('button[aria-label="admin.modelHealth.edit · Sol fallback"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).not.toContain('cpr-local-1')
    expect(wrapper.get('[role="dialog"]').text()).not.toContain('IMAGE')
    expect(saveState).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('uses the same compact row for an unbound channel and exposes its real header warning in the popup', async () => {
    const state = fixture(), checkedAt = new Date().toISOString()
    state.accounts[0]!.provider_supported = true
    state.settings.rules[0]!.header_policy = { enabled: true, wait_seconds: 180, rate_percent: 2, min_samples: 10, window_minutes: [5, 60] }
    state.runtime.sol!.headers = { '140': {
      checked_at: checkedAt, warning: true, enough_samples: true, slow_observed: true,
      windows: [{ minutes: 60, requests: 100, slow: 3, rate: .03, enough_samples: true,
        partial: true, observed_seconds: 3000, warning: true }]
    } }
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    const row = wrapper.get('[data-testid="health-channel"][data-account-id="140"]')
    expect(row.attributes('data-metrics-source')).toBe('local')
    expect(row.classes()).toContain('provider-row')
    expect(row.find('.channel-head').exists()).toBe(false)
    expect(row.findAll('.metric-ring')).toHaveLength(3)
    expect(row.get('details.channel-details').attributes('open')).toBeUndefined()
    expect(row.find('.group-reputation a').exists()).toBe(false)
    await row.get('[data-testid="provider-warning-local"]').trigger('click')
    await flushPromises()
    const popup = wrapper.get('[data-testid="provider-warning-popup"]')
    expect(popup.attributes('data-metrics-source')).toBe('local')
    expect(popup.text()).toContain('admin.modelHealth.localRequests')
    expect(popup.text()).toContain('3% ≥ 2%')
    expect(popup.text()).toContain('3 / 100')
    expect(popup.text()).toContain('gpt-6.1-sol')
    const groupSettings = row.findAll('button').find(button => button.text() === 'admin.modelHealth.groupSettings')!
    await groupSettings.trigger('click')
    expect(groupSettings.attributes('aria-expanded')).toBe('true')
    expect(row.get('details.channel-details').attributes('open')).toBeDefined()
    expect(row.find('[data-testid="provider-binding-140"]').exists()).toBe(true)
    expect(saveState).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('numbers and reorders the backup chain and submits that exact order', async () => {
    const state = fixture()
    state.accounts.push({ id: 141, name: 'Pro Astra', status: 'active', ready: true, schedulable: true, group_ids: [15], provider_supported: true, models: {} })
    state.accounts.push({ id: 142, name: 'Pro2', status: 'active', ready: true, schedulable: true, group_ids: [15], provider_supported: true, models: {} })
    state.providers = { source: 'aihub', generated_at: '', fetched_at: '', stale: false, error: '', catalog: [], accounts: {
      '142': { group_id: 516, code: 'Pro2', platform: 'openai', catalog_known: true, rate_multiplier: .2,
        supported_models: [{ model: 'gpt-6.1-sol', price: { input_per_million: null, cache_input_per_million: null, output_per_million: null, cache_write_per_million: null } }],
        models: [], warnings: [], warnings_at: '', warnings_expires_at: '', model_metrics: {},
        metrics: { duration_ms: null, sample_count: 0, success_rate: null, tps: null, cache_hit_rate: null, input_price_per_million: null, effective_multiplier: null } }
    } }
    state.settings.rules[0]!.backup_ids = [139, 141]
    state.runtime.sol!.active_account_id = 141
    getState.mockResolvedValue(state)
    saveState.mockImplementation(async settings => ({ ...state, settings }))
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.get('[data-account-id="141"] [data-testid="channel-roles"]').text()).toContain('admin.modelHealth.currentlyServing')
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await wrapper.get('button[aria-label="admin.modelHealth.edit"]').trigger('click')
    expect(wrapper.findAll('[data-testid="backup-chain"] li').map(item => item.attributes('data-account-id'))).toEqual(['139', '141'])
    await wrapper.get('button[aria-label="admin.modelHealth.moveUp #141"]').trigger('click')
    await wrapper.get('[data-testid="add-backup"]').setValue('142')
    expect(wrapper.findAll('[data-testid="backup-chain"] li').map(item => item.attributes('data-account-id'))).toEqual(['141', '139', '142'])
    await wrapper.get('[role="dialog"]').trigger('submit')
    await flushPromises()
    expect(saveState).toHaveBeenCalledWith(expect.objectContaining({ rules: [expect.objectContaining({ backup_ids: [141, 139, 142] })] }), '1h')
    wrapper.unmount()
  })

  it('hides exact account 147 from the health board and rule candidate lists', async () => {
    const state = fixture()
    state.accounts.push({ id: 147, name: 'S067-Pro-3-Fast', status: 'active', ready: true, schedulable: true, group_ids: [15], provider_supported: true, models: { 'gpt-6.1-sol': 'gpt-6.1-sol' } })
    state.accounts.push({ id: 145, name: 'AIHUB---S064-Plus-3/astra/sol', status: 'active', ready: true, schedulable: true, group_ids: [15], provider_supported: true, models: { 'gpt-6-astra': 'gpt-6-astra' } })
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('[data-account-id="147"]').exists()).toBe(false)
    expect(wrapper.find('[data-account-id="140"]').exists()).toBe(true)
    expect(wrapper.find('[data-account-id="139"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('S067-Pro-3-Fast')
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await wrapper.get('button.btn-primary').trigger('click')
    const optionValues = wrapper.findAll('select option').map(option => option.attributes('value'))
    expect(optionValues).not.toContain('147')
    expect(wrapper.text()).not.toContain('S067-Pro-3-Fast')
    wrapper.unmount()
  })

  it('shows a group-probe abnormal label while per-model health stays healthy', async () => {
    const state = fixture()
    vi.setSystemTime(new Date('2026-11-17T10:40:34.000Z'))
    const now = '2026-11-17T10:40:34.000Z'
    const emptyMetrics = { duration_ms: null, sample_count: 0, success_rate: null, tps: null, cache_hit_rate: null, input_price_per_million: null, effective_multiplier: null }
    state.accounts = [{
      id: 145, name: 'AIHUB---S064-Plus-3/astra/sol', status: 'active', ready: true, schedulable: true,
      group_ids: [15], provider_supported: true, models: { 'gpt-6-astra': 'gpt-6-astra', 'gpt-6.1-sol': 'gpt-6.1-sol' },
    }]
    state.provider_bindings = { '145': 470 }
    state.settings.rules[0]!.primary_id = 145
    state.settings.rules[0]!.backup_ids = []
    state.providers = {
      source: 'aihub', generated_at: now, fetched_at: now, stale: false, metrics_stale: false, error: '', catalog: [],
      accounts: { '145': {
        group_id: 470, code: 'S064-Plus-3', platform: 'openai', rate_multiplier: 1, available: false,
        probe_expires_at: '2026-11-17T10:42:55.000Z', warnings: [], warnings_at: now, warnings_expires_at: '2026-11-17T10:42:55.000Z',
        metrics: emptyMetrics, model_metrics: {},
        models: [{
          model: 'gpt-6-astra', alias: 'Astra', health: 'healthy', probe_state: 'enabled', sample_count: 5,
          health_evaluated_at: now, health_expires_at: '2026-11-17T10:41:37.000Z',
        }],
      } },
    }
    getState.mockResolvedValue(state)
    const wrapper = createWrapper()
    await flushPromises()
    const row = wrapper.get('[data-account-id="145"]')
    expect(row.get('[data-testid="group-probe-status"]').text()).toBe('admin.modelHealth.groupProbeAbnormal')
    expect(row.get('[data-testid="group-probe-status"]').attributes('title')).toBe('admin.modelHealth.groupProbeAbnormalHint')
    expect(row.text()).not.toContain('admin.modelHealth.hallUnavailable')
    expect(row.text()).toContain('Astra')
    expect(row.get('.model-healthy').text()).toContain('Astra')
    wrapper.unmount()
  })

  it('counts summary-failed from local_outcomes independently of card status', async () => {
    const now = '2026-11-24T12:00:00.000Z'
    vi.setSystemTime(new Date(now))
    getGroups.mockResolvedValue([{ id: 15, name: 'Pro', platform: 'openai' }])

    // Card failed, local outcomes empty -> 0 local confirmed failures.
    const cardFailedOnly = fixture()
    cardFailedOnly.settings.rules[0]!.group_id = 15
    Object.assign(cardFailedOnly.runtime.sol!.observations['140']!, {
      status: 'failed',
      local_outcomes: { as_of: now, successes: 0, failures: 0 }
    })
    getState.mockResolvedValue(cardFailedOnly)
    const w1 = createWrapper()
    await flushPromises()
    await w1.findAll('[role="tab"]')[1]!.trigger('click')
    expect(w1.get('[data-testid="summary-failed"]').text()).toContain('0')
    w1.unmount()

    // Card healthy, local outcomes confirmed failed -> 1 local confirmed failure.
    const localFailedOnly = fixture()
    localFailedOnly.settings.rules[0]!.group_id = 15
    Object.assign(localFailedOnly.runtime.sol!.observations['140']!, {
      status: 'healthy',
      error: '',
      local_outcomes: { as_of: now, successes: 0, failures: 2, last_failure: now }
    })
    getState.mockResolvedValue(localFailedOnly)
    const w2 = createWrapper()
    await flushPromises()
    await w2.findAll('[role="tab"]')[1]!.trigger('click')
    expect(w2.get('[data-testid="summary-failed"]').text()).toContain('1')
    w2.unmount()
  })

  it('surfaces and removes unowned legacy orphan rules when all referenced accounts are deleted', async () => {
    route.query = {}
    const state = fixture()
    state.accounts = []
    state.missing_account_ids = [139, 140]
    state.settings.rules[0]!.group_id = 0
    getGroups.mockResolvedValue([{ id: 15, name: 'West', platform: 'openai' }])
    getState.mockResolvedValue(state)
    saveState.mockImplementation(async settings => ({ ...state, settings }))

    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    const orphanPanel = wrapper.get('[data-testid="unowned-orphan-rules"]')
    expect(orphanPanel.text()).toContain('Sol fallback')

    await orphanPanel.get('button[aria-label="admin.modelHealth.remove Sol fallback"]').trigger('click')
    await wrapper.get('[role="dialog"] .btn-danger').trigger('click')
    await flushPromises()
    expect(saveState).toHaveBeenCalledWith(expect.objectContaining({ rules: [] }), '1h')
    wrapper.unmount()
  })

})
