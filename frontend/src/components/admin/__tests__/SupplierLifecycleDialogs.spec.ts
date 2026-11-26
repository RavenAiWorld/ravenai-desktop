import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { ModelHealthProviderGroup } from '@/api/admin/modelHealth'
import type { SupplierRetirement } from '@/api/admin/supplierHall'
import SupplierConnectDialog from '../SupplierConnectDialog.vue'
import SupplierRetireDialog from '../SupplierRetireDialog.vue'

const { groups, pending, connect, preview, retire } = vi.hoisted(() => ({
  groups: vi.fn(), pending: vi.fn(), connect: vi.fn(), preview: vi.fn(), retire: vi.fn(),
}))
vi.mock('@/api/admin/groups', () => ({ getAll: groups }))
vi.mock('@/api/admin/supplierHall', () => ({
  getSupplierConnection: pending, connectSupplier: connect, getRetirement: preview, retireSupplier: retire,
  supplierErrorText: (cause: Error) => cause.message,
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
const global = { stubs: { BaseDialog: { template: '<div><slot/><slot name="footer"/></div>' }, Icon: true } }
const price = { input_per_million: null, output_per_million: null, cache_input_per_million: null, cache_write_per_million: null }
const provider: ModelHealthProviderGroup = {
  group_id: 72, code: 'Supplier', platform: 'openai', rate_multiplier: .25, catalog_known: true,
  supported_models: ['gpt-a', 'gpt-b'].map(model => ({ model, price })),
  models: [{ model: 'probe-only', health: 'unknown', sample_count: 0 }], warnings: [], warnings_at: '', warnings_expires_at: '', model_metrics: {},
  metrics: { sample_count: 0, success_rate: null, tps: null, duration_ms: null, cache_hit_rate: null, input_price_per_million: null, effective_multiplier: null },
}
const plan: SupplierRetirement = {
  account_id: 52, account_name: 'Local', provider_id: 72, key_id: 73, key_name: 'Dedicated', models: ['gpt-a'],
  groups: [{ id: 15, name: 'West', accounts: 1, customer_keys: 0, can_delete: true }], fingerprint: 'preview', delete_groups: false, phase: 'preview',
}
const mountConnect = (model = '') => mount(SupplierConnectDialog, { props: { provider, model }, global })
const mountRetire = () => mount(SupplierRetireDialog, { props: { account: { id: 52, name: 'Local' } }, global })

beforeEach(() => {
  vi.resetAllMocks()
  groups.mockResolvedValue([{ id: 15, name: 'West', platform: 'openai', description: 'Local text', rate_multiplier: 1 }])
  pending.mockResolvedValue(null)
  connect.mockImplementation(async input => ({ phase: 'connected', input }))
  preview.mockResolvedValue(plan)
  retire.mockResolvedValue({ ...plan, phase: 'retired' })
})

describe('Supplier model connection', () => {
  it.each([['unchanged', undefined], ['cleared', ''], ['replaced', 'New text']] as const)('submits selected models and a %s existing description', async (_, edit) => {
    const wrapper = mountConnect()
    await flushPromises()
    expect(wrapper.findAll('input[type="checkbox"]').map(item => item.attributes('value'))).toEqual(['gpt-a', 'gpt-b'])
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('input[value="gpt-b"]').setValue(true)
    await wrapper.get('select[required]').setValue(15)
    const text = wrapper.get<HTMLTextAreaElement>('[data-testid="connect-group-description"]')
    expect(text.element.value).toBe('Local text')
    if (edit !== undefined) await text.setValue(edit)
    await wrapper.get('form').trigger('submit')
    expect(connect).toHaveBeenCalledWith({ provider_id: 72, group_id: 15, group_name: '', sell_rate: 0, max_rate: .25, models: ['gpt-b'], ...(edit === undefined ? {} : { group_description: edit }) })
    wrapper.unmount()
  })

  it('prefills the clicked model and keeps new and existing group descriptions separate', async () => {
    const wrapper = mountConnect('gpt-b')
    await flushPromises()
    await wrapper.get('select[required]').setValue(15)
    await wrapper.get('[data-testid="connect-group-description"]').setValue('Existing draft')
    const mode = wrapper.get('select:not([required])')
    await mode.setValue('new')
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('AIHub Supplier')
    await wrapper.get('textarea').setValue('New group description')
    await mode.setValue('existing')
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('Existing draft')
    await mode.setValue('new')
    await wrapper.get('form').trigger('submit')
    expect(connect).toHaveBeenCalledWith({ provider_id: 72, group_id: 0, group_name: 'Supplier', group_description: 'New group description', sell_rate: 1, max_rate: .25, models: ['gpt-b'] })
    wrapper.unmount()
  })

  it('retries a staged connection with the exact original model and description', async () => {
    const input = { provider_id: 72, group_id: 15, group_name: '', group_description: '', sell_rate: 0, max_rate: .27, models: ['gpt-b'] }
    pending.mockResolvedValue({ phase: 'key', key_id: 73, input })
    const wrapper = mountConnect('gpt-a')
    await flushPromises()
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('')
    await wrapper.get('form').trigger('submit')
    expect(connect).toHaveBeenCalledWith(input)
    wrapper.unmount()
  })
})

describe('Supplier channel retirement', () => {
  it.each([false, true])('keeps the last channel group unless deletion is selected (delete=%s)', async remove => {
    const wrapper = mountRetire()
    await flushPromises()
    const radios = wrapper.findAll<HTMLInputElement>('input[type="radio"]')
    expect(radios[0]!.element.checked).toBe(true)
    expect(wrapper.text()).toContain('admin.supplierHall.lastChannelKept')
    if (remove) await radios[1]!.setValue()
    await wrapper.get('button.btn-danger').trigger('click')
    expect(retire).toHaveBeenCalledWith(52, plan, remove)
    wrapper.unmount()
  })

  it('does not offer deletion for groups with customer keys', async () => {
    preview.mockResolvedValue({ ...plan, groups: [{ ...plan.groups[0]!, customer_keys: 1, can_delete: false }] })
    const wrapper = mountRetire()
    await flushPromises()
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('admin.supplierHall.deleteEmpty')
    wrapper.unmount()
  })

  it('reloads the journal after a lost response and locks the originally approved scope', async () => {
    const staged = { ...plan, phase: 'detached', delete_groups: true }
    preview.mockResolvedValueOnce(plan).mockResolvedValueOnce(staged)
    retire.mockRejectedValueOnce(new Error('Connection interrupted'))
    const wrapper = mountRetire()
    await flushPromises()
    await wrapper.findAll('input[type="radio"]')[1]!.setValue()
    await wrapper.get('button.btn-danger').trigger('click')
    await flushPromises()
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll<HTMLInputElement>('input[type="radio"]')[1]!.element.checked).toBe(true)
    await wrapper.get('button.btn-danger').trigger('click')
    expect(retire).toHaveBeenLastCalledWith(52, staged, true)
    wrapper.unmount()
  })
})
