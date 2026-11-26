import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

import type { ApiKey, Group } from '@/types'
import { keysAPI } from '@/api'
import type { BatchApiKeysUsageResponse } from '@/api/usage'
import KeysView from '../KeysView.vue'
import BulkEditKeysModal from '@/components/keys/BulkEditKeysModal.vue'
import KeyGroupSelector from '@/components/keys/KeyGroupSelector.vue'

const authState = vi.hoisted(() => ({ isAdmin: true }))

const {
  listKeys,
  updateKey,
  getPublicSettings,
  getDashboardApiKeysUsage,
  getAvailableGroups,
  getUserGroupRates,
  showError,
  showSuccess,
  copyToClipboard,
  isCurrentStep,
  nextStep,
} = vi.hoisted(() => ({
  listKeys: vi.fn(),
  updateKey: vi.fn(),
  getPublicSettings: vi.fn(),
  getDashboardApiKeysUsage: vi.fn(),
  getAvailableGroups: vi.fn(),
  getUserGroupRates: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  copyToClipboard: vi.fn(),
  isCurrentStep: vi.fn(),
  nextStep: vi.fn(),
}))

const messages: Record<string, string> = {
  'common.actions': 'Actions',
  'common.name': 'Name',
  'common.refresh': 'Refresh',
  'common.status': 'Status',
  'keys.apiKey': 'API Key',
  'keys.allGroups': 'All Groups',
  'keys.allStatus': 'All Status',
  'keys.columnSettings': 'Column Settings',
  'keys.createKey': 'Create API Key',
  'keys.created': 'Created',
  'keys.expiresAt': 'Expires',
  'keys.group': 'Group',
  'keys.groupLabel': 'Group',
  'keys.providerLabel': 'Provider',
  'keys.providers.anthropic': 'Anthropic',
  'keys.providers.openai': 'OpenAI',
  'keys.providers.domestic': 'Chinese AI',
  'keys.providers.other': 'Other',
  'keys.providerHints.anthropic': 'Choose an available Anthropic / Claude group',
  'keys.providerHints.openai': 'Choose an available OpenAI / GPT group',
  'keys.providerHints.domestic': 'Includes DeepSeek, Kimi, Zhipu GLM and MiniMax',
  'keys.providerHints.other': 'Includes Gemini, Grok, Antigravity, OpenCode and mixed groups',
  'keys.selectGroup': 'Select a group',
  'keys.noGroup': 'No group',
  'keys.id': 'ID',
  'keys.currentConcurrency': 'Current Concurrency',
  'keys.lastUsedAt': 'Last Used',
  'keys.lastUsedIP': 'Last Used IP',
  'keys.rateLimitColumn': 'Rate Limit',
  'keys.searchPlaceholder': 'Search name or key...',
  'keys.status.active': 'Active',
  'keys.status.expired': 'Expired',
  'keys.status.inactive': 'Inactive',
  'keys.status.quota_exhausted': 'Quota exhausted',
  'keys.usage': 'Usage',
}

vi.mock('@/api', () => ({
  keysAPI: {
    list: listKeys,
    create: vi.fn(),
    update: updateKey,
    delete: vi.fn(),
    toggleStatus: vi.fn(),
  },
  authAPI: {
    getPublicSettings,
  },
  usageAPI: {
    getDashboardApiKeysUsage,
  },
  userGroupsAPI: {
    getAvailable: getAvailableGroups,
    getUserGroupRates,
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError,
    showSuccess,
  }),
}))

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({
    isCurrentStep,
    nextStep,
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authState,
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copyToClipboard,
  }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => messages[key] ?? key,
    }),
  }
})

const createApiKey = (): ApiKey => ({
  id: 1,
  user_id: 1,
  key: 'sk-test-key',
  name: 'test-key',
  group_id: null,
  status: 'active',
  ip_whitelist: [],
  ip_blacklist: [],
  last_used_at: null,
  last_used_ip: null,
  quota: 0,
  quota_used: 0,
  expires_at: null,
  created_at: '2026-06-27T00:00:00Z',
  updated_at: '2026-06-27T00:00:00Z',
  current_concurrency: 3,
  rate_limit_5h: 0,
  rate_limit_1d: 0,
  rate_limit_7d: 0,
  usage_5h: 0,
  usage_1d: 0,
  usage_7d: 0,
  window_5h_start: null,
  window_1d_start: null,
  window_7d_start: null,
  reset_5h_at: null,
  reset_1d_at: null,
  reset_7d_at: null,
})

const AppLayoutStub = {
  template: '<div><slot /></div>',
}

const TablePageLayoutStub = {
  template: `
    <div>
      <slot name="filters" />
      <slot name="actions" />
      <slot name="table" />
      <slot name="pagination" />
    </div>
  `,
}

const DataTableStub = {
  name: 'DataTable',
  props: { columns: Array, data: Array, loading: Boolean, selectedKeys: Array, selectable: Boolean },
  emits: ['sort', 'update:selectedKeys'],
  template: `
    <div>
      <div data-test="columns">{{ columns.map((col) => col.key).join(',') }}</div>
      <div data-test="columns-meta">{{ JSON.stringify(columns.map((col) => ({ key: col.key, sortable: !!col.sortable }))) }}</div>
      <button data-test="sort-current-concurrency" @click="$emit('sort', 'current_concurrency', 'asc')">
        Sort Current Concurrency
      </button>
      <div v-for="row in loading ? [] : data" :key="row.id">
        <div
          v-if="columns.some((col) => col.key === 'id')"
          data-test="key-id"
        >
          <slot name="cell-id" :value="row.id" :row="row" />
        </div>
        <slot name="cell-name" :value="row.name" :row="row" />
        <div data-test="key-usage">
          <slot name="cell-usage" :row="row" />
        </div>
        <div
          v-if="columns.some((col) => col.key === 'group')"
          data-test="key-group"
        >
          <slot name="cell-group" :row="row" />
        </div>
        <slot name="cell-actions" :row="row" />
        <div data-test="current-concurrency">
          <slot name="cell-current_concurrency" :value="row.current_concurrency" :row="row" />
        </div>
        <div data-test="usage">
          <slot name="cell-usage" :row="row" />
        </div>
        <div
          v-if="columns.some((col) => col.key === 'last_used_ip')"
          data-test="last-used-ip"
        >
          <slot name="cell-last_used_ip" :value="row.last_used_ip" :row="row" />
        </div>
      </div>
      <slot name="empty" />
    </div>
  `,
}

const SelectStub = {
  name: 'Select',
  props: ['modelValue', 'options'],
  emits: ['update:modelValue'],
  template: `
    <select
      :value="modelValue"
      @change="$emit('update:modelValue', options.find((option) => String(option.value) === $event.target.value)?.value ?? null)"
    >
      <option v-for="option in options" :key="String(option.value)" :value="option.value" :disabled="option.disabled">
        {{ option.label }}
      </option>
    </select>
  `,
}

const SearchInputStub = {
  name: 'SearchInput',
  props: ['modelValue'],
  emits: ['update:modelValue', 'search'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const PaginationStub = {
  name: 'Pagination',
  props: ['page', 'total', 'pageSize'],
  emits: ['update:page', 'update:pageSize'],
  template: `
    <div>
      <button data-test="page-size-50" @click="$emit('update:pageSize', 50)">50</button>
      <button data-test="page-2" @click="$emit('update:page', 2)">Page 2</button>
    </div>
  `,
}

const IconStub = {
  props: ['name'],
  template: '<span data-test="icon">{{ name }}</span>',
}

const mountView = async () => {
  const wrapper = mount(KeysView, {
    global: {
      stubs: {
        AppLayout: AppLayoutStub,
        TablePageLayout: TablePageLayoutStub,
        DataTable: DataTableStub,
        Pagination: PaginationStub,
        BaseDialog: {
          props: ['show', 'title'],
          emits: ['close'],
          template: '<div v-if="show" role="dialog"><button data-test="close-dialog" @click="$emit(\'close\')">Close</button><slot /><slot name="footer" /></div>',
        },
        ConfirmDialog: true,
        EmptyState: true,
        Select: SelectStub,
        SearchInput: SearchInputStub,
        Icon: IconStub,
        UseKeyModal: true,
        BulkEditKeysModal: true,
        EndpointPopover: true,
        GroupBadge: {
          props: ['name'],
          template: '<span data-test="group-badge">{{ name }}</span>',
        },
        GroupOptionItem: true,
        PlatformIcon: {
          props: ['platform'],
          template: '<span data-test="platform-icon" :data-platform="platform">{{ platform }}</span>',
        },
        Teleport: true,
      },
    },
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

const visibleColumnKeys = (wrapper: VueWrapper) =>
  wrapper.get('[data-test="columns"]').text().split(',').filter(Boolean)

const visibleColumnMeta = (wrapper: VueWrapper): Array<{ key: string; sortable: boolean }> =>
  JSON.parse(wrapper.get('[data-test="columns-meta"]').text())

const getButtonByText = (wrapper: VueWrapper, text: string) => {
  const button = wrapper.findAll('button').find((item) => item.text().includes(text))
  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }
  return button
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('user KeysView column settings', () => {
  beforeEach(() => {
    localStorage.clear()
    authState.isAdmin = true

    listKeys.mockReset()
    updateKey.mockReset()
    vi.mocked(keysAPI.create).mockReset()
    getPublicSettings.mockReset()
    getDashboardApiKeysUsage.mockReset()
    getAvailableGroups.mockReset()
    getUserGroupRates.mockReset()
    showError.mockReset()
    showSuccess.mockReset()
    copyToClipboard.mockReset()
    isCurrentStep.mockReset()
    nextStep.mockReset()

    listKeys.mockResolvedValue({
      items: [createApiKey()],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1,
    })
    getPublicSettings.mockResolvedValue({})
    getDashboardApiKeysUsage.mockResolvedValue({ stats: {} })
    getAvailableGroups.mockResolvedValue([{ id: 8, name: 'ALL', platform: 'composite', status: 'active' }])
    getUserGroupRates.mockResolvedValue({})
    isCurrentStep.mockReturnValue(false)
  })

  it('renders loaded keys before usage stats finish and updates their costs afterward', async () => {
    const usage = deferred<BatchApiKeysUsageResponse>()
    getDashboardApiKeysUsage.mockReturnValue(usage.promise)
    const wrapper = await mountView()
    const table = wrapper.findComponent({ name: 'DataTable' })

    expect(table.props('loading')).toBe(false)
    expect(wrapper.text()).toContain('test-key')
    expect(wrapper.get('button[title="Refresh"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test="usage-pending"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="key-usage"]').text()).not.toContain('$0.0000')

    usage.resolve({
      stats: { 1: { api_key_id: 1, today_actual_cost: 1.25, total_actual_cost: 9.5 } },
    })
    await flushPromises()

    expect(wrapper.get('[data-test="key-usage"]').text()).toContain('$1.2500')
    expect(wrapper.get('[data-test="key-usage"]').text()).toContain('$9.5000')
    expect(table.props('loading')).toBe(false)
    wrapper.unmount()
  })

  it('keeps keys usable when optional usage stats fail without reporting zero costs', async () => {
    const usage = deferred<BatchApiKeysUsageResponse>()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    getDashboardApiKeysUsage.mockReturnValue(usage.promise)
    const wrapper = await mountView()
    try {
      expect(wrapper.findComponent({ name: 'DataTable' }).props('loading')).toBe(false)
      usage.reject(new Error('Usage temporarily unavailable'))
      await flushPromises()

      expect(wrapper.text()).toContain('test-key')
      expect(wrapper.get('[data-test="key-usage"]').text()).toContain('--')
      expect(wrapper.get('button[title="Refresh"]').attributes('disabled')).toBeUndefined()
      expect(showError).not.toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalledWith('Failed to load usage stats:', expect.any(Error))
    } finally {
      wrapper.unmount()
      consoleError.mockRestore()
    }
  })

  it('ignores canceled usage responses without clearing a newer list loading state', async () => {
    const oldUsage = deferred<BatchApiKeysUsageResponse>()
    const nextUsage = deferred<BatchApiKeysUsageResponse>()
    const nextList = deferred<Awaited<ReturnType<typeof keysAPI.list>>>()
    getDashboardApiKeysUsage.mockReturnValueOnce(oldUsage.promise).mockReturnValueOnce(nextUsage.promise)
    const wrapper = await mountView()
    const table = wrapper.findComponent({ name: 'DataTable' })
    const oldSignal = getDashboardApiKeysUsage.mock.calls[0][1].signal as AbortSignal
    listKeys.mockReturnValueOnce(nextList.promise)

    await wrapper.get('button[title="Refresh"]').trigger('click')
    expect(oldSignal.aborted).toBe(true)
    expect(table.props('loading')).toBe(true)
    oldUsage.resolve({
      stats: { 1: { api_key_id: 1, today_actual_cost: 91, total_actual_cost: 92 } },
    })
    await flushPromises()
    expect(table.props('loading')).toBe(true)

    nextList.resolve({
      items: [{ ...createApiKey(), name: 'refreshed-key' }],
      total: 1, page: 1, page_size: 20, pages: 1,
    })
    await flushPromises()
    expect(table.props('loading')).toBe(false)
    expect(wrapper.text()).toContain('refreshed-key')
    expect(wrapper.find('[data-test="usage-pending"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="key-usage"]').text()).not.toContain('$91.0000')

    nextUsage.resolve({
      stats: { 1: { api_key_id: 1, today_actual_cost: 0, total_actual_cost: 4 } },
    })
    await flushPromises()
    expect(wrapper.get('[data-test="key-usage"]').text()).toContain('$0.0000')
    expect(wrapper.get('[data-test="key-usage"]').text()).toContain('$4.0000')
    expect(showError).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('ignores a canceled key list after a newer filter result has rendered', async () => {
    const oldList = deferred<Awaited<ReturnType<typeof keysAPI.list>>>()
    const usage = deferred<BatchApiKeysUsageResponse>()
    listKeys.mockReturnValueOnce(oldList.promise)
    getDashboardApiKeysUsage.mockReturnValue(usage.promise)
    const wrapper = await mountView()
    const table = wrapper.findComponent({ name: 'DataTable' })
    const oldSignal = listKeys.mock.calls[0][3].signal as AbortSignal
    expect(table.props('loading')).toBe(true)

    listKeys.mockResolvedValueOnce({
      items: [{ ...createApiKey(), id: 2, name: 'filtered-key' }],
      total: 1, page: 1, page_size: 20, pages: 1,
    })
    wrapper.findComponent({ name: 'SearchInput' }).vm.$emit('search')
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    expect(table.props('loading')).toBe(false)

    oldList.resolve({
      items: [{ ...createApiKey(), name: 'stale-key' }],
      total: 1, page: 1, page_size: 20, pages: 1,
    })
    await flushPromises()
    expect(table.props('data')).toEqual([expect.objectContaining({ id: 2, name: 'filtered-key' })])
    expect(getDashboardApiKeysUsage).toHaveBeenCalledOnce()
    expect(getDashboardApiKeysUsage.mock.calls[0][0]).toEqual([2])

    usage.resolve({ stats: {} })
    await flushPromises()
    wrapper.unmount()
  })

  it.each([
    { initialStatus: 'quota_exhausted', status: 'active', formStatus: 'active' },
    { initialStatus: 'inactive', status: 'inactive', formStatus: 'inactive' },
    { initialStatus: 'active', status: 'active', formStatus: 'inactive' },
  ] as const)('syncs quota reset from $initialStatus to $status with form status $formStatus', async ({ initialStatus, status, formStatus }) => {
    const key: ApiKey = {
      ...createApiKey(), group_id: 1, quota: 10, quota_used: 10,
      status: initialStatus,
    }
    listKeys.mockResolvedValueOnce({ items: [key], total: 1, page: 1, page_size: 20, pages: 1 })
    updateKey.mockResolvedValue({ ...key, status, quota_used: 0 })
    const wrapper = await mountView()
    await getButtonByText(wrapper, 'common.edit').trigger('click')
    await wrapper.get('[data-tour="key-form-name"]').setValue('Unsaved name')
    const statusSelect = wrapper.findAllComponents({ name: 'Select' })
      .find((select) => select.props('options').length === 2 &&
        select.props('options')[0].value === 'active')!
    statusSelect.vm.$emit('update:modelValue', 'inactive')
    await wrapper.get('button[title="keys.resetQuotaUsed"]').trigger('click')
    const confirmation = wrapper.findAllComponents({ name: 'ConfirmDialog' })
      .find((dialog) => dialog.props('title') === 'keys.resetQuotaTitle')!
    confirmation.vm.$emit('confirm')
    await flushPromises()

    expect(updateKey).toHaveBeenNthCalledWith(1, key.id, { reset_quota: true })
    expect(wrapper.findComponent({ name: 'DataTable' }).props('data')[0])
      .toMatchObject({ status, quota_used: 0 })
    expect(statusSelect.props('modelValue')).toBe(formStatus)
    expect((wrapper.get('[data-tour="key-form-name"]').element as HTMLInputElement).value)
      .toBe('Unsaved name')

    await wrapper.get('#key-form').trigger('submit')
    await flushPromises()
    expect(updateKey).toHaveBeenNthCalledWith(2, key.id, expect.objectContaining({ name: 'Unsaved name', status: formStatus }))
    wrapper.unmount()
  })

  it('uses the default API key columns with low-frequency columns hidden', async () => {
    const wrapper = await mountView()

    expect(visibleColumnKeys(wrapper)).toEqual([
      'name',
      'key',
      'group',
      'current_concurrency',
      'usage',
      'expires_at',
      'status',
      'created_at',
      'actions',
    ])
    expect(visibleColumnKeys(wrapper)).not.toContain('rate_limit')
    expect(visibleColumnKeys(wrapper)).not.toContain('last_used_at')
    expect(visibleColumnKeys(wrapper)).not.toContain('last_used_ip')
    expect(visibleColumnKeys(wrapper)).not.toContain('id')
  })

  it('opens bulk editing with only selected visible keys', async () => {
    const wrapper = await mountView()
    const table = wrapper.findComponent({ name: 'DataTable' })
    expect(table.props('selectable')).toBe(true)
    table.vm.$emit('update:selectedKeys', [1, 99])
    await nextTick()
    await wrapper.get('[data-test="bulk-edit-keys"]').trigger('click')
    const modal = wrapper.findComponent({ name: 'BulkEditKeysModal' })
    expect(modal.props('show')).toBe(true)
    expect(modal.props('selectedKeys').map((key: ApiKey) => key.id)).toEqual([1])
    wrapper.unmount()
  })

  it.each(['filter', 'page size', 'sort'])('clears selection on %s changes', async (change) => {
    const wrapper = await mountView()
    const table = wrapper.findComponent({ name: 'DataTable' })
    table.vm.$emit('update:selectedKeys', [1])
    await nextTick()
    if (change === 'filter') {
      wrapper.findComponent({ name: 'SearchInput' }).vm.$emit('search')
    } else if (change === 'page size') {
      await wrapper.get('[data-test="page-size-50"]').trigger('click')
    } else {
      table.vm.$emit('sort', 'created_at', 'asc')
    }
    await flushPromises()
    expect(table.props('selectedKeys')).toEqual([])
    expect(wrapper.find('[data-test="bulk-edit-keys"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('removes successful keys from the selection and refreshes the table', async () => {
    listKeys.mockResolvedValue({
      items: [createApiKey(), { ...createApiKey(), id: 2, name: 'Second' }],
      total: 2, pages: 1
    })
    const wrapper = await mountView()
    const table = wrapper.findComponent({ name: 'DataTable' })
    table.vm.$emit('update:selectedKeys', [1, 2])
    await nextTick()
    await wrapper.get('[data-test="bulk-edit-keys"]').trigger('click')
    wrapper.findComponent({ name: 'BulkEditKeysModal' }).vm.$emit('updated', [1])
    await flushPromises()
    expect(listKeys).toHaveBeenCalledTimes(2)
    expect(table.props('selectedKeys')).toEqual([2])
    wrapper.unmount()
  })

  it('drops keys that are no longer visible after a refresh', async () => {
    const wrapper = await mountView()
    const table = wrapper.findComponent({ name: 'DataTable' })
    table.vm.$emit('update:selectedKeys', [1])
    await nextTick()
    listKeys.mockResolvedValue({ items: [], total: 0, pages: 0 })
    await wrapper.get('button[title="Refresh"]').trigger('click')
    await flushPromises()
    expect(table.props('selectedKeys')).toEqual([])
    wrapper.unmount()
  })

  it('shows a hidden column when toggled and persists the preference', async () => {
    const wrapper = await mountView()

    await wrapper.get('button[title="Column Settings"]').trigger('click')
    await getButtonByText(wrapper, 'Rate Limit').trigger('click')
    await nextTick()

    expect(visibleColumnKeys(wrapper)).toContain('rate_limit')
    expect(localStorage.getItem('api-key-hidden-columns')).toBe(
      JSON.stringify(['id', 'last_used_at', 'last_used_ip'])
    )
    expect(localStorage.getItem('api-key-column-settings-version')).toBe('3')
  })

  it('shows the API key ID column when toggled', async () => {
    const wrapper = await mountView()

    await wrapper.get('button[title="Column Settings"]').trigger('click')
    await getButtonByText(wrapper, 'ID').trigger('click')
    await nextTick()

    expect(visibleColumnKeys(wrapper)).toContain('id')
    expect(wrapper.get('[data-test="key-id"]').text()).toBe('#1')
    expect(visibleColumnMeta(wrapper).find((column) => column.key === 'id')?.sortable).toBe(true)
  })

  it('shows the last used IP column when toggled', async () => {
    listKeys.mockResolvedValueOnce({
      items: [{ ...createApiKey(), last_used_ip: '203.0.113.10' }],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1,
    })
    const wrapper = await mountView()

    await wrapper.get('button[title="Column Settings"]').trigger('click')
    await getButtonByText(wrapper, 'Last Used IP').trigger('click')
    await nextTick()

    expect(visibleColumnKeys(wrapper)).toContain('last_used_ip')
    expect(wrapper.get('[data-test="last-used-ip"]').text()).toBe('203.0.113.10')
  })

  it('restores column preferences from localStorage on mount', async () => {
    localStorage.setItem('api-key-hidden-columns', JSON.stringify(['group', 'created_at']))
    localStorage.setItem('api-key-column-settings-version', '1')

    const wrapper = await mountView()

    expect(visibleColumnKeys(wrapper)).toEqual([
      'name',
      'key',
      'current_concurrency',
      'usage',
      'rate_limit',
      'expires_at',
      'status',
      'last_used_at',
      'actions',
    ])
    expect(localStorage.getItem('api-key-hidden-columns')).toBe(
      JSON.stringify(['group', 'created_at', 'last_used_ip', 'id'])
    )
    expect(localStorage.getItem('api-key-column-settings-version')).toBe('3')
  })

  it('does not include always-visible columns in the toggleable menu', async () => {
    const wrapper = await mountView()

    await wrapper.get('button[title="Column Settings"]').trigger('click')
    await nextTick()

    const columnMenuText = wrapper.text()
    expect(columnMenuText).toContain('API Key')
    expect(columnMenuText).toContain('ID')
    expect(columnMenuText).toContain('Current Concurrency')
    expect(columnMenuText).toContain('Rate Limit')
    expect(columnMenuText).toContain('Last Used IP')
    expect(columnMenuText).not.toContain('Name')
    expect(columnMenuText).not.toContain('Actions')
  })

  it('renders the current concurrency value', async () => {
    const wrapper = await mountView()

    expect(wrapper.get('[data-test="current-concurrency"]').text()).toBe('3')
  })

  it('marks current concurrency as sortable', async () => {
    const wrapper = await mountView()

    const currentConcurrencyColumn = visibleColumnMeta(wrapper).find(
      (column) => column.key === 'current_concurrency'
    )
    expect(currentConcurrencyColumn?.sortable).toBe(true)
  })

  it.each([
    { key: 'current_concurrency', order: 'asc' },
    { key: 'expires_at', order: 'asc' },
    { key: 'expires_at', order: 'desc' },
  ] as const)('keeps filters and resets pagination and selection when sorting $key $order', async ({ key, order }) => {
    const wrapper = await mountView()

    await wrapper.get('[data-test="page-size-50"]').trigger('click')
    await flushPromises()

    await wrapper.findComponent({ name: 'SearchInput' }).vm.$emit('update:modelValue', 'target')
    await wrapper.findComponent({ name: 'SearchInput' }).vm.$emit('search')
    await flushPromises()

    await wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', 'active')
    await flushPromises()

    await wrapper.get('[data-test="page-2"]').trigger('click')
    await flushPromises()
    const table = wrapper.findComponent({ name: 'DataTable' })
    table.vm.$emit('update:selectedKeys', [1])
    await nextTick()
    expect(table.props('selectedKeys')).toEqual([1])
    expect(visibleColumnMeta(wrapper).find((column) => column.key === key)?.sortable).toBe(true)
    listKeys.mockClear()

    table.vm.$emit('sort', key, order)
    await flushPromises()

    expect(table.props('selectedKeys')).toEqual([])
    expect(listKeys).toHaveBeenLastCalledWith(
      1,
      50,
      {
        search: 'target',
        status: 'active',
        sort_by: key,
        sort_order: order,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  describe('inline group switching', () => {
    const first = () => ({ ...createApiKey(), group_id: 3, quota: 20, quota_used: 11, rate_limit_5h: 2 })
    const second = () => ({ ...createApiKey(), id: 2, name: 'Second key', group_id: 4 })
    beforeEach(() => {
      getAvailableGroups.mockResolvedValue([
        { id: 3, name: 'OpenAI', platform: 'openai', status: 'active' },
        { id: 4, name: 'OpenAI Secondary', platform: 'openai', status: 'active' },
        { id: 8, name: 'OpenAI Pro', platform: 'openai', status: 'active' }
      ])
      listKeys.mockResolvedValue({ items: [first(), second()], total: 2, pages: 1 })
    })
    const chooseGroup = async (wrapper: VueWrapper, index: number, groupId: number) => {
      await wrapper.findAllComponents(KeyGroupSelector)[index]
        .get('[data-test="key-inline-group-trigger"]').trigger('click')
      await wrapper.get(`[data-test="key-inline-group-option-${groupId}"]`).trigger('click')
    }

    it('passes user group rates unchanged to every selector, including a valid zero override', async () => {
      const rates = { 3: 0.7, 4: 1.25, 8: 0 }
      const groups = [
        { id: 3, name: 'OpenAI', platform: 'openai', status: 'active', rate_multiplier: 0.2 },
        { id: 4, name: 'Other', platform: 'composite', status: 'active', rate_multiplier: 0.4 },
        { id: 8, name: 'ALL', platform: 'composite', status: 'active', rate_multiplier: 2 }
      ]
      getAvailableGroups.mockResolvedValue(groups)
      getUserGroupRates.mockResolvedValue(rates)
      const wrapper = await mountView()
      try {
        const selectors = wrapper.findAllComponents(KeyGroupSelector)
        expect(selectors).toHaveLength(2)
        for (const selector of selectors) {
          expect(selector.props('userGroupRates')).toEqual(rates)
          expect(selector.props('userGroupRates')[3]).toBe(0.7)
          expect(selector.props('userGroupRates')[8]).toBe(0)
          expect(selector.props('groups')).toEqual(groups)
        }
        expect(getUserGroupRates).toHaveBeenCalledOnce()
        expect(getAvailableGroups).toHaveBeenCalledOnce()
      } finally {
        wrapper.unmount()
      }
    })

    it('keeps available groups and key operations usable while user group rates are pending or fail', async () => {
      const rates = deferred<Record<number, number>>()
      const failure = new Error('User group rates temporarily unavailable')
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      getUserGroupRates.mockReturnValue(rates.promise)
      updateKey.mockResolvedValueOnce({ ...first(), group_id: 8 }).mockResolvedValueOnce(first())
      const wrapper = await mountView()
      try {
        const table = wrapper.findComponent({ name: 'DataTable' })
        const selector = wrapper.findAllComponents(KeyGroupSelector)[0]
        expect(table.props('loading')).toBe(false)
        expect(table.props('data')).toEqual([first(), second()])
        expect(selector.props('groups').map((group: { id: number }) => group.id)).toEqual([3, 4, 8])
        expect(selector.props('userGroupRates')).toEqual({})
        expect(getUserGroupRates).toHaveBeenCalledOnce()
        expect(getAvailableGroups).toHaveBeenCalledOnce()

        await chooseGroup(wrapper, 0, 8)
        await flushPromises()
        expect(updateKey).toHaveBeenNthCalledWith(1, 1, { group_id: 8 })
        expect(table.props('data')[0].group_id).toBe(8)

        rates.reject(failure)
        await flushPromises()
        expect(consoleError).toHaveBeenCalledWith(expect.any(String), failure)
        expect(selector.props('userGroupRates')).toEqual({})
        expect(selector.props('groups').map((group: { id: number }) => group.id)).toEqual([3, 4, 8])
        expect(wrapper.get('button[title="Refresh"]').attributes('disabled')).toBeUndefined()
        expect(showError).not.toHaveBeenCalled()

        await chooseGroup(wrapper, 0, 3)
        await flushPromises()
        expect(updateKey).toHaveBeenCalledTimes(2)
        expect(updateKey).toHaveBeenNthCalledWith(2, 1, { group_id: 3 })
        expect(table.props('data')).toEqual([first(), second()])
      } finally {
        wrapper.unmount()
        consoleError.mockRestore()
      }
    })

    it('updates only the matching row group from the response and sends only group_id without reloading usage', async () => {
      const savedGroup = { id: 8, name: 'Saved OpenAI Pro', platform: 'openai' } as NonNullable<ApiKey['group']>
      const updated = { ...second(), group_id: 8, group: savedGroup, updated_at: '2026-10-23T10:00:00Z' }
      updateKey.mockResolvedValue(updated)
      const wrapper = await mountView()
      await chooseGroup(wrapper, 1, 8)
      await flushPromises()

      expect(updateKey).toHaveBeenCalledOnce()
      expect(updateKey).toHaveBeenCalledWith(2, { group_id: 8 })
      expect(wrapper.findComponent({ name: 'DataTable' }).props('data')).toEqual([
        first(), { ...second(), group_id: 8, group: savedGroup }
      ])
      expect(listKeys).toHaveBeenCalledOnce()
      expect(getDashboardApiKeysUsage).toHaveBeenCalledOnce()
      expect(showSuccess).toHaveBeenCalledWith('keys.groupChangedSuccess')
      wrapper.unmount()
    })

    it('disables editing only the pending key while another key remains editable and submittable', async () => {
      const pending = deferred<ApiKey>()
      const editedSecond = { ...second(), name: 'Edited second key' }
      updateKey.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(editedSecond)
      const wrapper = await mountView()
      const editButtons = () => wrapper.findAll('button').filter((button) => button.text().includes('common.edit'))
      try {
        await chooseGroup(wrapper, 0, 8)

        expect(editButtons()[0].attributes('disabled')).toBeDefined()
        expect(editButtons()[1].attributes('disabled')).toBeUndefined()
        await editButtons()[0].trigger('click')
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
        await editButtons()[1].trigger('click')
        expect((wrapper.get('[data-tour="key-form-name"]').element as HTMLInputElement).value).toBe('Second key')
        expect(wrapper.get('[data-tour="key-form-submit"]').attributes('disabled')).toBeUndefined()

        await wrapper.get('[data-tour="key-form-name"]').setValue('Edited second key')
        listKeys.mockResolvedValueOnce({ items: [first(), editedSecond], total: 2, pages: 1 })
        await wrapper.get('#key-form').trigger('submit')
        await flushPromises()

        expect(updateKey).toHaveBeenCalledTimes(2)
        expect(updateKey).toHaveBeenNthCalledWith(1, 1, { group_id: 8 })
        expect(updateKey).toHaveBeenNthCalledWith(2, 2, expect.objectContaining({ name: 'Edited second key' }))
        expect(editButtons()[0].attributes('disabled')).toBeDefined()
        expect(editButtons()[1].attributes('disabled')).toBeUndefined()

        pending.resolve({ ...first(), group_id: 8 })
        await flushPromises()
        expect(editButtons()[0].attributes('disabled')).toBeUndefined()
        expect(editButtons()[1].attributes('disabled')).toBeUndefined()
        expect(wrapper.findComponent({ name: 'DataTable' }).props('data')).toEqual([
          { ...first(), group_id: 8 }, editedSecond
        ])
      } finally {
        wrapper.unmount()
      }
    })

    it('blocks an already-open same-key edit form until its inline request settles', async () => {
      const pending = deferred<ApiKey>()
      const edited = { ...first(), name: 'Edited after inline', group_id: 4 }
      updateKey.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(edited)
      const wrapper = await mountView()
      const saveGroup = wrapper.findAllComponents(KeyGroupSelector)[0].props('saveGroup')
      try {
        await getButtonByText(wrapper, 'common.edit').trigger('click')
        await wrapper.get('[data-tour="key-form-name"]').setValue('Edited after inline')
        await wrapper.get('[data-tour="key-form-group"]').setValue('4')

        const saving = saveGroup(1, 8)
        await nextTick()
        expect(wrapper.get('[data-tour="key-form-submit"]').attributes('disabled')).toBeDefined()
        await wrapper.get('#key-form').trigger('submit')
        await flushPromises()

        expect(updateKey).toHaveBeenCalledOnce()
        expect(updateKey).toHaveBeenCalledWith(1, { group_id: 8 })
        expect(listKeys).toHaveBeenCalledOnce()
        expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
        expect(showError).not.toHaveBeenCalled()

        pending.resolve({ ...first(), group_id: 8 })
        await saving
        await flushPromises()
        expect(wrapper.get('[data-tour="key-form-submit"]').attributes('disabled')).toBeUndefined()
        expect((wrapper.get('[data-tour="key-form-name"]').element as HTMLInputElement).value).toBe('Edited after inline')
        expect(wrapper.getComponent('[data-tour="key-form-group"]').props('modelValue')).toBe(4)

        listKeys.mockResolvedValueOnce({ items: [edited, second()], total: 2, pages: 1 })
        await wrapper.get('#key-form').trigger('submit')
        await flushPromises()

        expect(updateKey).toHaveBeenCalledTimes(2)
        expect(updateKey).toHaveBeenNthCalledWith(2, 1, expect.objectContaining({
          name: 'Edited after inline', group_id: 4
        }))
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
        expect(wrapper.findComponent({ name: 'DataTable' }).props('data')).toEqual([edited, second()])
      } finally {
        wrapper.unmount()
      }
    })

    it('keeps another key edit form unchanged while an inline change completes', async () => {
      updateKey.mockResolvedValue({ ...second(), group_id: 8 })
      const wrapper = await mountView()
      await wrapper.findAll('button').find((button) => button.text().includes('common.edit'))!.trigger('click')
      await wrapper.get('[data-tour="key-form-name"]').setValue('Unsaved name')
      const groupSelect = wrapper.getComponent('[data-tour="key-form-group"]')
      await chooseGroup(wrapper, 1, 8)
      await flushPromises()

      expect((wrapper.get('[data-tour="key-form-name"]').element as HTMLInputElement).value).toBe('Unsaved name')
      expect(groupSelect.props('modelValue')).toBe(3)
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'DataTable' }).props('data')[0])
        .toMatchObject({ group_id: 3, quota: 20, quota_used: 11, rate_limit_5h: 2 })
      expect(updateKey).toHaveBeenCalledWith(2, { group_id: 8 })
      wrapper.unmount()
    })

    it('retains per-key pending state across a refresh and applies the eventual response to the refreshed row', async () => {
      const pending = deferred<ApiKey>()
      updateKey.mockReturnValue(pending.promise)
      const wrapper = await mountView()
      await chooseGroup(wrapper, 0, 8)
      await wrapper.get('button[title="Refresh"]').trigger('click')
      await flushPromises()

      const reloaded = wrapper.findAllComponents(KeyGroupSelector)[0]
      expect(reloaded.get('[data-test="key-inline-group-trigger"]').attributes('aria-disabled')).toBe('true')
      await reloaded.get('[data-test="key-inline-group-trigger"]').trigger('click')
      expect(updateKey).toHaveBeenCalledOnce()
      const updated = { ...first(), group_id: 8 }
      pending.resolve(updated)
      await flushPromises()
      expect(wrapper.findComponent({ name: 'DataTable' }).props('data')).toEqual([updated, second()])
      expect(reloaded.get('[data-test="key-inline-group-trigger"]').attributes('aria-disabled')).toBe('false')
      wrapper.unmount()
    })

    describe('inline refresh race regression', () => {
      const originalGroup = { id: 3, name: 'OpenAI', platform: 'openai' } as NonNullable<ApiKey['group']>
      const savedGroup = { id: 8, name: 'Saved OpenAI Pro', platform: 'openai' } as NonNullable<ApiKey['group']>

      it('preserves refreshed non-group fields when a stale full-row inline response arrives afterward', async () => {
        const pending = deferred<ApiKey>()
        const refreshed = {
          ...first(), name: 'Fresh before save', quota: 67, quota_used: 18, rate_limit_5h: 9,
          updated_at: '2026-10-23T10:02:00Z', group: originalGroup
        }
        updateKey.mockReturnValueOnce(pending.promise)
        const wrapper = await mountView()
        const table = wrapper.findComponent({ name: 'DataTable' })
        try {
          await chooseGroup(wrapper, 0, 8)
          listKeys.mockResolvedValueOnce({ items: [refreshed, second()], total: 2, pages: 1 })
          await wrapper.get('button[title="Refresh"]').trigger('click')
          await flushPromises()
          expect(table.props('data')).toEqual([refreshed, second()])

          pending.resolve({ ...first(), group_id: 8, group: savedGroup })
          await flushPromises()

          expect(table.props('data')).toEqual([
            { ...refreshed, group_id: 8, group: savedGroup }, second()
          ])
          expect(wrapper.findAllComponents(KeyGroupSelector)[0].text()).toContain('Saved OpenAI Pro')
          expect(updateKey).toHaveBeenCalledOnce()
          expect(updateKey).toHaveBeenCalledWith(1, { group_id: 8 })
          expect(listKeys).toHaveBeenCalledTimes(2)
        } finally {
          wrapper.unmount()
        }
      })

      it('keeps a completed switch over a delayed refresh while accepting other fields and a reverse switch', async () => {
        const pending = deferred<ApiKey>()
        const refreshedList = deferred<Awaited<ReturnType<typeof keysAPI.list>>>()
        const saved = { ...first(), group_id: 8, group: savedGroup }
        const refreshed = {
          ...first(), name: 'Refreshed key', quota: 75, quota_used: 19, group: originalGroup
        }
        const refreshedSecond = {
          ...second(), name: 'Other refreshed key', group_id: 3, group: originalGroup
        }
        updateKey.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(refreshed)
        const wrapper = await mountView()
        const table = wrapper.findComponent({ name: 'DataTable' })
        try {
          await chooseGroup(wrapper, 0, 8)
          listKeys.mockReturnValueOnce(refreshedList.promise)
          await wrapper.get('button[title="Refresh"]').trigger('click')
          expect(table.props('loading')).toBe(true)
          expect(listKeys).toHaveBeenCalledTimes(2)

          pending.resolve(saved)
          await flushPromises()
          refreshedList.resolve({ items: [refreshed, refreshedSecond], total: 42, pages: 3 })
          await flushPromises()

          expect(table.props('data')).toEqual([
            { ...refreshed, group_id: 8, group: savedGroup }, refreshedSecond
          ])
          expect(wrapper.findComponent({ name: 'Pagination' }).props('total')).toBe(42)
          expect(wrapper.findAllComponents(KeyGroupSelector)[0].text()).toContain('Saved OpenAI Pro')
          await chooseGroup(wrapper, 0, 3)
          await flushPromises()
          expect(updateKey).toHaveBeenCalledTimes(2)
          expect(updateKey).toHaveBeenNthCalledWith(2, 1, { group_id: 3 })
          expect(table.props('data')).toEqual([refreshed, refreshedSecond])
        } finally {
          wrapper.unmount()
        }
      })

      it('protects the parent save callback when a delayed refresh started before the inline request', async () => {
        const pending = deferred<ApiKey>()
        const refreshedList = deferred<Awaited<ReturnType<typeof keysAPI.list>>>()
        const saved = { ...first(), group_id: 8, group: savedGroup }
        const refreshed = { ...first(), name: 'Earlier refresh', quota: 63, group: originalGroup }
        updateKey.mockReturnValueOnce(pending.promise)
        const wrapper = await mountView()
        const table = wrapper.findComponent({ name: 'DataTable' })
        const saveGroup = wrapper.findAllComponents(KeyGroupSelector)[0].props('saveGroup')
        try {
          listKeys.mockReturnValueOnce(refreshedList.promise)
          await wrapper.get('button[title="Refresh"]').trigger('click')
          expect(table.props('loading')).toBe(true)
          expect(listKeys).toHaveBeenCalledTimes(2)
          expect(updateKey).not.toHaveBeenCalled()

          // Loading removes the selector; exercise the parent's request-order contract directly.
          const saving = saveGroup(1, 8)
          expect(updateKey).toHaveBeenCalledWith(1, { group_id: 8 })
          pending.resolve(saved)
          await saving
          await flushPromises()
          refreshedList.resolve({ items: [refreshed, second()], total: 2, pages: 1 })
          await flushPromises()

          expect(table.props('data')).toEqual([
            { ...refreshed, group_id: 8, group: savedGroup }, second()
          ])
          expect(wrapper.findAllComponents(KeyGroupSelector)[0].text()).toContain('Saved OpenAI Pro')
          expect(updateKey).toHaveBeenCalledOnce()
        } finally {
          wrapper.unmount()
        }
      })

      it('accepts a different server group from a fresh refresh started after the save completed', async () => {
        const saved = { ...first(), group_id: 8, group: savedGroup }
        const refreshed = {
          ...first(), name: 'Fresh server state', quota: 91, group_id: 4,
          group: { id: 4, name: 'Server changed group', platform: 'openai' } as NonNullable<ApiKey['group']>
        }
        updateKey.mockResolvedValueOnce(saved)
        const wrapper = await mountView()
        const table = wrapper.findComponent({ name: 'DataTable' })
        try {
          await chooseGroup(wrapper, 0, 8)
          await flushPromises()
          expect(table.props('data')[0]).toEqual(saved)
          listKeys.mockResolvedValueOnce({ items: [refreshed, second()], total: 2, pages: 1 })
          await wrapper.get('button[title="Refresh"]').trigger('click')
          await flushPromises()

          expect(table.props('data')).toEqual([refreshed, second()])
          expect(wrapper.findAllComponents(KeyGroupSelector)[0].text()).toContain('Server changed group')
          expect(updateKey).toHaveBeenCalledOnce()
        } finally {
          wrapper.unmount()
        }
      })

      it('does not reinsert a saved key missing from a delayed refresh response', async () => {
        const pending = deferred<ApiKey>()
        const refreshedList = deferred<Awaited<ReturnType<typeof keysAPI.list>>>()
        updateKey.mockReturnValueOnce(pending.promise)
        const wrapper = await mountView()
        const table = wrapper.findComponent({ name: 'DataTable' })
        try {
          await chooseGroup(wrapper, 0, 8)
          listKeys.mockReturnValueOnce(refreshedList.promise)
          await wrapper.get('button[title="Refresh"]').trigger('click')
          expect(table.props('loading')).toBe(true)
          pending.resolve({ ...first(), group_id: 8, group: savedGroup })
          await flushPromises()
          refreshedList.resolve({ items: [second()], total: 1, pages: 1 })
          await flushPromises()

          expect(table.props('data')).toEqual([second()])
          expect(wrapper.findComponent({ name: 'Pagination' }).props('total')).toBe(1)
          expect(wrapper.findAllComponents(KeyGroupSelector)).toHaveLength(1)
        } finally {
          wrapper.unmount()
        }
      })
    })

    it('does not insert a key that has left the current page when its pending update finishes', async () => {
      const pending = deferred<ApiKey>()
      updateKey.mockReturnValue(pending.promise)
      const wrapper = await mountView()
      await chooseGroup(wrapper, 0, 8)
      listKeys.mockResolvedValue({ items: [second()], total: 1, pages: 1 })
      await wrapper.get('button[title="Refresh"]').trigger('click')
      await flushPromises()
      pending.resolve({ ...first(), group_id: 8 })
      await flushPromises()
      expect(wrapper.findComponent({ name: 'DataTable' }).props('data')).toEqual([second()])
      wrapper.unmount()
    })
  })

  describe.each([
    { role: 'regular user', isAdmin: false },
    { role: 'administrator', isAdmin: true },
  ])('personal keys for $role', ({ isAdmin }) => {
    const group = (id: number, platform: Group['platform'], name = `Group ${id}`): Group => ({
      id,
      name,
      platform,
      status: 'active',
      rate_multiplier: 0.2,
      subscription_type: 'standard',
    }) as Group
    const openCreate = async () => {
      const wrapper = await mountView()
      await wrapper.get('[data-tour="keys-create-btn"]').trigger('click')
      return wrapper
    }
    const selectProvider = async (wrapper: VueWrapper, provider: 'anthropic' | 'openai' | 'domestic' | 'other') => {
      const radio = wrapper.get(`input[name="key-provider"][value="${provider}"]`)
      await radio.setValue(true)
    }
    const submitNewKey = async (wrapper: VueWrapper) => {
      await wrapper.get('[data-tour="key-form-name"]').setValue('My key')
      await wrapper.get('#key-form').trigger('submit')
      await flushPromises()
    }

    beforeEach(() => {
      authState.isAdmin = isAdmin
      getAvailableGroups.mockResolvedValue([
        group(1, 'anthropic', 'Claude Main'),
        group(3, 'openai', 'OpenAI Primary'),
        group(4, 'openai', 'OpenAI Backup'),
        group(6, 'deepseek', 'DeepSeek V3'),
        group(7, 'kimi', 'Kimi K2'),
        group(8, 'composite', 'ALL'),
      ])
      vi.mocked(keysAPI.create).mockResolvedValue({ ...createApiKey(), group_id: 1 })
    })

    it('renders Name -> Provider -> Group in create modal with original four cards and order', async () => {
      const wrapper = await mountView()

      expect(visibleColumnKeys(wrapper)).toContain('group')
      expect(wrapper.get('[data-test="key-group"]').text()).toContain('No group')
      const filterLabels = wrapper.findAllComponents({ name: 'Select' })
        .flatMap((select) => (select.props('options') ?? []).map((option: { label: string }) => option.label))
      expect(filterLabels).not.toContain('All Groups')
      expect(wrapper.findAllComponents({ name: 'Select' })).toHaveLength(1)
      expect(wrapper.findComponent(BulkEditKeysModal).props('allowGroupChange')).toBe(false)

      await wrapper.get('button[title="Column Settings"]').trigger('click')
      expect(getButtonByText(wrapper, 'Group')).toBeDefined()
      await wrapper.get('[data-tour="keys-create-btn"]').trigger('click')

      const providerFieldset = wrapper.get('[data-tour="key-form-provider"]')
      const children = Array.from(wrapper.get('#key-form').element.children)
      const nameIndex = children.findIndex((child) => child.contains(wrapper.get('[data-tour="key-form-name"]').element))
      const groupIndex = children.findIndex((child) => child.contains(wrapper.get('[data-tour="key-form-group"]').element))
      expect(nameIndex).toBeGreaterThanOrEqual(0)
      expect(children.indexOf(providerFieldset.element)).toBe(nameIndex + 1)
      expect(groupIndex).toBe(nameIndex + 2)
      const radios = providerFieldset.findAll('input[name="key-provider"]')
      expect(radios.map((r) => r.attributes('value'))).toEqual(['anthropic', 'openai', 'domestic', 'other'])
      expect((radios[0].element as HTMLInputElement).checked).toBe(true)
      expect(providerFieldset.text()).toContain('Anthropic')
      expect(providerFieldset.text()).toContain('OpenAI')
      expect(providerFieldset.text()).toContain('Chinese AI')
      expect(providerFieldset.text()).toContain('Other')

      const groupSelect = wrapper.getComponent('[data-tour="key-form-group"]')
      expect(groupSelect.props('options').map((option: { value: number }) => option.value)).toEqual([1])
      expect(groupSelect.props('modelValue')).toBeNull()
      expect(getUserGroupRates).toHaveBeenCalledOnce()
      wrapper.unmount()
    })

    it('links provider selection to available groups and blocks submitting an old group after switching provider', async () => {
      const wrapper = await openCreate()
      await wrapper.get('[data-tour="key-form-group"]').setValue('1')
      expect(wrapper.getComponent('[data-tour="key-form-group"]').props('modelValue')).toBe(1)

      // Switch provider from Anthropic to OpenAI -> old group is cleared and cannot be submitted
      await selectProvider(wrapper, 'openai')
      const groupSelect = wrapper.getComponent('[data-tour="key-form-group"]')
      expect(groupSelect.props('modelValue')).toBeNull()
      expect(groupSelect.props('options').map((option: { value: number }) => option.value)).toEqual([3, 4])

      await submitNewKey(wrapper)
      expect(keysAPI.create).not.toHaveBeenCalled()
      expect(showError).toHaveBeenCalledWith('keys.groupRequired')

      // Even if a stale group id from Anthropic is forced into the select, submit rejects it
      groupSelect.vm.$emit('update:modelValue', 1)
      await nextTick()
      await submitNewKey(wrapper)
      expect(keysAPI.create).not.toHaveBeenCalled()

      // Selecting an OpenAI group succeeds
      await wrapper.get('[data-tour="key-form-group"]').setValue('3')
      await submitNewKey(wrapper)
      expect(keysAPI.create).toHaveBeenCalledOnce()
      expect(vi.mocked(keysAPI.create).mock.calls[0].slice(0, 2)).toEqual(['My key', 3])
      wrapper.unmount()
    })

    it('groups domestic platforms together in create modal only while keeping edit/inline strictly platform-locked', async () => {
      listKeys.mockResolvedValue({
        items: [{ ...createApiKey(), id: 10, group_id: 6, group: group(6, 'deepseek', 'DeepSeek V3') }],
        total: 1, page: 1, page_size: 20, pages: 1,
      })
      const wrapper = await mountView()

      // Create modal domestic card shows both DeepSeek and Kimi
      await wrapper.get('[data-tour="keys-create-btn"]').trigger('click')
      await selectProvider(wrapper, 'domestic')
      expect(wrapper.getComponent('[data-tour="key-form-group"]').props('options').map((o: { value: number }) => o.value))
        .toEqual([6, 7])
      await wrapper.get('[data-test="close-dialog"]').trigger('click')

      // Inline selector on DeepSeek key only offers DeepSeek (6), never Kimi (7)
      const selector = wrapper.findComponent(KeyGroupSelector)
      await selector.get('[data-test="key-inline-group-trigger"]').trigger('click')
      expect(wrapper.findAll('[role="option"]').map((el) => el.attributes('data-test')))
        .toEqual(['key-inline-group-option-6'])

      // Edit modal on DeepSeek key has no provider cards and matches inline options (only 6)
      await getButtonByText(wrapper, 'common.edit').trigger('click')
      expect(wrapper.find('[data-tour="key-form-provider"]').exists()).toBe(false)
      const editSelect = wrapper.getComponent('[data-tour="key-form-group"]')
      expect(editSelect.props('options').map((o: { value: number }) => o.value)).toEqual([6])
      // Programmatically attempting to submit Kimi (7) is rejected client-side too
      editSelect.vm.$emit('update:modelValue', 7)
      await nextTick()
      await wrapper.get('#key-form').trigger('submit')
      await flushPromises()
      expect(updateKey).not.toHaveBeenCalled()
      wrapper.unmount()
    })

    it('rejects creation when there are no authorized groups', async () => {
      getAvailableGroups.mockResolvedValue([])
      const wrapper = await openCreate()
      await submitNewKey(wrapper)

      expect(keysAPI.create).not.toHaveBeenCalled()
      expect(showError).toHaveBeenCalledWith('common.noGroupsAvailable')
      wrapper.unmount()
    })

    it('lists maintenance groups under their provider without defaulting to or binding them', async () => {
      getAvailableGroups.mockResolvedValue([
        { ...group(1, 'anthropic', 'Claude Maint'), status: 'maintenance' },
        group(3, 'openai', 'OpenAI Active'),
      ])
      const wrapper = await openCreate()
      expect(getAvailableGroups).toHaveBeenCalledWith({ includeMaintenance: true })
      // Defaults initial provider to OpenAI because Anthropic has only maintenance groups
      expect((wrapper.get('input[name="key-provider"][value="openai"]').element as HTMLInputElement).checked).toBe(true)
      // User can still inspect Anthropic provider to see its maintenance group disabled
      await selectProvider(wrapper, 'anthropic')
      const select = wrapper.getComponent('[data-tour="key-form-group"]')
      expect(select.props('modelValue')).toBeNull()
      expect(select.props('options')).toContainEqual(expect.objectContaining({ value: 1, disabled: true }))
      select.vm.$emit('update:modelValue', 1)
      await submitNewKey(wrapper)
      expect(keysAPI.create).not.toHaveBeenCalled()
      wrapper.unmount()
    })

    it('rejects a group that is not among the authorized options', async () => {
      const wrapper = await openCreate()
      wrapper.getComponent('[data-tour="key-form-group"]').vm.$emit('update:modelValue', 99)
      await submitNewKey(wrapper)

      expect(keysAPI.create).not.toHaveBeenCalled()
      expect(showError).toHaveBeenCalledWith('keys.groupRequired')
      wrapper.unmount()
    })

    it('selects the first available provider when groups arrive after the dialog opens', async () => {
      let resolveGroups!: (value: ReturnType<typeof group>[]) => void
      getAvailableGroups.mockReturnValue(new Promise((resolve) => { resolveGroups = resolve }))
      const wrapper = await openCreate()
      resolveGroups([group(3, 'openai', 'OpenAI Only'), group(8, 'composite', 'ALL')])
      await flushPromises()

      expect((wrapper.get('input[name="key-provider"][value="openai"]').element as HTMLInputElement).checked).toBe(true)
      await wrapper.get('[data-tour="key-form-group"]').setValue('3')
      await submitNewKey(wrapper)

      expect(vi.mocked(keysAPI.create).mock.calls[0].slice(0, 2)).toEqual(['My key', 3])
      wrapper.unmount()
    })

    it('keeps an existing group when editing without group change and resets create form afterward', async () => {
      listKeys.mockResolvedValue({
        items: [{ ...createApiKey(), group_id: 3 }],
        total: 1,
        page: 1,
        page_size: 20,
        pages: 1,
      })
      updateKey.mockResolvedValue({ ...createApiKey(), group_id: 3 })
      const wrapper = await mountView()
      await getButtonByText(wrapper, 'common.edit').trigger('click')
      expect(wrapper.find('[data-tour="key-form-provider"]').exists()).toBe(false)
      expect(wrapper.getComponent('[data-tour="key-form-group"]').props('modelValue')).toBe(3)

      await wrapper.get('#key-form').trigger('submit')
      await flushPromises()

      expect(updateKey).toHaveBeenCalledOnce()
      expect(updateKey.mock.calls[0][1]).not.toHaveProperty('group_id')
      await wrapper.get('[data-tour="keys-create-btn"]').trigger('click')
      expect(wrapper.find('[data-tour="key-form-provider"]').exists()).toBe(true)
      expect(wrapper.getComponent('[data-tour="key-form-group"]').props('modelValue')).toBeNull()
      wrapper.unmount()
    })

    it('updates an existing key to a same-platform authorized group and hides cross-platform groups', async () => {
      listKeys.mockResolvedValue({
        items: [{ ...createApiKey(), group_id: 3 }], total: 1, page: 1, page_size: 20, pages: 1,
      })
      const wrapper = await mountView()
      await getButtonByText(wrapper, 'common.edit').trigger('click')
      const editSelect = wrapper.getComponent('[data-tour="key-form-group"]')
      expect(editSelect.props('options').map((o: { value: number }) => o.value)).toEqual([3, 4])
      await wrapper.get('[data-tour="key-form-group"]').setValue('4')
      await wrapper.get('#key-form').trigger('submit')
      await flushPromises()

      expect(updateKey).toHaveBeenCalledWith(1, expect.objectContaining({ group_id: 4 }))
      wrapper.unmount()
    })

    it('shows maintenance as disabled in both selectors and saves other fields without rebinding it', async () => {
      const maintained = { ...group(3, 'openai', 'OpenAI Maintenance'), status: 'maintenance' as const }
      getAvailableGroups.mockResolvedValue([maintained, group(4, 'openai'), group(1, 'anthropic')])
      const current = { ...createApiKey(), group_id: 3, group: maintained }
      listKeys.mockResolvedValue({ items: [current], total: 1, page: 1, page_size: 20, pages: 1 })
      updateKey.mockResolvedValue({ ...current, name: 'Renamed while maintained' })
      const wrapper = await mountView()

      await wrapper.findComponent(KeyGroupSelector).get('[data-test="key-inline-group-trigger"]').trigger('click')
      const inline = wrapper.findAll('[role="option"]').map((item) => ({
        id: Number(item.attributes('data-test').split('-').at(-1)),
        disabled: item.attributes('aria-disabled') === 'true',
      }))
      await wrapper.get('[data-test="key-inline-group-cancel"]').trigger('click')
      await getButtonByText(wrapper, 'common.edit').trigger('click')
      const edit = wrapper.getComponent('[data-tour="key-form-group"]')
      expect(inline).toEqual([{ id: 3, disabled: true }, { id: 4, disabled: false }])
      expect(edit.props('options').map((item: { value: number; disabled: boolean }) => ({
        id: item.value, disabled: item.disabled,
      }))).toEqual(inline)
      expect(edit.props('modelValue')).toBe(3)

      await wrapper.get('[data-tour="key-form-name"]').setValue('Renamed while maintained')
      await wrapper.get('#key-form').trigger('submit')
      await flushPromises()
      expect(updateKey).toHaveBeenCalledOnce()
      expect(updateKey.mock.calls[0][1]).toMatchObject({ name: 'Renamed while maintained' })
      expect(updateKey.mock.calls[0][1]).not.toHaveProperty('group_id')
      wrapper.unmount()
    })

    it.each([null, 99])('preserves an existing unavailable group %j without assigning another group', async (groupId) => {
      listKeys.mockResolvedValue({
        items: [{ ...createApiKey(), group_id: groupId }], total: 1, page: 1, page_size: 20, pages: 1,
      })
      const wrapper = await mountView()
      await getButtonByText(wrapper, 'common.edit').trigger('click')
      const groupSelect = wrapper.getComponent('[data-tour="key-form-group"]')
      expect(groupSelect.props('modelValue')).toBe(groupId)
      expect(groupSelect.props('options')).toContainEqual(expect.objectContaining({
        value: groupId,
        disabled: true,
      }))
      if (groupId === null) {
        // Historically unbound key can bind to any authorized platform on first bind
        expect(groupSelect.props('options').map((o: { value: number | null }) => o.value))
          .toEqual([null, 1, 3, 4, 6, 7, 8])
      } else {
        // Unknown bound platform fails closed
        expect(groupSelect.props('options').map((o: { value: number | null }) => o.value))
          .toEqual([99])
      }

      await wrapper.get('[data-tour="key-form-name"]').setValue('Renamed key')
      await wrapper.get('#key-form').trigger('submit')
      await flushPromises()

      expect(updateKey).toHaveBeenCalledOnce()
      expect(updateKey.mock.calls[0][1]).toMatchObject({ name: 'Renamed key' })
      expect(updateKey.mock.calls[0][1]).not.toHaveProperty('group_id')
      expect(showError).not.toHaveBeenCalled()
      wrapper.unmount()
    })

    it('shows an existing unavailable group and only same-platform alternatives when its platform is known', async () => {
      listKeys.mockResolvedValue({
        items: [{ ...createApiKey(), group_id: 99, group: group(99, 'openai', 'Existing group') }],
        total: 1, page: 1, page_size: 20, pages: 1,
      })
      const wrapper = await mountView()
      expect(wrapper.get('[data-test="key-group"]').text()).toContain('Existing group')
      await getButtonByText(wrapper, 'common.edit').trigger('click')
      const options = wrapper.getComponent('[data-tour="key-form-group"]').props('options')
      expect(options).toContainEqual(expect.objectContaining({ value: 99, label: 'Existing group', disabled: true }))
      expect(options.map((o: { value: number }) => o.value)).toEqual([99, 3, 4])
      wrapper.unmount()
    })
  })

  describe('usage stats loading', () => {
    it('renders the key list without waiting for slow usage stats', async () => {
      let resolveUsage!: (value: { stats: Record<string, unknown> }) => void
      getDashboardApiKeysUsage.mockReturnValue(new Promise((resolve) => { resolveUsage = resolve }))
      const wrapper = await mountView()

      const table = wrapper.findComponent({ name: 'DataTable' })
      expect(table.props('loading')).toBe(false)
      expect(table.props('data')).toHaveLength(1)
      expect(wrapper.find('[data-test="usage-pending"]').exists()).toBe(true)

      resolveUsage({
        stats: { 1: { api_key_id: 1, today_actual_cost: 0.5, total_actual_cost: 12.25 } },
      })
      await flushPromises()
      expect(wrapper.find('[data-test="usage-pending"]').exists()).toBe(false)
      expect(wrapper.get('[data-test="usage"]').text()).toContain('$12.2500')
    })

    it('stops showing usage placeholders when the usage request fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      getDashboardApiKeysUsage.mockRejectedValue(new Error('timeout'))
      const wrapper = await mountView()

      expect(wrapper.find('[data-test="usage-pending"]').exists()).toBe(false)
      expect(wrapper.get('[data-test="usage"]').text()).toContain('--')
      expect(wrapper.get('[data-test="usage"]').text()).not.toContain('$0.0000')
      consoleError.mockRestore()
    })
  })
})
