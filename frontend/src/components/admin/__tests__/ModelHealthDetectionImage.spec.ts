import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ModelHealthDetectionImage from '../ModelHealthDetectionImage.vue'

const { getImage, getSupplierImage, createURL, revokeURL } = vi.hoisted(() => ({
  getImage: vi.fn(), getSupplierImage: vi.fn(), createURL: vi.fn(() => 'blob:preview'), revokeURL: vi.fn()
}))
vi.mock('@/api/admin/modelHealth', () => ({ getModelHealthImage: getImage }))
vi.mock('@/api/admin/supplierHall', () => ({ getSupplierImage }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('model-health authenticated images', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: createURL, revokeObjectURL: revokeURL })
    getImage.mockResolvedValue(new Blob(['image'], { type: 'image/webp' }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('loads through the authenticated API and releases the blob URL on unmount', async () => {
    const wrapper = mount(ModelHealthDetectionImage, { props: { accountId: 140, source: 'published-v1', title: 'Preview', preview: true } })
    await flushPromises()
    expect(getImage).toHaveBeenCalledWith(140, true, 'published-v1', expect.any(AbortSignal))
    expect(wrapper.get('img').attributes('src')).toBe('blob:preview')
    wrapper.unmount()
    expect(revokeURL).toHaveBeenCalledWith('blob:preview')
  })

  it('aborts replaced sources and never displays their late responses', async () => {
    let finish!: (blob: Blob) => void
    getImage.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = mount(ModelHealthDetectionImage, { props: { accountId: 140, source: 'old', title: 'Preview' } })
    const signal = getImage.mock.calls[0]![3] as AbortSignal
    await wrapper.setProps({ source: 'new' })
    expect(signal.aborted).toBe(true)
    await flushPromises()
    finish(new Blob(['old']))
    await flushPromises()
    expect(createURL).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('loads a supplier artifact without a local account ID', async () => {
    getSupplierImage.mockResolvedValue(new Blob(['image'], { type: 'image/webp' }))
    const wrapper = mount(ModelHealthDetectionImage, { props: { supplierId: 189, source: 'published-v1', title: 'Proof', preview: true } })
    await flushPromises()
    expect(getSupplierImage).toHaveBeenCalledWith(189, true, 'published-v1', expect.any(AbortSignal))
    expect(getImage).not.toHaveBeenCalled()
    expect(wrapper.get('img').attributes('alt')).toBe('Proof')
    wrapper.unmount()
  })

  it('shows a readable fallback on request and image decode failures', async () => {
    getImage.mockRejectedValueOnce(new Error('unavailable'))
    const wrapper = mount(ModelHealthDetectionImage, { props: { accountId: 140, source: 'old', title: 'Preview' } })
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('admin.modelHealth.imageFailed')
    await wrapper.setProps({ source: 'new' })
    await flushPromises()
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
