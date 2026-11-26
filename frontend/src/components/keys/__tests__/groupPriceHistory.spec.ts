import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import GroupBadge from '@/components/common/GroupBadge.vue'
import GroupOptionItem from '@/components/common/GroupOptionItem.vue'
import { getGroupPreviousRate } from '../groupPriceHistory'
import type { Group } from '@/types'

const group = { id: 15, platform: 'openai', subscription_type: 'standard', rate_multiplier: 0.18 } as Group

describe('group price history', () => {
  it.each([15, 24])('maps the announced rates for group %s', (id) => {
    expect(getGroupPreviousRate({ ...group, id })).toBe(0.2)
    expect(getGroupPreviousRate({ ...group, id }, 0.15)).toBe(0.16)
  })

  it('does not invent history for other rates, groups, or future prices', () => {
    expect(getGroupPreviousRate(group, undefined, false)).toBeNull()
    expect(getGroupPreviousRate(group, 0.15, false)).toBeNull()
    expect(getGroupPreviousRate(group, 0.1)).toBeNull()
    expect(getGroupPreviousRate({ ...group, id: 99 })).toBeNull()
    expect(getGroupPreviousRate({ ...group, rate_multiplier: 0.17 })).toBeNull()
    expect(getGroupPreviousRate({ ...group, platform: 'anthropic' })).toBeNull()
    expect(getGroupPreviousRate({ ...group, subscription_type: 'subscription' })).toBeNull()
    expect(getGroupPreviousRate(null)).toBeNull()
  })

  for (const [name, component] of [['badge', GroupBadge], ['option', GroupOptionItem]] as const) {
    it.each([undefined, 0.15])(`renders history inside the existing ${name} rate label`, (rate) => {
      const wrapper = mount(component, {
        props: {
          name: 'GPT-Pro', platform: 'openai', rateMultiplier: 0.18,
          userRateMultiplier: rate, previousRateMultiplier: getGroupPreviousRate(group, rate)
        },
        global: {
          plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: {
            en: { keys: { groupPriceDropDetails: '{previous}x -> {current}x' } }
          } })],
          stubs: { PlatformIcon: true }
        }
      })
      const history = wrapper.get('[data-test="group-rate-change"]')
      const previous = rate === 0.15 ? '0.16' : '0.2'
      const current = rate ?? 0.18
      expect(history.text()).toBe(`${previous}x\u2192${current}x`)
      expect(history.attributes('aria-label')).toBe(`${previous}x -> ${current}x`)
      expect(history.element.parentElement?.className).toContain('rounded')
      expect(wrapper.findAll('[data-test="group-rate-change"]')).toHaveLength(1)
      expect(wrapper.find('[data-test="key-group-price-drop"]').exists()).toBe(false)
      expect(wrapper.text()).not.toMatch(/SALE|%/)
    })
  }
})
