import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ImageGenerationRecordsView from '../ImageGenerationRecordsView.vue'

const { listImageRecords, showError } = vi.hoisted(() => ({
  listImageRecords: vi.fn(), showError: vi.fn(),
}))
vi.mock('@/api/admin/usage', () => ({ listImageRecords, default: {} }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError }) }))
vi.mock('vue-i18n', async () => ({
  ...await vi.importActual<typeof import('vue-i18n')>('vue-i18n'),
  useI18n: () => ({ t: (key: string) => key }),
}))

const DataTableStub = {
  props: ['columns', 'data', 'loading'],
  template: `<table>
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
const DateRangeStub = {
  props: ['startDate', 'endDate'],
  emits: ['update:startDate', 'update:endDate', 'change'],
  template: '<div />',
}
const DialogStub = {
  props: ['show', 'title'],
  emits: ['close'],
  template: '<section v-if="show" role="dialog"><slot /></section>',
}
const record = {
  id: 7, request_id: 'audit-request-7', user_id: 9, api_key_id: 11, group_id: 15,
  model: 'sunburst', source: 'nova_studio', status: 'success',
  requested_images: 2, actual_images: 2, reference_count: 1,
  requested_size: '2048x2048', quality: 'high', endpoint: '/v1/images/generations',
  total_cost: 0.12, actual_cost: 0.10, http_status: 200, duration_ms: 1200,
  user_email: 'artist@example.test', api_key_name: 'Image Studio',
  created_at: '2026-11-03T02:00:00Z', completed_at: '2026-11-03T02:00:01Z',
}
function response(items = [record], total = 42) {
  return { items, total, page: 1, page_size: 20, pages: 3 }
}
let wrapper: VueWrapper | undefined
async function render() {
  wrapper = mount(ImageGenerationRecordsView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: {
          template: '<div><slot name="filters" /><slot name="actions" /><slot name="table" /><slot name="pagination" /></div>',
        },
        DataTable: DataTableStub, Select: SelectStub, Pagination: PaginationStub,
        DateRangePicker: DateRangeStub, BaseDialog: DialogStub, Icon: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('administrator image generation records', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    listImageRecords.mockReset()
    listImageRecords.mockResolvedValue(response())
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.useRealTimers()
  })

  it('loads the audited source separately from the API key name and opens metadata details', async () => {
    const view = await render()
    expect(listImageRecords).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, page_size: expect.any(Number),
    }), { signal: expect.any(AbortSignal) })
    expect(listImageRecords.mock.calls[0][0]).not.toHaveProperty('timezone')
    expect(view.text()).toContain('admin.imageRecords.sources.nova_studio')
    expect(view.text()).toContain('2 / 2')
    expect(view.text()).not.toContain('Image Studio')
    await view.get('[aria-label="admin.imageRecords.detail"]').trigger('click')
    expect(view.get('[role="dialog"]').text()).toContain('Image Studio (#11)')
    expect(view.get('[role="dialog"]').text()).toContain('2048x2048')
    view.findComponent(DialogStub).vm.$emit('close')
    await flushPromises()
    expect(view.find('[role="dialog"]').exists()).toBe(false)
  })

  it('resets the page on source, status, user and date changes', async () => {
    const view = await render()
    view.findComponent(PaginationStub).vm.$emit('update:page', 3)
    await flushPromises()
    expect(listImageRecords.mock.lastCall?.[0].page).toBe(3)
    await view.findAll('select')[0].setValue('historical_unknown')
    await view.findAll('select')[1].setValue('failed')
    await view.get('input[type="number"]').setValue('23')
    await view.get('input[type="number"]').trigger('change')
    const dateRange = view.findComponent(DateRangeStub)
    dateRange.vm.$emit('update:startDate', '2026-11-02')
    dateRange.vm.$emit('update:endDate', '2026-11-03')
    dateRange.vm.$emit('change')
    await flushPromises()
    expect(listImageRecords.mock.lastCall?.[0]).toEqual(expect.objectContaining({
      page: 1, user_id: 23, source: 'historical_unknown', status: 'failed',
      start_date: '2026-11-02', end_date: '2026-11-03',
    }))
    view.findComponent(PaginationStub).vm.$emit('update:pageSize', 50)
    await flushPromises()
    expect(listImageRecords.mock.lastCall?.[0].page_size).toBe(50)
  })

  it('debounces and trims model or request searches', async () => {
    const view = await render()
    vi.useFakeTimers()
    await view.get('input[type="search"]').setValue('  sunburst  ')
    expect(listImageRecords).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(300)
    expect(listImageRecords.mock.lastCall?.[0].search).toBe('sunburst')
  })

  it('does not replace a newer filtered result with a canceled response', async () => {
    const view = await render()
    let resolveOld!: (value: ReturnType<typeof response>) => void
    listImageRecords.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    await view.findAll('select')[0].setValue('external_api')
    const signal = listImageRecords.mock.lastCall?.[1].signal
    listImageRecords.mockResolvedValueOnce(response([{ ...record, request_id: 'LATEST' }]))
    await view.findAll('select')[0].setValue('nova_studio')
    await flushPromises()
    expect(signal.aborted).toBe(true)
    resolveOld(response([{ ...record, request_id: 'STALE' }]))
    await flushPromises()
    expect(view.text()).toContain('LATEST')
    expect(view.text()).not.toContain('STALE')
    expect(showError).not.toHaveBeenCalled()
  })

  it('shows empty results and releases the loading state after errors', async () => {
    listImageRecords.mockResolvedValueOnce(response([], 0))
    const view = await render()
    expect(view.text()).toContain('admin.imageRecords.empty')
    listImageRecords.mockRejectedValueOnce(new Error('offline'))
    await view.get('[aria-label="common.refresh"]').trigger('click')
    await flushPromises()
    expect(showError).toHaveBeenCalledWith('admin.imageRecords.loadFailed')
    expect(view.get('[aria-label="common.refresh"]').attributes('disabled')).toBeUndefined()
  })

  it('cancels a pending read when navigating away', async () => {
    listImageRecords.mockImplementationOnce(() => new Promise(() => {}))
    const view = await render()
    const signal = listImageRecords.mock.lastCall?.[1].signal
    view.unmount()
    wrapper = undefined
    expect(signal.aborted).toBe(true)
  })
})
