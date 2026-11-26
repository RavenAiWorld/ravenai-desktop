import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

import AccountsView from '../AccountsView.vue'
import AccountActionMenu from '@/components/admin/account/AccountActionMenu.vue'
import AccountTodayStatsCell from '@/components/account/AccountTodayStatsCell.vue'
import type { BatchAccountStatsResponse } from '@/api/admin/accounts'

const {
  listAccounts,
  listWithEtag,
  getById,
  getBatchTodayStats,
  getBatchLifetimeStats,
  getBatchUsage,
  getUpstreamBillingProbeSettings,
  getAllProxies,
  getAllGroups,
  refreshCredentials,
  previewUpstreamGroup,
  updateAccount,
  showError,
  showWarning
} = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  listWithEtag: vi.fn(),
  getById: vi.fn(),
  getBatchTodayStats: vi.fn(),
  getBatchLifetimeStats: vi.fn(),
  getBatchUsage: vi.fn(),
  getUpstreamBillingProbeSettings: vi.fn(),
  getAllProxies: vi.fn(),
  getAllGroups: vi.fn(),
  refreshCredentials: vi.fn(),
  previewUpstreamGroup: vi.fn(),
  updateAccount: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    accounts: {
      list: listAccounts,
      getById,
      listWithEtag,
      getBatchTodayStats,
      getBatchLifetimeStats,
      getBatchUsage,
      getUpstreamBillingProbeSettings,
      delete: vi.fn(),
      batchClearError: vi.fn(),
      batchRefresh: vi.fn(),
      toggleSchedulable: vi.fn(),
      refreshCredentials,
      previewUpstreamGroup,
      update: updateAccount
    },
    proxies: { getAll: getAllProxies },
    groups: { getAll: getAllGroups }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showWarning, showSuccess: vi.fn(), showInfo: vi.fn() })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ token: 'test-token', isSimpleMode: false })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const DataTableStub = defineComponent({
  props: { columns: { type: Array, default: () => [] }, data: { type: Array, default: () => [] }, loading: Boolean },
  template: `
    <div>
      <template v-if="!loading"><div v-for="row in data" :key="row.id" :data-account-name="row.name">
        <slot name="cell-name" :row="row" :value="row.name" />
        <slot name="cell-groups" :row="row" />
        <slot name="cell-usage" :row="row" />
        <slot name="cell-actions" :row="row" />
        <template v-for="column in columns" :key="column.key">
          <slot v-if="column.key === 'today_stats' || column.key === 'lifetime_stats'" :name="'cell-' + column.key" :row="row" />
        </template>
      </div></template>
    </div>
  `
})

const AccountGroupsCellStub = defineComponent({
  props: { groups: { type: Array, default: () => [] } },
  template: '<span data-test="account-groups">{{ groups.map(group => group.name).join(",") }}</span>'
})

const EditAccountModalStub = defineComponent({
  props: { show: Boolean, account: { type: Object, default: null } },
  template: '<div data-test="edit-account">{{ show ? account?.name : "" }}</div>'
})

const AccountTestModalStub = defineComponent({
  props: { show: Boolean, account: { type: Object, default: null } },
  template: '<div data-test="test-account">{{ show ? account?.name : "" }}</div>'
})

const AccountStatsModalStub = defineComponent({
  props: { show: Boolean, account: { type: Object, default: null } },
  template: '<div data-test="stats-account">{{ show ? account?.name : "" }}</div>'
})

function mountView(stubActionMenu = true, realUsageCell = false) {
  return mount(AccountsView, {
    attachTo: document.body,
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: { template: '<div><slot name="filters" /><slot name="table" /><slot name="pagination" /></div>' },
        DataTable: DataTableStub,
        AccountTableActions: { template: `<div><button data-test="manual-refresh" @click="$emit('refresh')">refresh</button><slot name="after" /></div>` },
        AccountTableFilters: true,
        AccountBulkActionsBar: true,
        Pagination: { template: `<button data-test="next-page" @click="$emit('update:page', 2)">Next</button>` },
        ConfirmDialog: true,
        AccountActionMenu: stubActionMenu,
        ImportDataModal: true,
        ReAuthAccountModal: true,
        AccountTestModal: AccountTestModalStub,
        AccountStatsModal: AccountStatsModalStub,
        ScheduledTestsPanel: true,
        SyncFromCrsModal: true,
        TempUnschedStatusModal: true,
        ErrorPassthroughRulesModal: true,
        TLSFingerprintProfilesModal: true,
        CreateAccountModal: true,
        EditAccountModal: EditAccountModalStub,
        BulkEditAccountModal: true,
        PlatformTypeBadge: true,
        AccountCapacityCell: true,
        AccountStatusIndicator: true,
        AccountTodayStatsCell: true,
        AccountGroupsCell: AccountGroupsCellStub,
        AccountUsageCell: !realUsageCell,
        UpstreamBillingRateCell: true,
        HelpTooltip: true,
        Icon: true,
        Teleport: stubActionMenu
      }
    }
  })
}

const listRow = {
  id: 42,
  name: 'compact row',
  platform: 'openai',
  type: 'oauth',
  status: 'active',
  schedulable: true,
  concurrency: 2,
  priority: 1,
  group_ids: [7],
  extra: {},
  credentials: {}
}

const fullAccount = {
  ...listRow,
  groups: [{ id: 7, name: 'codex', platform: 'openai' }],
  account_groups: [{ account_id: 42, group_id: 7 }],
  credentials: { api_key: 'redacted' },
  extra: { detail_only: true }
}

describe('admin AccountsView lite account list', () => {
  beforeEach(() => {
    localStorage.clear()
    listAccounts.mockReset().mockResolvedValue({ items: [listRow], total: 1, page: 1, page_size: 20, pages: 1 })
    listWithEtag.mockReset().mockResolvedValue({ notModified: true, etag: 'compact-etag', data: null })
    getById.mockReset().mockResolvedValue(fullAccount)
    getBatchTodayStats.mockReset().mockResolvedValue({ stats: {} })
    getBatchLifetimeStats.mockReset().mockResolvedValue({ stats: {} })
    getBatchUsage.mockReset().mockResolvedValue({ usage: { '42': { five_hour: { utilization: 21 }, seven_day: { utilization: 31 } } }, errors: {} })
    getUpstreamBillingProbeSettings.mockReset().mockResolvedValue({ enabled: true })
    getAllProxies.mockReset().mockResolvedValue([])
    getAllGroups.mockReset().mockResolvedValue([{ id: 7, name: 'codex', platform: 'openai' }])
    refreshCredentials.mockReset()
    showError.mockReset()
    showWarning.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('syncs the selected row without clearing notes missing from the upstream', async () => {
    const account = { ...listRow, type: 'apikey', notes: 'local notes' }
    listAccounts.mockResolvedValue({ items: [account], total: 1, page: 1, page_size: 20, pages: 1 })
    previewUpstreamGroup.mockResolvedValueOnce({}).mockResolvedValueOnce({ name: 'New group' })
    updateAccount.mockReset().mockResolvedValue({ ...account, name: 'New group' })
    const wrapper = mountView()
    await flushPromises()
    const sync = wrapper.get('button[aria-label="admin.accounts.upstreamBilling.saveGroup"]')
    await sync.trigger('click')
    await flushPromises()
    expect(updateAccount).not.toHaveBeenCalled()
    await sync.trigger('click')
    await flushPromises()
    expect(previewUpstreamGroup).toHaveBeenLastCalledWith({ account_id: account.id })
    expect(updateAccount).toHaveBeenCalledWith(account.id, { name: 'New group' })
    expect(wrapper.find('[data-account-name="New group"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it.each([
    ['anthropic', 'oauth'], ['anthropic', 'setup-token'], ['gemini', 'oauth']
  ])('updates %s %s usage on auto-refresh without force or unrelated probes', async (platform, type) => {
    vi.useFakeTimers()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()
    }) as unknown as MediaQueryList)
    localStorage.setItem('account-auto-refresh', JSON.stringify({ enabled: true, interval_seconds: 5 }))
    const account = { ...listRow, platform, type }
    listAccounts.mockResolvedValue({ items: [account], total: 1, page: 1, page_size: 20, pages: 1 })
    const wrapper = mountView(true, true)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(getBatchUsage).toHaveBeenCalledTimes(1)
    expect(getBatchUsage).toHaveBeenCalledWith([42], false)

    const next = { ...account, extra: { session_window_utilization: 0.44, passive_usage_7d_utilization: 0.54 }, last_used_at: platform === 'gemini' ? '2026-11-16T10:00:00Z' : null }
    getBatchUsage.mockResolvedValue({ usage: { '42': { five_hour: { utilization: 44 }, seven_day: { utilization: 54 } } }, errors: {} })
    listWithEtag.mockResolvedValue({ notModified: false, etag: 'new', data: { items: [next], total: 1, pages: 1 } })
    await vi.advanceTimersByTimeAsync(6000)
    await flushPromises()
    expect(getBatchUsage).toHaveBeenCalledTimes(2)
    expect(getBatchUsage).toHaveBeenLastCalledWith([42], false)
    const cell = wrapper.findComponent({ name: 'AccountUsageCell' })
    expect(cell.props('account').last_used_at).toBe(next.last_used_at)
    expect(cell.props('batchedUsage').seven_day.utilization).toBe(54)
    cell.props('requestBatchedUsage')(cell.props('account'))
    await vi.advanceTimersByTimeAsync(1)
    expect(getBatchUsage).toHaveBeenCalledTimes(2)

    listWithEtag.mockResolvedValue({ notModified: false, etag: 'unrelated', data: { items: [{ ...next, updated_at: 'new', current_concurrency: 2, extra: { ...next.extra, unrelated: true } }], total: 1, pages: 1 } })
    await vi.advanceTimersByTimeAsync(6000)
    await flushPromises()
    expect(getBatchUsage).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('keeps lite=1 on the initial list request', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(listAccounts).toHaveBeenCalledWith(
      1,
      20,
      expect.objectContaining({ lite: '1' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    wrapper.unmount()
  })

  it('does not load historical totals on a fresh layout and persists explicitly showing the column', async () => {
    getBatchLifetimeStats.mockResolvedValue({ stats: { 42: { requests: 500, tokens: 3000, cost: 1, user_cost: 2 } } })
    const wrapper = mountView()
    await flushPromises()
    expect(getBatchLifetimeStats).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="account-lifetime-stats"]').exists()).toBe(false)

    await wrapper.get('[title="admin.accounts.moreActions"]').trigger('click')
    const toggle = wrapper.findAll('button[aria-pressed="false"]')
      .find(button => button.text() === 'admin.accounts.columns.lifetimeStats')
    expect(toggle).toBeDefined()
    await toggle!.trigger('click')
    await flushPromises()
    expect(getBatchLifetimeStats).toHaveBeenCalledTimes(1)
    expect(getBatchLifetimeStats).toHaveBeenCalledWith([42], { signal: expect.any(AbortSignal) })
    expect(wrapper.getComponent(AccountTodayStatsCell).props('stats')).toMatchObject({ requests: 500 })
    expect(JSON.parse(localStorage.getItem('account-hidden-columns') ?? '[]')).not.toContain('lifetime_stats')
    wrapper.unmount()

    const reopened = mountView()
    await flushPromises()
    expect(reopened.find('[data-testid="account-lifetime-stats"]').exists()).toBe(true)
    expect(getBatchLifetimeStats).toHaveBeenCalledTimes(2)
    reopened.unmount()
  })

  it('keeps today and lifetime separate and cancels stale totals when changing pages', async () => {
    localStorage.setItem('account-hidden-columns', JSON.stringify(['scheduler_score']))
    localStorage.setItem('account-hidden-columns-version', 'scheduler-score-hidden-by-default')
    const today = { requests: 7, tokens: 100, cost: 0.5 }
    const lifetime = { requests: 240, tokens: 7000, cost: 14 }
    getBatchTodayStats.mockResolvedValue({ stats: { 42: today, 43: today } })
    let resolveStale: (data: BatchAccountStatsResponse) => void = () => {}
    getBatchLifetimeStats
      .mockImplementationOnce(() => new Promise(resolve => { resolveStale = resolve }))
      .mockResolvedValueOnce({ stats: { 43: lifetime } })
    listAccounts
      .mockResolvedValueOnce({ items: [listRow], total: 21, page: 1, page_size: 20, pages: 2 })
      .mockResolvedValueOnce({ items: [{ ...listRow, id: 43 }], total: 21, page: 2, page_size: 20, pages: 2 })

    const wrapper = mountView()
    await flushPromises()
    const keys = wrapper.getComponent(DataTableStub).props('columns').map((column: { key: string }) => column.key)
    expect(keys.indexOf('lifetime_stats')).toBe(keys.indexOf('today_stats') + 1)
    expect(wrapper.findAllComponents(AccountTodayStatsCell).map(cell => cell.props('stats'))).toEqual([today, null])
    const firstSignal: AbortSignal = getBatchLifetimeStats.mock.calls[0][1].signal

    await wrapper.get('[data-test="next-page"]').trigger('click')
    await flushPromises()
    expect(firstSignal.aborted).toBe(true)
    expect(getBatchLifetimeStats).toHaveBeenLastCalledWith([43], { signal: expect.any(AbortSignal) })
    resolveStale({ stats: { 42: { requests: 999, tokens: 999, cost: 99 } } })
    await flushPromises()
    expect(wrapper.findAllComponents(AccountTodayStatsCell).map(cell => cell.props('stats'))).toEqual([today, lifetime])
    wrapper.unmount()
  })

  it('limits lifetime queries during automatic refresh and recovers on manual refresh', async () => {
    vi.useFakeTimers()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('account-hidden-columns', JSON.stringify(['today_stats']))
    localStorage.setItem('account-hidden-columns-version', 'lifetime-stats-v1')
    localStorage.setItem('account-auto-refresh', JSON.stringify({ enabled: true, interval_seconds: 5 }))
    getBatchLifetimeStats
      .mockRejectedValueOnce(new Error('aggregate failed'))
      .mockResolvedValue({ stats: { 42: { requests: 0, tokens: 0, cost: 0, user_cost: 0 } } })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.getComponent(AccountTodayStatsCell).props('error')).toBe('admin.accounts.lifetimeStatsLoadFailed')

    await vi.advanceTimersByTimeAsync(6_000)
    await flushPromises()
    expect(listWithEtag).toHaveBeenCalled()
    expect(getBatchLifetimeStats).toHaveBeenCalledTimes(1)

    await wrapper.get('[data-test="manual-refresh"]').trigger('click')
    await flushPromises()
    expect(getBatchLifetimeStats).toHaveBeenCalledTimes(2)
    expect(wrapper.getComponent(AccountTodayStatsCell).props('error')).toBeNull()
    expect(wrapper.getComponent(AccountTodayStatsCell).props('stats')).toMatchObject({ requests: 0 })
    wrapper.unmount()
  })

  it('keeps existing rows mounted and busy while a manual list refresh is pending', async () => {
    const wrapper = mountView()
    await flushPromises()
    const row = wrapper.get('[data-account-name="compact row"]').element
    let finish: (value: unknown) => void = () => {}
    listAccounts.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await wrapper.get('[data-test="manual-refresh"]').trigger('click')
    await flushPromises()
    expect(wrapper.getComponent(DataTableStub).props('loading')).toBe(false)
    expect(wrapper.get('[data-account-name="compact row"]').element).toBe(row)
    expect(wrapper.find('[aria-busy="true"]').attributes()).toHaveProperty('inert')
    finish({ items: [{ ...listRow, name: 'updated row' }], total: 1, page: 1, page_size: 20, pages: 1 })
    await flushPromises()
    expect(wrapper.get('[data-account-name="updated row"]').element).toBe(row)
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('still shows initial loading when no rows are available', async () => {
    let finish: (value: unknown) => void = () => {}
    listAccounts.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.getComponent(DataTableStub).props('loading')).toBe(true)
    finish({ items: [listRow], total: 1, page: 1, page_size: 20, pages: 1 })
    await flushPromises()
    wrapper.unmount()
  })

  it('maps group_ids through the group catalog for the table cell', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-test="account-groups"]').text()).toBe('codex')
    wrapper.unmount()
  })

  it('keeps the action menu open during internal scrolling but closes it on table scrolling', async () => {
    const wrapper = mountView(false)
    await flushPromises()

    const trigger = wrapper.findAll('button').find(button => button.text() === 'common.more')!
    await trigger.trigger('click')
    const menu = new DOMWrapper(document.body.querySelector('.action-menu-content')!)
    menu.element.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(wrapper.findComponent(AccountActionMenu).props('show')).toBe(true)

    menu.get('button').element.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(wrapper.findComponent(AccountActionMenu).props('show')).toBe(true)

    wrapper.getComponent(DataTableStub).element.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(wrapper.findComponent(AccountActionMenu).props('show')).toBe(false)
    wrapper.unmount()
  })

  it('keeps lite=1 on automatic ETag refreshes', async () => {
    vi.useFakeTimers()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    localStorage.setItem('account-auto-refresh', JSON.stringify({ enabled: true, interval_seconds: 5 }))
    const wrapper = mountView()
    await flushPromises()

    await vi.advanceTimersByTimeAsync(6000)
    await flushPromises()

    expect(listWithEtag).toHaveBeenCalledWith(
      1,
      20,
      expect.objectContaining({ lite: '1' }),
      expect.objectContaining({ etag: null })
    )
    wrapper.unmount()
  })

  it('loads the full account by id before opening edit, test, and stats actions', async () => {
    const wrapper = mountView()
    await flushPromises()

    const editButton = wrapper.findAll('button').find(button => button.text().includes('common.edit'))
    expect(editButton).toBeTruthy()
    await editButton!.trigger('click')
    await flushPromises()
    expect(getById).toHaveBeenCalledWith(42)
    expect(wrapper.get('[data-test="edit-account"]').text()).toBe('compact row')

    const menu = wrapper.findComponent(AccountActionMenu)
    menu.vm.$emit('test', listRow)
    await flushPromises()
    expect(getById).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-test="test-account"]').text()).toBe('compact row')

    menu.vm.$emit('stats', listRow)
    await flushPromises()
    expect(getById).toHaveBeenCalledTimes(3)
    expect(wrapper.get('[data-test="stats-account"]').text()).toBe('compact row')
    wrapper.unmount()
  })

  it('shows the warning and patches the account after a partial Antigravity refresh', async () => {
    refreshCredentials.mockResolvedValue({
      account: { ...fullAccount, name: 'refreshed account' },
      message: 'Token refreshed, but project_id is temporarily unavailable',
      warning: 'missing_project_id_temporary'
    })
    const wrapper = mountView(false)
    await flushPromises()

    wrapper.findComponent(AccountActionMenu).vm.$emit('refresh-token', listRow)
    await flushPromises()

    expect(refreshCredentials).toHaveBeenCalledWith(42)
    expect(wrapper.get('[data-account-name]').attributes('data-account-name')).toBe('refreshed account')
    expect(showWarning).toHaveBeenCalledWith('Token refreshed, but project_id is temporarily unavailable')
    wrapper.unmount()
  })

  it('shows an error and keeps the modal closed when detail loading fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    getById.mockRejectedValueOnce(new Error('detail failed'))
    const wrapper = mountView()
    await flushPromises()

    const editButton = wrapper.findAll('button').find(button => button.text().includes('common.edit'))
    await editButton!.trigger('click')
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('detail failed')
    expect(wrapper.get('[data-test="edit-account"]').text()).toBe('')
    consoleError.mockRestore()
    wrapper.unmount()
  })
})
