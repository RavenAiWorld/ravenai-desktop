import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AllAccountUsage from '../AllAccountUsage.vue'
import { adminAPI } from '@/api/admin'
import { queryAccountUsage } from '@/utils/queryAccountUsage'

vi.mock('@/api/admin', () => ({ adminAPI: { accounts: { list: vi.fn() } } }))
vi.mock('@/utils/queryAccountUsage', () => ({ queryAccountUsage: vi.fn() }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('all usage action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminAPI.accounts.list).mockResolvedValue({ items: [{ id: 1, name: 'first' }, { id: 2, name: 'second' }], total: 2 } as never)
  })
  it('does not query on mount; one click opens results and supports failure retry', async () => {
    vi.mocked(queryAccountUsage).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('upstream timeout'))
    const wrapper = mount(AllAccountUsage, { global: { stubs: {
      Icon: true,
      BaseDialog: { props: ['show'], template: '<section v-if="show"><slot/><slot name="footer"/></section>' }
    } } })
    expect(adminAPI.accounts.list).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="query-all-usage"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('upstream timeout')
    expect(wrapper.emitted('completed')).toHaveLength(1)
    vi.mocked(queryAccountUsage).mockResolvedValue({})
    await wrapper.get('[data-testid="retry-usage"]').trigger('click')
    await flushPromises()
    expect(queryAccountUsage).toHaveBeenCalledTimes(3)
    expect(adminAPI.accounts.list).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="retry-usage"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
