import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import type { AdminGroup } from '@/types'
import GroupModelsModal from '../GroupModelsModal.vue'

const mocks = vi.hoisted(() => ({ getById: vi.fn(), getModelAllowlistCandidates: vi.fn(), syncUpstreamModels: vi.fn(), saveModelAllowlist: vi.fn(), showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }))
vi.mock('@/api/admin', () => ({ adminAPI: { groups: mocks } }))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
enableAutoUnmount(afterEach)
const group = { id: 7, name: 'ALL', platform: 'composite', updated_at: '2026-10-08T06:00:00Z', model_allowlist: { enabled: true, models: ['keep', 'remove'] } } as AdminGroup

function mountModels() {
  return mount(GroupModelsModal, {
    props: { show: true, group },
    global: { stubs: { BaseDialog: { props: ['show'], template: '<div v-if="show"><slot /><slot name="footer" /></div>' }, Icon: true } },
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getById.mockResolvedValue(group)
  mocks.getModelAllowlistCandidates.mockResolvedValue(['keep', 'remove', 'new'])
})

describe('group model management', () => {
  it('syncs once, shows partial failures and selects imported models', async () => {
    let finish!: (result: unknown) => void
    mocks.syncUpstreamModels.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const wrapper = mountModels()
    await flushPromises()
    await wrapper.get('[data-testid="sync-models"]').trigger('click')
    expect(wrapper.get('[data-testid="sync-models"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="sync-models"]').trigger('click')
    expect(mocks.syncUpstreamModels).toHaveBeenCalledTimes(1)
    finish({ group_id: 7, model_allowlist: { enabled: true, models: ['keep', 'remove', 'new'] }, updated_at: 'next', discovered: ['new'], added: ['new'], accounts_total: 2, accounts_succeeded: 1, accounts_failed: 1, accounts_skipped: 0, failures: [{ account_id: 2, account_name: 'Failed upstream', message: 'upstream HTTP 401' }] })
    await flushPromises()
    expect((wrapper.get('[data-model="new"] input').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.get('[data-testid="sync-report"]').text()).toContain('Failed upstream')
    expect(wrapper.get('[data-testid="sync-report"]').text()).toContain('401')
    expect(mocks.showSuccess).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="save-models"]').attributes('disabled')).toBeDefined()
  })

  it('removes only search results and saves with a revision before another sync', async () => {
    mocks.saveModelAllowlist.mockResolvedValue({ ...group, updated_at: 'next', model_allowlist: { enabled: true, models: ['keep'], excluded_models: ['remove'] } })
    const wrapper = mountModels()
    await flushPromises()
    await wrapper.get('input[type="search"]').setValue('remove')
    await wrapper.get('[data-testid="remove-visible"]').trigger('click')
    expect(wrapper.get('[data-testid="sync-models"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="save-models"]').trigger('click')
    await flushPromises()
    expect(mocks.saveModelAllowlist).toHaveBeenCalledWith(7, { enabled: true, models: ['keep'], excluded_models: ['remove'] }, group.updated_at)
    expect((wrapper.get('[data-model="remove"] input').element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.get('[data-testid="sync-models"]').attributes('disabled')).toBeUndefined()
  })

  it('shows wildcard coverage, persists a concrete removal through refresh, and restores it explicitly', async () => {
    const wildcard = { ...group, model_allowlist: { enabled: true, models: ['*'] } }
    mocks.getById.mockResolvedValue(wildcard)
    const policy = { enabled: true, models: ['*', 'keep', 'new'], excluded_models: ['remove'] }
    mocks.saveModelAllowlist.mockResolvedValue({ ...group, updated_at: 'next', model_allowlist: policy })
    mocks.syncUpstreamModels.mockResolvedValue({ group_id: 7, model_allowlist: policy, updated_at: 'next', discovered: ['keep', 'remove', 'new'], added: [], accounts_total: 1, accounts_succeeded: 1, accounts_failed: 0, accounts_skipped: 0, failures: [] })
    const wrapper = mountModels()
    await flushPromises()
    expect((wrapper.get('[data-model="remove"] input').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.get('[data-testid="save-models"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-model="remove"] input').setValue(false)
    await wrapper.get('[data-testid="save-models"]').trigger('click')
    await flushPromises()
    expect(mocks.saveModelAllowlist).toHaveBeenLastCalledWith(7, policy, group.updated_at)
    await wrapper.get('[data-testid="sync-models"]').trigger('click')
    await flushPromises()
    expect((wrapper.get('[data-model="remove"] input').element as HTMLInputElement).checked).toBe(false)
    await wrapper.get('[data-model="remove"] input').setValue(true)
    await wrapper.get('[data-testid="save-models"]').trigger('click')
    await flushPromises()
    expect(mocks.saveModelAllowlist).toHaveBeenLastCalledWith(7, { enabled: true, models: ['*', 'keep', 'new', 'remove'] }, 'next')
  })

  it('can replace a wildcard with the visible concrete subset', async () => {
    mocks.getById.mockResolvedValue({ ...group, model_allowlist: { enabled: true, models: ['*'] } })
    const policy = { enabled: true, models: ['keep', 'new'], excluded_models: ['*', 'remove'] }
    mocks.saveModelAllowlist.mockResolvedValue({ ...group, model_allowlist: policy })
    const wrapper = mountModels()
    await flushPromises()
    await wrapper.get('[data-model="*"] input').setValue(false)
    await wrapper.get('[data-model="remove"] input').setValue(false)
    await wrapper.get('[data-testid="save-models"]').trigger('click')
    await flushPromises()
    expect(mocks.saveModelAllowlist).toHaveBeenCalledWith(7, policy, group.updated_at)
    expect((wrapper.get('[data-model="keep"] input').element as HTMLInputElement).checked).toBe(true)
    expect((wrapper.get('[data-model="*"] input').element as HTMLInputElement).checked).toBe(false)
  })

  it('keeps a failed save editable and does not report success for total sync failure', async () => {
    mocks.syncUpstreamModels.mockResolvedValue({ group_id: 7, model_allowlist: group.model_allowlist, updated_at: group.updated_at, discovered: [], added: [], accounts_total: 1, accounts_succeeded: 0, accounts_failed: 1, accounts_skipped: 0, failures: [] })
    const wrapper = mountModels()
    await flushPromises()
    await wrapper.get('[data-testid="sync-models"]').trigger('click')
    await flushPromises()
    expect(mocks.showSuccess).not.toHaveBeenCalled()
    expect(mocks.showWarning).toHaveBeenCalledOnce()
    mocks.saveModelAllowlist.mockRejectedValue(new Error('conflict'))
    await wrapper.get('[data-model="remove"] input').setValue(false)
    await wrapper.get('[data-testid="save-models"]').trigger('click')
    await flushPromises()
    expect(mocks.showError).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="save-models"]').attributes('disabled')).toBeUndefined()
  })

  it('does not apply an old sync response after switching groups', async () => {
    let finish!: (result: unknown) => void
    mocks.syncUpstreamModels.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const wrapper = mountModels()
    await flushPromises()
    await wrapper.get('[data-testid="sync-models"]').trigger('click')
    const other = { ...group, id: 8, model_allowlist: { enabled: true, models: ['other'] } }
    mocks.getById.mockResolvedValue(other)
    mocks.getModelAllowlistCandidates.mockResolvedValue(['other'])
    await wrapper.setProps({ group: other })
    await flushPromises()
    finish({ group_id: 7, model_allowlist: { enabled: true, models: ['wrong-group'] }, updated_at: 'next', discovered: ['wrong-group'], added: [], accounts_total: 1, accounts_succeeded: 1, accounts_failed: 0, accounts_skipped: 0, failures: [] })
    await flushPromises()
    expect(wrapper.find('[data-model="wrong-group"]').exists()).toBe(false)
    expect(wrapper.find('[data-model="other"]').exists()).toBe(true)
  })
})
