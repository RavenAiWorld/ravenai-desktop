import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import AccountsView from '../AccountsView.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const { listAccounts, deleteAccount, showError, showSuccess } = vi.hoisted(() => ({
  listAccounts: vi.fn(), deleteAccount: vi.fn(), showError: vi.fn(), showSuccess: vi.fn()
}))
vi.mock('@/api/admin', () => ({
  adminAPI: {
    accounts: {
      list: listAccounts,
      delete: deleteAccount,
      listWithEtag: vi.fn().mockResolvedValue({ notModified: true, etag: null, data: null }),
      getBatchTodayStats: vi.fn().mockResolvedValue({ stats: {} }),
      getUpstreamBillingProbeSettings: vi.fn().mockResolvedValue({ enabled: false, interval_minutes: 30 })
    },
    proxies: { getAll: vi.fn().mockResolvedValue([]) },
    groups: { getAll: vi.fn().mockResolvedValue([]) }
  }
}))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError, showSuccess, showInfo: vi.fn() }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ token: 'test-token' }) }))
vi.mock('vue-i18n', async () => ({
  ...await vi.importActual<typeof import('vue-i18n')>('vue-i18n'),
  useI18n: () => ({ t: (key: string) => key })
}))
enableAutoUnmount(afterEach)

async function openDelete() {
  const wrapper = shallowMount(AccountsView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: { template: '<div><slot name="table" /></div>' },
        DataTable: {
          props: ['data'],
          template: '<div><div v-for="row in data" :key="row.id" data-test="row"><slot name="cell-actions" :row="row" /></div></div>'
        }
      }
    }
  })
  await flushPromises()
  await wrapper.findAll('button').find(button => button.text() === 'common.delete')!.trigger('click')
  return { wrapper, dialog: wrapper.findAllComponents(ConfirmDialog)[0] }
}

describe('account deletion feedback', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    deleteAccount.mockReset()
    listAccounts.mockReset().mockResolvedValue({
      items: [{ id: 81, name: '3', platform: 'openai', type: 'oauth', status: 'active', group_ids: [] }],
      total: 1, page: 1, page_size: 20, pages: 1
    })
  })

  it('sends one deletion and removes the row before the subsequent list refresh finishes', async () => {
    let finish!: () => void
    deleteAccount.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
    const { wrapper, dialog } = await openDelete()
    listAccounts.mockReturnValue(new Promise(() => {}))
    dialog.vm.$emit('confirm')
    dialog.vm.$emit('confirm')
    await flushPromises()
    expect(deleteAccount).toHaveBeenCalledTimes(1)
    expect(deleteAccount).toHaveBeenCalledWith(81)
    expect(dialog.props('loading')).toBe(true)
    expect(dialog.props('show')).toBe(true)

    finish()
    await flushPromises()
    expect(dialog.props('show')).toBe(false)
    expect(dialog.props('loading')).toBe(false)
    expect(wrapper.find('[data-test="row"]').exists()).toBe(false)
    expect(showSuccess).toHaveBeenCalledWith('common.deleted')
  })

  it('keeps the account and confirmation available after an error, then permits a retry', async () => {
    deleteAccount.mockRejectedValueOnce({ message: 'Deletion timed out' })
    const { wrapper, dialog } = await openDelete()
    dialog.vm.$emit('confirm')
    await flushPromises()
    expect(dialog.props('loading')).toBe(false)
    expect(dialog.props('show')).toBe(true)
    expect(wrapper.find('[data-test="row"]').exists()).toBe(true)
    expect(showError).toHaveBeenCalledWith('Deletion timed out')
    expect(showSuccess).not.toHaveBeenCalled()

    deleteAccount.mockResolvedValue({ message: 'deleted' })
    listAccounts.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, pages: 0 })
    dialog.vm.$emit('confirm')
    await flushPromises()
    expect(deleteAccount).toHaveBeenCalledTimes(2)
    expect(dialog.props('show')).toBe(false)
    expect(wrapper.find('[data-test="row"]').exists()).toBe(false)
  })
})
