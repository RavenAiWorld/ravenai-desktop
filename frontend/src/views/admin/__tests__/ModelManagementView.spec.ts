import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import type { AdminGroup } from '@/types'
import ModelManagementView from '../ModelManagementView.vue'

const mocks = vi.hoisted(() => ({
  getAllIncludingInactive: vi.fn(), getById: vi.fn(), getModelAllowlistCandidates: vi.fn(),
  syncUpstreamModels: vi.fn(), saveModelAllowlist: vi.fn(),
  showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(),
}))
vi.mock('@/api/admin', () => ({ adminAPI: { groups: mocks } }))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/components/layout/AppLayout.vue', () => ({ default: { template: '<main><slot /></main>' } }))
enableAutoUnmount(afterEach)

const all = { id: 8, name: 'All', platform: 'composite', updated_at: '2026-10-08T06:00:00Z', model_allowlist: { enabled: true, models: ['keep', 'remove'] } } as AdminGroup
const other = { ...all, id: 9, name: 'Other', model_allowlist: { enabled: true, models: ['other-model'] } } as AdminGroup
const render = () => mount(ModelManagementView, { global: { stubs: { Icon: true, RouterLink: { template: '<a><slot /></a>' } } } })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getAllIncludingInactive.mockResolvedValue([other, all])
  mocks.getById.mockImplementation((id: number) => Promise.resolve(id === all.id ? all : other))
  mocks.getModelAllowlistCandidates.mockResolvedValue(['keep', 'remove', 'other-model'])
})

describe('standalone model management', () => {
  it('opens ALL directly with inline sync and save controls', async () => {
    const view = render()
    await flushPromises()
    expect((view.get('#model-manager-group').element as HTMLSelectElement).value).toBe('8')
    expect(mocks.getById).toHaveBeenCalledWith(8)
    expect(view.find('[role="dialog"]').exists()).toBe(false)
    expect(view.find('[data-testid="save-models"]').exists()).toBe(true)
    mocks.syncUpstreamModels.mockResolvedValue({ group_id: 8, model_allowlist: all.model_allowlist, updated_at: all.updated_at, discovered: ['keep', 'remove'], added: [], accounts_total: 1, accounts_succeeded: 1, accounts_failed: 0, accounts_skipped: 0, failures: [] })
    await view.get('[data-testid="sync-models"]').trigger('click')
    await flushPromises()
    expect(mocks.syncUpstreamModels).toHaveBeenCalledWith(8)
    expect(view.find('[data-testid="sync-report"]').exists()).toBe(true)
  })

  it('keeps group selection locked until an edit is saved, then loads the next group', async () => {
    const view = render()
    await flushPromises()
    await view.get('[data-model="remove"] input').setValue(false)
    expect(view.get('#model-manager-group').attributes('disabled')).toBeDefined()
    expect(view.text()).toContain('admin.groups.modelManager.saveBeforeSwitch')
    let finish!: (result: AdminGroup) => void
    mocks.saveModelAllowlist.mockReturnValue(new Promise(resolve => { finish = resolve }))
    await view.get('[data-testid="save-models"]').trigger('click')
    expect(view.get('#model-manager-group').attributes('disabled')).toBeDefined()
    expect(mocks.saveModelAllowlist).toHaveBeenCalledWith(8, { enabled: true, models: ['keep'], excluded_models: ['remove'] }, all.updated_at)
    finish({ ...all, updated_at: 'next', model_allowlist: { enabled: true, models: ['keep'], excluded_models: ['remove'] } })
    await flushPromises()
    expect(view.get('#model-manager-group').attributes('disabled')).toBeUndefined()
    await view.get('#model-manager-group').setValue('9')
    await flushPromises()
    expect(mocks.getById).toHaveBeenLastCalledWith(9)
    expect((view.get('[data-model="other-model"] input').element as HTMLInputElement).checked).toBe(true)
    expect((view.get('[data-model="keep"] input').element as HTMLInputElement).checked).toBe(false)
  })

  it('shows an initial group error and retries without exposing a stale editor', async () => {
    mocks.getAllIncludingInactive.mockRejectedValueOnce(new Error('offline'))
    const view = render()
    await flushPromises()
    expect(view.find('[role="alert"]').exists()).toBe(true)
    expect(view.find('[data-testid="sync-models"]').exists()).toBe(false)
    await view.get('button').trigger('click')
    await flushPromises()
    expect(view.find('[role="alert"]').exists()).toBe(false)
    expect(mocks.getById).toHaveBeenCalledWith(8)
  })
})
