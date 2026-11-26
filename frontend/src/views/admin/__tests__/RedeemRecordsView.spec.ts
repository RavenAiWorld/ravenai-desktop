import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import RedeemRecordsView from '../RedeemRecordsView.vue'

const { list, exportCodes, showError, showSuccess } = vi.hoisted(() => ({
  list: vi.fn(), exportCodes: vi.fn(), showError: vi.fn(), showSuccess: vi.fn(),
}))
vi.mock('@/api/admin', () => ({ adminAPI: { redeem: { list, exportCodes } } }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError, showSuccess }) }))
vi.mock('vue-i18n', async () => ({
  ...await vi.importActual<typeof import('vue-i18n')>('vue-i18n'),
  useI18n: () => ({ t: (key: string) => key }),
}))

const DataTableStub = {
  props: ['columns', 'data', 'loading', 'defaultSortKey', 'defaultSortOrder', 'serverSideSort'],
  emits: ['sort'],
  template: `<table>
    <thead><tr><th v-for="column in columns" :key="column.key">{{ column.label }}</th></tr></thead>
    <tbody><tr v-for="row in data" :key="row.id"><td v-for="column in columns" :key="column.key">
      <slot :name="'cell-' + column.key" :row="row" :value="row[column.key]" />
    </td></tr></tbody>
    <slot v-if="!loading && !data.length" name="empty" />
  </table>`,
}
const SelectStub = {
  props: ['modelValue', 'options'],
  emits: ['update:modelValue', 'change'],
  template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value); $emit('change')">
    <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
  </select>`,
}
const PaginationStub = {
  props: ['page', 'pageSize', 'total'],
  emits: ['update:page', 'update:pageSize'],
  template: '<div />',
}

let wrapper: VueWrapper | undefined
const item = {
  id: 7, code: 'TEST-REDEEM-7', type: 'balance', value: 12.5, status: 'used',
  used_by: 9, used_at: '2026-11-01T02:00:00Z', user: { id: 9, email: 'redeemer@example.test' },
}
function response(items = [item], total = 42) {
  return { items, page: 1, page_size: 20, total, pages: 3 }
}
async function render() {
  wrapper = mount(RedeemRecordsView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: {
          template: '<div><slot name="filters" /><slot name="actions" /><slot name="table" /><slot name="pagination" /></div>',
        },
        DataTable: DataTableStub,
        Select: SelectStub,
        Pagination: PaginationStub,
        Icon: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('administrator redemption records', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    list.mockReset()
    exportCodes.mockReset()
    list.mockResolvedValue(response())
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requests only actual used redemption codes, newest first, and has no mutation controls', async () => {
    const view = await render()
    expect(list).toHaveBeenCalledWith(1, expect.any(Number), expect.objectContaining({
      status: 'used', records_only: true, sort_by: 'used_at', sort_order: 'desc',
    }), { signal: expect.any(AbortSignal) })
    expect(view.text()).toContain('redeemer@example.test')
    expect(view.text()).toContain('TEST-REDEEM-7')
    expect(view.text()).toContain('$12.50')
    const table = view.findComponent(DataTableStub)
    expect(table.props('defaultSortKey')).toBe('used_at')
    expect(table.props('columns').map((column: { key: string }) => column.key))
      .toEqual(['used_at', 'used_by', 'code', 'type', 'value'])
    expect(view.findAll('input[type="checkbox"]')).toHaveLength(0)
    expect(view.text()).not.toContain('admin.redeem.generateCodes')
  })

  it('resets pagination when searching a code or email, keeping the used filter', async () => {
    const view = await render()
    view.findComponent(PaginationStub).vm.$emit('update:page', 3)
    await flushPromises()
    expect(list.mock.lastCall?.[0]).toBe(3)
    vi.useFakeTimers()
    await view.get('input[type="search"]').setValue('  redeemer@example.test  ')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(list.mock.lastCall?.slice(0, 3)).toEqual([1, expect.any(Number), expect.objectContaining({
      status: 'used', records_only: true, search: 'redeemer@example.test',
    })])
  })

  it('keeps filters and pagination when sorting, and resets the page on type changes', async () => {
    const view = await render()
    await view.get('select').setValue('subscription')
    await flushPromises()
    view.findComponent(PaginationStub).vm.$emit('update:page', 2)
    await flushPromises()
    view.findComponent(DataTableStub).vm.$emit('sort', 'value', 'asc')
    await flushPromises()
    expect(list.mock.lastCall?.slice(0, 3)).toEqual([1, expect.any(Number), expect.objectContaining({
      status: 'used', records_only: true, type: 'subscription', sort_by: 'value', sort_order: 'asc',
    })])
    view.findComponent(PaginationStub).vm.$emit('update:pageSize', 50)
    await flushPromises()
    expect(list.mock.lastCall?.slice(0, 2)).toEqual([1, 50])
  })

  it('ignores a canceled response after a newer request completes', async () => {
    const view = await render()
    let resolveOld!: (value: ReturnType<typeof response>) => void
    list.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    await view.get('select').setValue('concurrency')
    const oldSignal = list.mock.lastCall?.[3].signal
    list.mockResolvedValueOnce(response([{ ...item, code: 'LATEST' }]))
    await view.get('select').setValue('balance')
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    resolveOld(response([{ ...item, code: 'STALE' }]))
    await flushPromises()
    expect(view.text()).toContain('LATEST')
    expect(view.text()).not.toContain('STALE')
    expect(showError).not.toHaveBeenCalled()
  })

  it('shows an empty state and reports loading failures', async () => {
    list.mockResolvedValueOnce(response([], 0))
    const view = await render()
    expect(view.text()).toContain('admin.redeem.noRecords')
    list.mockRejectedValueOnce(new Error('unavailable'))
    await view.get('[aria-label="common.refresh"]').trigger('click')
    await flushPromises()
    expect(showError).toHaveBeenCalledWith('admin.redeem.failedToLoadRecords')
    expect(view.get('[aria-label="common.refresh"]').attributes('disabled')).toBeUndefined()
  })

  it('exports the same filtered used records and revokes the download URL', async () => {
    const createObjectURL = vi.fn(() => 'blob:redeem-records-test')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const blob = new Blob(['code,used_by\nTEST,9'], { type: 'text/csv' })
    exportCodes.mockResolvedValueOnce(blob)
    const view = await render()
    await view.get('select').setValue('balance')
    await view.get('[aria-label="admin.redeem.exportCsv"]').trigger('click')
    await flushPromises()
    expect(exportCodes).toHaveBeenCalledWith(expect.objectContaining({
      status: 'used', records_only: true, type: 'balance',
    }))
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:redeem-records-test')
    expect(showSuccess).toHaveBeenCalledWith('admin.redeem.recordsExported')
  })

  it('keeps the server-filtered total without filtering items after pagination', async () => {
    list.mockResolvedValueOnce(response([item], 5))
    const view = await render()
    expect(view.findComponent(PaginationStub).props('total')).toBe(5)
    view.findComponent(PaginationStub).vm.$emit('update:page', 2)
    await flushPromises()
    expect(list.mock.lastCall?.slice(0, 3)).toEqual([2, expect.any(Number), expect.objectContaining({
      status: 'used', records_only: true,
    })])
  })

  it('reports export errors and releases the disabled state', async () => {
    exportCodes.mockRejectedValueOnce(new Error('unavailable'))
    const view = await render()
    await view.get('[aria-label="admin.redeem.exportCsv"]').trigger('click')
    await flushPromises()
    expect(showError).toHaveBeenCalledWith('admin.redeem.failedToExportRecords')
    expect(view.get('[aria-label="admin.redeem.exportCsv"]').attributes('disabled')).toBeUndefined()
  })

  it('cancels in-flight requests when navigating away', async () => {
    list.mockImplementationOnce(() => new Promise(() => {}))
    const view = await render()
    const signal = list.mock.lastCall?.[3].signal
    view.unmount()
    wrapper = undefined
    expect(signal.aborted).toBe(true)
  })
})
