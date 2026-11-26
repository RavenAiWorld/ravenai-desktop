import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import GroupOptionItem from '../GroupOptionItem.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ cachedPublicSettings: null }),
}))

describe('GroupOptionItem description layout', () => {
  it('applies multiline and overflow-safe text styles', () => {
    const description = 'First section\nvery-long-unbroken-description-value-that-must-not-overflow'
    const wrapper = mount(GroupOptionItem, {
      props: {
        name: 'Example group',
        platform: 'openai',
        description,
      },
      global: {
        stubs: {
          GroupBadge: true,
        },
      },
    })

    const descriptionElement = wrapper
      .findAll('span')
      .find((element) => element.text() === description)

    expect(descriptionElement).toBeDefined()
    expect(descriptionElement?.classes()).toContain('whitespace-pre-line')
    expect(descriptionElement?.classes()).toContain('[overflow-wrap:anywhere]')
    expect(descriptionElement?.classes()).toContain('line-clamp-3')
    expect(wrapper.find('[title]').attributes('title')).toBe(description)
  })

  it('reserves the right checkmark column for unselected rows so rate pills stay aligned', () => {
    const unselected = mount(GroupOptionItem, {
      props: {
        name: '超长中文企业专属稳定高并发线路名称测试组',
        platform: 'openai',
        rateMultiplier: 0.2,
        selected: false,
        aligned: true,
      },
      global: {
        stubs: {
          PlatformIcon: true,
        },
      },
    })
    const selected = mount(GroupOptionItem, {
      props: {
        name: '超长中文企业专属稳定高并发线路名称测试组',
        platform: 'openai',
        rateMultiplier: 0.2,
        selected: true,
        aligned: true,
      },
      global: {
        stubs: {
          PlatformIcon: true,
        },
      },
    })

    expect(unselected.find('[data-test="group-option-check-slot"]').exists()).toBe(true)
    expect(unselected.find('[data-test="group-option-check-icon"]').exists()).toBe(false)
    expect(selected.find('[data-test="group-option-check-slot"]').exists()).toBe(true)
    expect(selected.find('[data-test="group-option-check-icon"]').exists()).toBe(true)
    expect(unselected.find('[data-test="group-option-rate"]').text()).toContain('0.2x')
  })

  it('gives maintenance status independent space outside GroupBadge and wraps long names safely', () => {
    const wrapper = mount(GroupOptionItem, {
      props: {
        name: '超长中文分组名称在窄屏下不应被裁断或与倍率维护标签重叠',
        status: 'maintenance',
        platform: 'anthropic',
        rateMultiplier: 1.25,
        description: '独立换行展示的详细说明文本',
        selected: false,
        aligned: true,
      },
      global: {
        stubs: {
          PlatformIcon: true,
        },
      },
    })

    const badge = wrapper.find('.groupOptionItemBadge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('超长中文分组名称')
    expect(badge.text()).not.toContain('common.groupMaintenance')

    const maintenanceSlot = wrapper.find('[data-test="group-option-maintenance"]')
    expect(maintenanceSlot.exists()).toBe(true)
    expect(maintenanceSlot.text()).toContain('common.groupMaintenance')
    expect(wrapper.find('[data-test="group-option-description"]').text()).toBe('独立换行展示的详细说明文本')
  })

  it('keeps the default layout for shared admin dropdowns', () => {
    const wrapper = mount(GroupOptionItem, {
      props: { name: 'Shared group', platform: 'openai', status: 'maintenance', rateMultiplier: 1 },
      global: { stubs: { PlatformIcon: true } },
    })
    expect(wrapper.classes()).not.toContain('group-option-aligned')
    expect(wrapper.get('.groupOptionItemBadge').text()).toContain('common.groupMaintenance')
    expect(wrapper.find('[data-test="group-option-maintenance"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="group-option-check-slot"]').exists()).toBe(false)
  })
})
